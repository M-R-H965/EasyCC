import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { EventEmitter } from 'events'
import type { CoreEventMap, RunnerOptions } from '@easycc/shared'
import { EventBus } from './event-bus'
import { createLogger } from './logger'

interface Session {
  process: ChildProcess
  sessionId: string
  initialized: boolean
  initTimer: ReturnType<typeof setTimeout> | null
}

export class ClaudeRunner extends EventEmitter {
  private sessions = new Map<string, Session>()
  private tombstones = new Map<string, number>()
  private bus: EventBus<CoreEventMap>
  private logger

  constructor(bus: EventBus<CoreEventMap>, logDir: string) {
    super()
    this.bus = bus
    this.logger = createLogger('claude-runner', logDir)
  }

  async start(options: RunnerOptions): Promise<string> {
    const args = [
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--print',
      '--verbose',
      '--model', options.model,
    ]

    if (options.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt)
    }
    if (options.bare) {
      args.push('--bare')
    }
    for (const dir of options.addDirs ?? []) {
      args.push('--add-dir', dir)
    }
    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }

    const env: Record<string, string> = { ...process.env as Record<string, string> }
    if (options.env) {
      Object.assign(env, options.env)
    }

    const proc = spawn('claude', args, {
      cwd: options.cwd ?? process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const session: Session = {
      process: proc,
      sessionId: '',
      initialized: false,
      initTimer: null,
    }

    // Parse stdout line by line (stream-json)
    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const event = JSON.parse(line)
        this.handleEvent(session, event)
      } catch {
        this.logger.warn('Failed to parse CLI output', { line: line.slice(0, 200) })
      }
    })

    proc.stderr!.on('data', (data: Buffer) => {
      this.logger.debug('CLI stderr', { data: data.toString().slice(0, 500) })
    })

    proc.on('exit', (code) => {
      if (session.initTimer) {
        clearTimeout(session.initTimer)
        session.initTimer = null
      }
      if (session.sessionId) {
        this.tombstones.set(session.sessionId, code ?? 0)
        this.sessions.delete(session.sessionId)
        this.bus.emit('session:exit', { sessionId: session.sessionId, code })
        this.logger.info('CLI process exited', { sessionId: session.sessionId, code })
      }
    })

    // Wait for init event with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!session.initialized && session.sessionId) {
          this.logger.warn('Init timeout, continuing anyway', { sessionId: session.sessionId })
          session.initialized = true
          resolve(session.sessionId)
        } else if (!session.sessionId) {
          reject(new Error('CLI failed to initialize'))
        }
      }, 30_000)

      session.initTimer = timeout

      const checkInit = () => {
        if (session.sessionId && session.initialized) {
          clearTimeout(timeout)
          session.initTimer = null
          resolve(session.sessionId)
        }
      }

      this.on(`_init_${Date.now()}`, checkInit)

      // Also handle early process exit
      proc.on('exit', (code) => {
        if (!session.sessionId) {
          clearTimeout(timeout)
          reject(new Error(`CLI exited before init with code ${code}`))
        }
      })
    })
  }

  send(sessionId: string, message: string): void {
    const session = this.sessions.get(sessionId)

    // Try respawn from tombstone
    if (!session && this.tombstones.has(sessionId)) {
      this.logger.info('Attempting respawn', { sessionId })
      this.tombstones.delete(sessionId)
      // Caller should start a new session with --resume
      return
    }

    if (!session?.process.stdin?.writable) {
      this.logger.error('Cannot send: session not writable', { sessionId })
      return
    }

    const payload = JSON.stringify({
      type: 'user',
      content: message,
    }) + '\n'

    session.process.stdin.write(payload)
  }

  stop(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(session.process.pid), '/T', '/F'])
      } else {
        session.process.kill('SIGTERM')
      }
    } catch (err) {
      this.logger.error('Failed to stop session', { sessionId, error: String(err) })
    }
  }

  stopAll(): void {
    for (const sessionId of this.sessions.keys()) {
      this.stop(sessionId)
    }
  }

  isRunning(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  private handleEvent(session: Session, event: Record<string, unknown>): void {
    const type = event.type as string
    const subtype = event.subtype as string | undefined

    if (type === 'system' && subtype === 'init') {
      session.sessionId = event.session_id as string
      session.initialized = true
      this.sessions.set(session.sessionId, session)
      this.bus.emit('session:init', { sessionId: session.sessionId })
      this.logger.info('CLI initialized', { sessionId: session.sessionId })
      return
    }

    const sessionId = session.sessionId
    if (!sessionId) return

    if (type === 'assistant') {
      if (subtype === 'text') {
        this.bus.emit('chat:stream', { sessionId, content: event.content as string })
      } else if (subtype === 'thinking') {
        this.bus.emit('chat:thinking', { sessionId, content: event.content as string })
      } else if (subtype === 'tool_use') {
        this.bus.emit('chat:tool_use', {
          sessionId,
          tool: { name: event.tool_name as string, input: event.tool_input as Record<string, unknown> },
        })
      }
    } else if (type === 'stream_event') {
      this.bus.emit('chat:stream', { sessionId, content: event.content as string })
    } else if (type === 'result') {
      this.bus.emit('chat:done', {
        sessionId,
        result: event as unknown as import('@easycc/shared').CLIDoneEvent,
      })
    }
  }
}
