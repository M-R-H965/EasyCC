import { ipcMain, BrowserWindow, app } from 'electron'
import { join } from 'path'
import { EventBus, ClaudeRunner, ClaudeInstaller, ProfileManager, FlowManager, MainMemory, ConversationStore } from '@easycc/core'
import type { CoreEventMap, RunnerOptions } from '@easycc/shared'
import type { PersistedConversation } from '@easycc/core'

let runner: ClaudeRunner
let bus: EventBus<CoreEventMap>

const encrypt = (text: string): string => {
  try {
    const { safeStorage } = require('electron')
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(text).toString('base64')
    }
  } catch {}
  return Buffer.from(text).toString('base64')
}

const decrypt = (encrypted: string): string => {
  try {
    const { safeStorage } = require('electron')
    if (safeStorage.isEncryptionAvailable()) {
      const result = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
      console.log('[decrypt] safeStorage result length:', result?.length, 'first5:', result?.slice(0,5))
      return result
    }
  } catch (e) {
    console.log('[decrypt] safeStorage failed:', e)
  }
  const fallback = Buffer.from(encrypted, 'base64').toString()
  console.log('[decrypt] base64 fallback length:', fallback?.length)
  return fallback
}

export function initIpc(): void {
  const dataDir = app.getPath('userData')
  const logDir = join(dataDir, 'logs')
  // In dev: __dirname is .../packages/main/dist → up 3 to repo root, then /flows
  // In prod: bundled flows live under process.resourcesPath/flows (see electron-builder.yml)
  const flowsDir = app.isPackaged
    ? join(process.resourcesPath, 'flows')
    : join(__dirname, '..', '..', '..', 'flows')

  bus = new EventBus<CoreEventMap>()
  runner = new ClaudeRunner(bus, logDir)
  const installer = new ClaudeInstaller(logDir)
  const profileManager = new ProfileManager(dataDir, logDir, encrypt, decrypt)
  const flowManager = new FlowManager(flowsDir, dataDir, logDir)
  const mainMemory = new MainMemory(join(dataDir, 'main-session'), logDir)
  const convStore = new ConversationStore(dataDir, logDir)

  function forwardEvent<K extends keyof CoreEventMap>(event: K) {
    bus.on(event, (payload) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send(`core:${String(event)}`, payload)
      }
    })
  }

  forwardEvent('chat:stream')
  forwardEvent('chat:thinking')
  forwardEvent('chat:tool_use')
  forwardEvent('chat:done')
  forwardEvent('chat:error')
  forwardEvent('session:init')
  forwardEvent('session:exit')

  ipcMain.handle('profile:list', () => profileManager.list())
  ipcMain.handle('profile:get', (_, id: string) => profileManager.get(id))
  ipcMain.handle('profile:getDefault', () => profileManager.getDefault())
  ipcMain.handle('profile:create', (_, data) => profileManager.create(data))
  ipcMain.handle('profile:update', (_, id: string, patch) => profileManager.update(id, patch))
  ipcMain.handle('profile:delete', (_, id: string) => profileManager.delete(id))
  ipcMain.handle('profile:setDefault', (_, id: string) => profileManager.setDefault(id))
  ipcMain.handle('profile:testConnection', (_, id: string) => profileManager.testConnection(id))

  ipcMain.handle('conversation:create', async (_, options: RunnerOptions) => runner.start(options))
  ipcMain.handle('conversation:send', (_, sessionId: string, message: string) => runner.send(sessionId, message))
  ipcMain.handle('conversation:stop', (_, sessionId: string) => runner.stop(sessionId))

  ipcMain.handle('flow:listAvailable', () => flowManager.listAvailable())
  ipcMain.handle('flow:get', (_, id: string) => flowManager.get(id))
  ipcMain.handle('flow:enable', (_, id: string) => flowManager.enable(id))
  ipcMain.handle('flow:disable', (_, id: string) => flowManager.disable(id))
  ipcMain.handle('flow:getByGroup', (_, group: string) => flowManager.getByGroup(group))

  ipcMain.handle('cc:getVersion', () => installer.getVersion())
  ipcMain.handle('cc:isInstalled', () => installer.isInstalled())
  ipcMain.handle('cc:install', () => installer.install())
  ipcMain.handle('cc:update', () => installer.update())

  ipcMain.handle('memory:read', () => mainMemory.read())
  ipcMain.handle('memory:append', (_, section: string, content: string) => mainMemory.append(section, content))
  ipcMain.handle('memory:compress', () => mainMemory.compress())

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('convstore:saveAll', (_, conversations: PersistedConversation[]) =>
    convStore.saveAll(conversations),
  )
  ipcMain.handle('convstore:loadAll', (_, flowDirs: string[]) =>
    convStore.loadAll(flowDirs),
  )
}

export { runner, bus }
