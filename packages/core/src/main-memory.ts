import { readFile, writeFile, existsSync, mkdirSync } from 'fs'
import { promisify } from 'util'
import { join } from 'path'
import { createLogger } from './logger'

const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)

const DEFAULT_TEMPLATE = `# Main Memory

## Recent

## History

## Topics
`

const MAX_RECENT_ITEMS = 10

export class MainMemory {
  private filePath: string
  private logger

  constructor(dataDir: string, logDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.filePath = join(dataDir, 'warmup.md')
    this.logger = createLogger('main-memory', logDir)
  }

  async read(): Promise<string> {
    try {
      if (!existsSync(this.filePath)) {
        await writeFileAsync(this.filePath, DEFAULT_TEMPLATE, 'utf-8')
        return DEFAULT_TEMPLATE
      }
      return await readFileAsync(this.filePath, 'utf-8')
    } catch (err) {
      this.logger.error('Failed to read warmup.md', { error: String(err) })
      return DEFAULT_TEMPLATE
    }
  }

  async append(section: string, content: string): Promise<void> {
    let text = await this.read()
    const sectionHeader = `## ${section}`

    const sectionIndex = text.indexOf(sectionHeader)
    if (sectionIndex === -1) {
      // Section doesn't exist, append before the last empty line or at end
      const insertPoint = text.trimEnd().length
      text = text.slice(0, insertPoint) + `\n\n${sectionHeader}\n- ${content}\n`
    } else {
      // Insert after section header
      const afterHeader = sectionIndex + sectionHeader.length
      const nextSection = text.indexOf('\n## ', afterHeader)
      const insertPoint = nextSection !== -1 ? nextSection : text.length

      const sectionContent = text.slice(afterHeader, insertPoint)
      const newEntry = sectionContent.trim() ? `\n- ${content}` : `\n- ${content}`

      text = text.slice(0, insertPoint) + newEntry + text.slice(insertPoint)
    }

    await writeFileAsync(this.filePath, text, 'utf-8')
    this.logger.info('Appended to section', { section })
  }

  async compress(): Promise<void> {
    const text = await this.read()
    const recentSection = this.extractSection(text, 'Recent')

    if (!recentSection) return

    const items = recentSection
      .split('\n')
      .filter((line) => line.trim().startsWith('- '))

    if (items.length <= MAX_RECENT_ITEMS) return

    // Move all but last MAX_RECENT_ITEMS to History
    const toArchive = items.slice(0, items.length - MAX_RECENT_ITEMS)
    const toKeep = items.slice(items.length - MAX_RECENT_ITEMS)

    // Rebuild text
    let newText = text

    // Replace Recent section content
    const recentHeader = '## Recent'
    const recentStart = newText.indexOf(recentHeader) + recentHeader.length
    const nextSection = newText.indexOf('\n## ', recentStart)
    const recentEnd = nextSection !== -1 ? nextSection : newText.length

    newText = newText.slice(0, recentStart)
      + '\n' + toKeep.join('\n') + '\n'
      + newText.slice(recentEnd)

    // Append to History
    const historyHeader = '## History'
    const historyStart = newText.indexOf(historyHeader)
    if (historyStart !== -1) {
      const afterHeader = historyStart + historyHeader.length
      const nextHistSection = newText.indexOf('\n## ', afterHeader)
      const historyEnd = nextHistSection !== -1 ? nextHistSection : newText.length
      const existingHistory = newText.slice(afterHeader, historyEnd)

      newText = newText.slice(0, afterHeader)
        + existingHistory
        + toArchive.join('\n') + '\n'
        + newText.slice(historyEnd)
    }

    await writeFileAsync(this.filePath, newText, 'utf-8')
    this.logger.info('Memory compressed', { archived: toArchive.length, kept: toKeep.length })
  }

  private extractSection(text: string, sectionName: string): string | null {
    const header = `## ${sectionName}`
    const start = text.indexOf(header)
    if (start === -1) return null

    const afterHeader = start + header.length
    const nextSection = text.indexOf('\n## ', afterHeader)
    const end = nextSection !== -1 ? nextSection : text.length

    return text.slice(afterHeader, end)
  }
}
