import { readdirSync, readFileSync, existsSync, writeFile, mkdirSync } from 'fs'
import { promisify } from 'util'
import { join } from 'path'
import matter from 'gray-matter'
import { createLogger } from './logger'
import type { FlowMeta } from '@easycc/shared'

const writeFileAsync = promisify(writeFile)

interface FlowState {
  enabled: string[]
  unlockedGroups: string[]
}

export class FlowManager {
  private flowsDir: string
  private statePath: string
  private logger
  private state: FlowState = { enabled: [], unlockedGroups: [] }

  constructor(flowsDir: string, dataDir: string, logDir: string) {
    this.flowsDir = flowsDir
    this.statePath = join(dataDir, 'flow-state.json')
    this.logger = createLogger('flow-manager', logDir)
    mkdirSync(dataDir, { recursive: true })
    this.loadState()
  }

  async listAvailable(): Promise<FlowMeta[]> {
    if (!existsSync(this.flowsDir)) return []

    const entries = readdirSync(this.flowsDir, { withFileTypes: true })
    const flows: FlowMeta[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const flowPath = join(this.flowsDir, entry.name)
      const flowMd = join(flowPath, 'FLOW.md')
      if (!existsSync(flowMd)) continue

      try {
        const meta = this.parseFlowMd(entry.name, flowMd)
        if (meta) flows.push(meta)
      } catch (err) {
        this.logger.warn('Failed to parse Flow', { dir: entry.name, error: String(err) })
      }
    }

    return flows
  }

  async get(id: string): Promise<FlowMeta | null> {
    const flowMd = join(this.flowsDir, id, 'FLOW.md')
    if (!existsSync(flowMd)) return null
    return this.parseFlowMd(id, flowMd) ?? null
  }

  enable(id: string): void {
    if (!this.state.enabled.includes(id)) {
      this.state.enabled.push(id)
      this.saveState()
    }
  }

  disable(id: string): void {
    this.state.enabled = this.state.enabled.filter((e) => e !== id)
    this.saveState()
  }

  isEnabled(id: string): boolean {
    return this.state.enabled.includes(id)
  }

  async getByGroup(group: string): Promise<FlowMeta[]> {
    const all = await this.listAvailable()
    return all.filter((f) => f.group === group)
  }

  isGroupUnlocked(group: string): boolean {
    return this.state.unlockedGroups.includes(group)
  }

  unlockGroup(group: string): void {
    if (!this.state.unlockedGroups.includes(group)) {
      this.state.unlockedGroups.push(group)
      this.saveState()
    }
  }

  isVisible(flow: FlowMeta): boolean {
    if (!flow.group) return true
    return this.isGroupUnlocked(flow.group)
  }

  private parseFlowMd(id: string, flowMdPath: string): FlowMeta | null {
    const content = readFileSync(flowMdPath, 'utf-8')
    const parsed = matter(content)
    const data = parsed.data

    if (!data.name || !data.version) {
      this.logger.warn('Flow missing required fields', { id, fields: Object.keys(data) })
      return null
    }

    return {
      id,
      name: data.name,
      description: data.description ?? '',
      version: String(data.version),
      tools: typeof data.tools === 'string' ? data.tools.split(',').map((t: string) => t.trim()) : (data.tools ?? []),
      group: data.group,
      dir: join(this.flowsDir, id),
      body: parsed.content,
    }
  }

  private loadState(): void {
    try {
      if (existsSync(this.statePath)) {
        const data = readFileSync(this.statePath, 'utf-8')
        this.state = JSON.parse(data)
      }
    } catch {
      this.state = { enabled: [], unlockedGroups: [] }
    }
  }

  private saveState(): void {
    writeFileAsync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8').catch(() => {})
  }
}
