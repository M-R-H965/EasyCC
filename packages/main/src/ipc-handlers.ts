import { ipcMain, BrowserWindow } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import { EventBus } from '@easycc/core'
import { ClaudeRunner } from '@easycc/core'
import { ClaudeInstaller } from '@easycc/core'
import { ProfileManager } from '@easycc/core'
import { FlowManager } from '@easycc/core'
import { MainMemory } from '@easycc/core'
import type { CoreEventMap, RunnerOptions } from '../../shared/types'

const dataDir = app.getPath('userData')
const logDir = join(dataDir, 'logs')
const flowsDir = join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'flows')

const bus = new EventBus<CoreEventMap>()
const runner = new ClaudeRunner(bus, logDir)
const installer = new ClaudeInstaller(logDir)

// Encryption stubs — main process should use electron.safeStorage in production
const encrypt = (text: string): string => {
  try {
    const { safeStorage } = require('electron')
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(text).toString('base64')
    }
  } catch {}
  // Fallback: base64 (NOT secure, replace in production)
  return Buffer.from(text).toString('base64')
}

const decrypt = (encrypted: string): string => {
  try {
    const { safeStorage } = require('electron')
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
  } catch {}
  return Buffer.from(encrypted, 'base64').toString()
}

const profileManager = new ProfileManager(dataDir, logDir, encrypt, decrypt)
const flowManager = new FlowManager(flowsDir, dataDir, logDir)
const mainMemory = new MainMemory(join(dataDir, 'main-session'), logDir)

// Forward core events to renderer
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

// ── Profile IPC ──

ipcMain.handle('profile:list', () => profileManager.list())
ipcMain.handle('profile:get', (_, id: string) => profileManager.get(id))
ipcMain.handle('profile:getDefault', () => profileManager.getDefault())
ipcMain.handle('profile:create', (_, data) => profileManager.create(data))
ipcMain.handle('profile:update', (_, id: string, patch) => profileManager.update(id, patch))
ipcMain.handle('profile:delete', (_, id: string) => profileManager.delete(id))
ipcMain.handle('profile:setDefault', (_, id: string) => profileManager.setDefault(id))
ipcMain.handle('profile:testConnection', (_, id: string) => profileManager.testConnection(id))

// ── Conversation IPC ──

ipcMain.handle('conversation:create', async (_, options: RunnerOptions) => {
  return runner.start(options)
})

ipcMain.handle('conversation:send', (_, sessionId: string, message: string) => {
  runner.send(sessionId, message)
})

ipcMain.handle('conversation:stop', (_, sessionId: string) => {
  runner.stop(sessionId)
})

// ── Flow IPC ──

ipcMain.handle('flow:listAvailable', () => flowManager.listAvailable())
ipcMain.handle('flow:get', (_, id: string) => flowManager.get(id))
ipcMain.handle('flow:enable', (_, id: string) => flowManager.enable(id))
ipcMain.handle('flow:disable', (_, id: string) => flowManager.disable(id))
ipcMain.handle('flow:getByGroup', (_, group: string) => flowManager.getByGroup(group))

// ── CC IPC ──

ipcMain.handle('cc:getVersion', () => installer.getVersion())
ipcMain.handle('cc:isInstalled', () => installer.isInstalled())
ipcMain.handle('cc:install', () => installer.install())
ipcMain.handle('cc:update', () => installer.update())

// ── Memory IPC ──

ipcMain.handle('memory:read', () => mainMemory.read())
ipcMain.handle('memory:append', (_, section: string, content: string) => mainMemory.append(section, content))
ipcMain.handle('memory:compress', () => mainMemory.compress())

// ── App IPC ──

ipcMain.handle('app:getVersion', () => app.getVersion())

export { runner, bus }
