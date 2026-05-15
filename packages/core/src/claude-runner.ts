import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import type { CoreEventMap, RunnerOptions } from '@easycc/shared'
import { EventBus } from './event-bus'
import { createLogger } from './logger'

interface Session {
  process: ChildProcess
  sessionId: string
  initialized: boolean
  initTimer: ReturnType<typeof setTimeout> | null
  resolveInit?: (id: string) => void
  rejectInit?: (err: Error) => void
  options: RunnerOptions
}

const CLAUDE_CMD = process.platform === 'win32' ? 'claude.cmd' : 'claude'

export class ClaudeRunner extends EventEmitter {
  private sessions = new Map<string, Session>()
  private tombstones = new Map<string, number>()
  // Stores options for exited sessions so they can be respawned with --resume
  private exitedOptions = new Map<string, RunnerOptions>()
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

    if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt)
    if (options.bare) args.push('--bare')
    for (const dir of options.addDirs ?? []) args.push('--add-dir', dir)
    if (options.sessionId) args.push('--resume', options.sessionId)
    if (options.allowedTools && options.allowedTools.length > 0) {
      const tools = options.allowedTools.map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      args.push('--allowed-tools', tools.join(','))
    }
    if (options.settingsFile && existsSync(options.settingsFile)) {
      args.push('--settings', options.settingsFile)
    }

    const env: Record<string, string> = { ...process.env as Record<string, string> }
    if (options.env) Object.assign(env, options.env)

    const proc = spawn(CLAUDE_CMD, args, {
      cwd: options.cwd ?? process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(process.platform === 'win32' ? { shell: true } : {}),
    })

    this.logger.info('CLI spawned', {
      cmd: CLAUDE_CMD, args,
      cwd: options.cwd ?? process.cwd(),
      envKeys: Object.keys(options.env ?? {}),
      hasApiKey: !!(env.ANTHROPIC_API_KEY),
    })

    const session: Session = {
      process: proc, sessionId: '', initialized: false, initTimer: null, options,
    }

    // CLI needs stdin input before it emits system/init in --print mode
    if (options.firstMessage) {
      proc.stdin!.write(
        JSON.stringify({ type: 'user', message: { role: 'user', content: options.firstMessage } }) + '\n'
      )
    }

    const rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line) => {
      if (!line.trim()) return
      try { this.handleEvent(session, JSON.parse(line)) }
      catch { this.logger.warn('Failed to parse CLI output', { line: line.slice(0, 200) }) }
    })

    proc.stderr!.on('data', (data: Buffer) => {
      this.logger.warn('CLI stderr', { data: data.toString().slice(0, 500) })
    })

    proc.stdout!.on('data', (data: Buffer) => {
      this.logger.debug('CLI stdout raw', { data: data.toString().slice(0, 500) })
    })

    proc.on('exit', (code) => {
      if (session.initTimer) { clearTimeout(session.initTimer); session.initTimer = null }
      if (session.sessionId) {
        this.tombstones.set(session.sessionId, code ?? 0)
        // Save options so send() can respawn with --resume
        this.exitedOptions.set(session.sessionId, session.options)
        this.sessions.delete(session.sessionId)
        this.bus.emit('session:exit', { sessionId: session.sessionId, code })
        this.logger.info('CLI process exited', { sessionId: session.sessionId, code })
      } else {
        setImmediate(() => {
          if (!session.sessionId) {
            session.rejectInit?.(new Error(`CLI exited before init with code ${code}`))
          }
        })
      }
    })

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (session.sessionId) {
          this.logger.warn('Init timeout, continuing anyway', { sessionId: session.sessionId })
          resolve(session.sessionId)
        } else {
          reject(new Error('CLI failed to initialize'))
        }
      }, 30_000)

      session.initTimer = timeout
      session.resolveInit = resolve
      session.rejectInit = reject
    })
  }

  async send(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId)

    // --print mode: process exits after each turn, respawn with --resume
    if (!session && this.tombstones.has(sessionId)) {
      const opts = this.exitedOptions.get(sessionId)
      this.tombstones.delete(sessionId)
      this.exitedOptions.delete(sessionId)
      if (opts) {
        await this.start({ ...opts, sessionId, firstMessage: message })
      } else {
        this.logger.error('Cannot respawn: no saved options', { sessionId })
      }
      return
    }

    if (!session?.process.stdin?.writable) {
      this.logger.error('Cannot send: session not writable', { sessionId })
      return
    }

    session.process.stdin.write(
      JSON.stringify({ type: 'user', message: { role: 'user', content: message } }) + '\n'
    )
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
    for (const sessionId of this.sessions.keys()) this.stop(sessionId)
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
      if (session.initTimer) { clearTimeout(session.initTimer); session.initTimer = null }
      session.resolveInit?.(session.sessionId)
      this.bus.emit('session:init', { sessionId: session.sessionId })
      this.logger.info('CLI initialized', { sessionId: session.sessionId })
      return
    }

    const sessionId = session.sessionId
    if (!sessionId) return

    if (type === 'assistant') {
      const msg = event.message as { content: Array<{ type: string; text?: string; thinking?: string }> } | undefined
      if (!msg) return
      for (const block of msg.content ?? []) {
        if (block.type === 'text' && block.text) {
          this.bus.emit('chat:stream', { sessionId, content: block.text })
        } else if (block.type === 'thinking' && block.thinking) {
          this.bus.emit('chat:thinking', { sessionId, content: block.thinking })
        }
      }
    } else if (type === 'result') {
      this.bus.emit('chat:done', {
        sessionId,
        result: event as unknown as import('@easycc/shared').CLIDoneEvent,
      })
    }
  }
}
