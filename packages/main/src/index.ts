import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createMainWindow } from './window'
import { runner, bus } from './ipc-handlers'
import { MainMemory } from '@easycc/core'

const MAIN_SESSION_ID_FILE = 'main-session-id'

app.whenReady().then(async () => {
  createMainWindow()

  // Initialize Main Session
  const dataDir = app.getPath('userData')
  const mainSessionDir = join(dataDir, 'main-session')
  const memory = new MainMemory(mainSessionDir, join(dataDir, 'logs'))

  // Ensure warmup.md exists
  await memory.read()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  runner.stopAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  runner.stopAll()
})
