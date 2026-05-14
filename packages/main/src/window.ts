import { app, BrowserWindow } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

const isDev = !app.isPackaged && process.env.EASYCC_DEV === '1'

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'EasyCC',
    webPreferences: {
      preload: join(__dirname, '..', '..', 'preload', 'dist', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '..', '..', 'renderer', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
