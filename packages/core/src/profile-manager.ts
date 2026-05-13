import { readFile, writeFile, mkdirSync } from 'fs'
import { promisify } from 'util'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { createLogger } from './logger'
import type { Profile } from '../../shared/types'

const readFileAsync = promisify(readFile)
const writeFileAsync = promisify(writeFile)

interface StoredProfile extends Omit<Profile, 'apiKey'> {
  encryptedApiKey: string
}

export class ProfileManager {
  private dataDir: string
  private profilesPath: string
  private logger
  private encryptFn: (text: string) => string
  private decryptFn: (encrypted: string) => string

  constructor(
    dataDir: string,
    logDir: string,
    encrypt: (text: string) => string,
    decrypt: (encrypted: string) => string,
  ) {
    this.dataDir = dataDir
    this.profilesPath = join(dataDir, 'profiles.json')
    this.logger = createLogger('profile-manager', logDir)
    this.encryptFn = encrypt
    this.decryptFn = decrypt
    mkdirSync(dataDir, { recursive: true })
  }

  async list(): Promise<Profile[]> {
    const stored = await this.readStore()
    return stored.map((s) => ({
      ...s,
      apiKey: this.decryptFn(s.encryptedApiKey),
    }))
  }

  async get(id: string): Promise<Profile | null> {
    const profiles = await this.list()
    return profiles.find((p) => p.id === id) ?? null
  }

  async getDefault(): Promise<Profile | null> {
    const profiles = await this.list()
    return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null
  }

  async create(data: Omit<Profile, 'id'>): Promise<Profile> {
    const stored = await this.readStore()
    const profile: Profile = {
      ...data,
      id: randomUUID(),
    }

    // First profile auto-defaults
    if (stored.length === 0) {
      profile.isDefault = true
    }

    stored.push({
      ...profile,
      apiKey: undefined as unknown as string,
      encryptedApiKey: this.encryptFn(profile.apiKey),
    })

    await this.writeStore(stored)
    this.logger.info('Profile created', { id: profile.id, name: profile.name })
    return profile
  }

  async update(id: string, patch: Partial<Profile>): Promise<Profile> {
    const stored = await this.readStore()
    const index = stored.findIndex((s) => s.id === id)
    if (index === -1) throw new Error(`Profile not found: ${id}`)

    const updated = { ...stored[index] }
    if (patch.name !== undefined) updated.name = patch.name
    if (patch.apiUrl !== undefined) updated.apiUrl = patch.apiUrl
    if (patch.model !== undefined) updated.model = patch.model
    if (patch.systemPrompt !== undefined) updated.systemPrompt = patch.systemPrompt
    if (patch.apiKey !== undefined) {
      updated.encryptedApiKey = this.encryptFn(patch.apiKey)
    }

    stored[index] = updated
    await this.writeStore(stored)

    const profile: Profile = {
      ...updated,
      apiKey: patch.apiKey ?? this.decryptFn(updated.encryptedApiKey),
    }
    this.logger.info('Profile updated', { id })
    return profile
  }

  async delete(id: string): Promise<void> {
    const stored = await this.readStore()
    const index = stored.findIndex((s) => s.id === id)
    if (index === -1) return

    const wasDefault = stored[index].isDefault
    stored.splice(index, 1)

    // If deleted default, auto-assign to first remaining
    if (wasDefault && stored.length > 0) {
      stored[0].isDefault = true
    }

    await this.writeStore(stored)
    this.logger.info('Profile deleted', { id })
  }

  async setDefault(id: string): Promise<void> {
    const stored = await this.readStore()
    const target = stored.find((s) => s.id === id)
    if (!target) throw new Error(`Profile not found: ${id}`)

    for (const s of stored) {
      s.isDefault = s.id === id
    }

    await this.writeStore(stored)
    this.logger.info('Default profile set', { id })
  }

  async testConnection(id: string): Promise<boolean> {
    const profile = await this.get(id)
    if (!profile) return false

    try {
      const { execFile } = require('child_process')
      const { promisify } = require('util')
      const execFileAsync = promisify(execFile)

      const env = {
        ...process.env,
        ANTHROPIC_API_KEY: profile.apiKey,
        ...(profile.apiUrl !== 'https://api.anthropic.com'
          ? { ANTHROPIC_BASE_URL: profile.apiUrl }
          : {}),
      }

      await execFileAsync('claude', [
        '--output-format', 'json',
        '--model', profile.model,
        '-p', 'Say "ok"',
      ], { env, timeout: 15_000 })

      return true
    } catch (err) {
      this.logger.warn('Connection test failed', { id, error: String(err) })
      return false
    }
  }

  private async readStore(): Promise<StoredProfile[]> {
    try {
      const data = await readFileAsync(this.profilesPath, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private async writeStore(profiles: StoredProfile[]): Promise<void> {
    await writeFileAsync(this.profilesPath, JSON.stringify(profiles, null, 2), 'utf-8')
  }
}
