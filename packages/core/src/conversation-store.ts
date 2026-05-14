import { readFile, writeFile, mkdirSync, existsSync } from 'fs'
import { promisify } from 'util'
import { join } from 'path'
import { createLogger } from './logger'
import type { ChatMessage } from '@easycc/shared'

const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)

export interface PersistedConversation {
  id: string
  title: string
  flowId: string | null
  flowName: string | null
  flowDir: string | null
  profileId: string
  sessionId: string | null
  messages: ChatMessage[]
  createdAt: number
}

export class ConversationStore {
  private fallbackDir: string // for non-flow conversations
  private logger

  constructor(dataDir: string, logDir: string) {
    mkdirSync(dataDir, { recursive: true })
    this.fallbackDir = dataDir
    this.logger = createLogger('conversation-store', logDir)
  }

  async saveAll(conversations: PersistedConversation[]): Promise<void> {
    // Group by flowDir; conversations without a flow go to fallbackDir
    const groups = new Map<string, PersistedConversation[]>()
    for (const conv of conversations) {
      const dir = conv.flowDir ?? this.fallbackDir
      if (!groups.has(dir)) groups.set(dir, [])
      groups.get(dir)!.push(conv)
    }

    await Promise.all([
      // Per-flow files (full messages)
      ...Array.from(groups.entries()).map(async ([dir, convs]) => {
        try {
          mkdirSync(dir, { recursive: true })
          await writeFileAsync(join(dir, 'conversations.json'), JSON.stringify(convs, null, 2), 'utf-8')
        } catch (err) {
          this.logger.error('Failed to save conversations', { dir, error: String(err) })
        }
      }),
      // Global index (metadata only — no messages — for cross-flow overview)
      writeFileAsync(
        join(this.fallbackDir, 'all-conversations.json'),
        JSON.stringify(
          conversations.map(({ id, title, flowId, flowName, profileId, sessionId, createdAt, messages }) => ({
            id, title, flowId, flowName, profileId, sessionId, createdAt,
            messageCount: messages.length,
            lastMessageAt: messages[messages.length - 1]?.timestamp ?? createdAt,
          })),
          null, 2,
        ),
        'utf-8',
      ).catch((err) => this.logger.error('Failed to save global index', { error: String(err) })),
    ])
  }

  async loadAll(flowDirs: string[]): Promise<PersistedConversation[]> {
    const dirs = [...new Set([this.fallbackDir, ...flowDirs])]
    const results = await Promise.all(
      dirs.map(async (dir) => {
        const file = join(dir, 'conversations.json')
        if (!existsSync(file)) return []
        try {
          const data = await readFileAsync(file, 'utf-8')
          return JSON.parse(data) as PersistedConversation[]
        } catch (err) {
          this.logger.warn('Failed to load conversations', { dir, error: String(err) })
          return []
        }
      }),
    )
    return results.flat()
  }
}
