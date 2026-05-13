import { createWriteStream, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join, basename } from 'path'

const SENSITIVE_KEYS = ['apiKey', 'api_key', 'token', 'password', 'secret', 'authorization']
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_LOG_FILES = 5

function sanitize(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return meta
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    result[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))
      ? '***'
      : value
  }
  return result
}

function getTimestamp(): string {
  return new Date().toISOString()
}

function getCurrentLogFile(logDir: string): string {
  const date = new Date().toISOString().slice(0, 10)
  return join(logDir, `easycc-${date}.log`)
}

function rotateIfNeeded(logDir: string): void {
  try {
    const currentLog = getCurrentLogFile(logDir)
    if (!existsSync(currentLog)) return
    if (statSync(currentLog).size < MAX_LOG_SIZE) return

    const files = readdirSync(logDir)
      .filter((f) => f.endsWith('.log'))
      .sort()
      .reverse()

    // Remove oldest files beyond limit
    while (files.length >= MAX_LOG_FILES) {
      const oldest = files.pop()!
      unlinkSync(join(logDir, oldest))
    }
  } catch {
    // Rotation failure should not break the app
  }
}

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string, meta?: Record<string, unknown>): void
}

export function createLogger(module: string, logDir: string): Logger {
  mkdirSync(logDir, { recursive: true })

  const log = (level: string, msg: string, meta?: Record<string, unknown>) => {
    rotateIfNeeded(logDir)
    const entry = {
      timestamp: getTimestamp(),
      level,
      module,
      message: msg,
      ...(meta ? { meta: sanitize(meta) } : {}),
    }
    const line = JSON.stringify(entry) + '\n'

    try {
      const stream = createWriteStream(getCurrentLogFile(logDir), { flags: 'a' })
      stream.write(line)
      stream.end()
    } catch {
      // Logging failure should not break the app
    }

    if (level === 'error' || level === 'warn') {
      console[level](`[${module}] ${msg}`, meta ? sanitize(meta) : '')
    }
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  }
}
