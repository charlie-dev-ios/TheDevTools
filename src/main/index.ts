import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen
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
const WINDOW_WIDTH = 380
const WINDOW_HEIGHT = 520

let tray: Tray | null = null
let win: BrowserWindow | null = null
let lastClipboardText = ''
// Set while we write to the clipboard ourselves so polling doesn't re-record it.
let selfCopiedText: string | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
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

  // Behave like a popover: hide when the user clicks away.
  win.on('blur', () => {
    if (win && !win.webContents.isDevToolsOpened()) {
      win.hide()
    }
  })
}

function positionWindowNearTray(): void {
  if (!win || !tray) return
  const trayBounds = tray.getBounds()
  const { workArea } = screen.getPrimaryDisplay()
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2)
  // Keep the window fully on screen horizontally.
  x = Math.max(workArea.x + 8, Math.min(x, workArea.x + workArea.width - WINDOW_WIDTH - 8))
  const y = Math.round(trayBounds.y + trayBounds.height + 4)
  win.setPosition(x, y, false)
}

function toggleWindow(): void {
  if (!win) return
  if (win.isVisible()) {
    win.hide()
    return
  }
  positionWindowNearTray()
  win.show()
  win.focus()
}

function createTray(): void {
  // An empty image plus a text title keeps the app asset-free while still
  // showing a recognizable glyph in the macOS menu bar.
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('📋')
  tray.setToolTip('TheDevTools — clipboard & snippets')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => toggleWindow() },
    { type: 'separator' },
    {
      label: 'Clear history',
      click: () => {
        clearHistory()
        win?.webContents.send('history:update', getHistory())
      }
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])

  // Left click toggles the popover; right click shows the menu.
  tray.on('click', () => toggleWindow())
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
  ipcMain.handle('window:hide', () => win?.hide())
}

app.whenReady().then(() => {
  load()

  // Menu-bar-only app: no dock icon on macOS.
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  createWindow()
  createTray()
  registerIpc()
  startClipboardWatcher()

  const shortcut = 'CommandOrControl+Shift+V'
  const registered = globalShortcut.register(shortcut, () => toggleWindow())
  if (!registered) {
    console.warn(`Failed to register global shortcut ${shortcut}`)
  }
})

app.on('window-all-closed', () => {
  // Stay alive in the menu bar even when the popover is closed.
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
