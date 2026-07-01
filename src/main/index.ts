import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage
} from 'electron'
import { join } from 'node:path'
import {
  load,
  getHistory,
  addHistory,
  removeHistory,
  clearHistory,
  getSnippets,
  saveSnippets,
  type Snippet
} from './store.js'

const POLL_INTERVAL_MS = 800

let tray: Tray | null = null
let win: BrowserWindow | null = null
let lastClipboardText = ''
// Set while we write to the clipboard ourselves so polling doesn't re-record it.
let selfCopiedText: string | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 680,
    minHeight: 420,
    show: false,
    title: 'TheDevTools',
    backgroundColor: '#1e1e20',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // In dev, electron-vite serves the renderer; in prod we load the built file.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })
}

function showWindow(): void {
  if (!win) {
    createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createTray(): void {
  // An empty image plus a text title keeps the app asset-free while still
  // showing a recognizable glyph in the macOS menu bar for quick access.
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('📋')
  tray.setToolTip('TheDevTools — clipboard & snippets')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open TheDevTools', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Clear clipboard history',
      click: () => {
        clearHistory()
        win?.webContents.send('history:update', getHistory())
      }
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])

  // Left click opens/focuses the main window; right click shows the menu.
  tray.on('click', () => showWindow())
  tray.on('right-click', () => tray?.popUpContextMenu(contextMenu))
}

function startClipboardWatcher(): void {
  lastClipboardText = clipboard.readText()
  setInterval(() => {
    const text = clipboard.readText()
    if (!text || text === lastClipboardText) return
    lastClipboardText = text
    if (text === selfCopiedText) {
      selfCopiedText = null
      return
    }
    if (addHistory(text)) {
      win?.webContents.send('history:update', getHistory())
    }
  }, POLL_INTERVAL_MS)
}

function copyToClipboard(text: string): void {
  selfCopiedText = text
  lastClipboardText = text
  clipboard.writeText(text)
}

function registerIpc(): void {
  ipcMain.handle('history:get', () => getHistory())
  ipcMain.handle('history:clear', () => {
    clearHistory()
    return getHistory()
  })
  ipcMain.handle('history:remove', (_event, text: string) => {
    removeHistory(text)
    return getHistory()
  })
  ipcMain.handle('snippets:get', () => getSnippets())
  ipcMain.handle('snippets:save', (_event, snippets: Snippet[]) => {
    saveSnippets(snippets)
    return getSnippets()
  })
  ipcMain.handle('clipboard:copy', (_event, text: string) => {
    copyToClipboard(text)
  })
}

app.whenReady().then(() => {
  load()

  createWindow()
  createTray()
  registerIpc()
  startClipboardWatcher()

  const shortcut = 'CommandOrControl+Shift+V'
  const registered = globalShortcut.register(shortcut, () => showWindow())
  if (!registered) {
    console.warn(`Failed to register global shortcut ${shortcut}`)
  }

  // macOS: re-open the window when the dock icon is clicked and none are open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      showWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS keep running so the tray and clipboard watcher stay alive;
  // elsewhere a closed window means quit.
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
