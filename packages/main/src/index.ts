import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { createMainWindow } from './window'
import { initIpc } from './ipc-handlers'
import { MainMemory } from '@easycc/core'

app.whenReady().then(async () => {
  initIpc()
  createMainWindow()

  const dataDir = app.getPath('userData')
  const memory = new MainMemory(join(dataDir, 'main-session'), join(dataDir, 'logs'))
  await memory.read()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  // runner may be undefined if app quits before ready
  try {
    const { runner } = require('./ipc-handlers')
    runner?.stopAll()
  } catch {}
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  try {
    const { runner } = require('./ipc-handlers')
    runner?.stopAll()
  } catch {}
})
