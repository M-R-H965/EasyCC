import { execFile } from 'child_process'
import { promisify } from 'util'
import { createLogger } from './logger'

const execFileAsync = promisify(execFile)

export class ClaudeInstaller {
  private logger

  constructor(logDir: string) {
    this.logger = createLogger('claude-installer', logDir)
  }

  async getVersion(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('claude', ['--version'])
      const match = stdout.trim().match(/(\d+\.\d+\.\d+)/)
      return match ? match[1] : stdout.trim()
    } catch {
      return null
    }
  }

  async isInstalled(): Promise<boolean> {
    const version = await this.getVersion()
    return version !== null
  }

  async install(): Promise<void> {
    this.logger.info('Installing Claude Code CLI')
    try {
      const { stdout, stderr } = await execFileAsync('npm', ['install', '-g', '@anthropic-ai/claude-code'])
      this.logger.info('Claude Code CLI installed', { stdout: stdout.slice(0, 200) })
    } catch (err) {
      this.logger.error('Failed to install Claude Code CLI', { error: String(err) })
      throw new Error('Failed to install Claude Code CLI')
    }
  }

  async update(): Promise<void> {
    this.logger.info('Updating Claude Code CLI')
    try {
      const { stdout } = await execFileAsync('npm', ['update', '-g', '@anthropic-ai/claude-code'])
      this.logger.info('Claude Code CLI updated', { stdout: stdout.slice(0, 200) })
    } catch (err) {
      this.logger.error('Failed to update Claude Code CLI', { error: String(err) })
      throw new Error('Failed to update Claude Code CLI')
    }
  }
}
