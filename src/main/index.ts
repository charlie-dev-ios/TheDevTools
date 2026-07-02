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
import { exec } from 'node:child_process'
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
const WINDOW_WIDTH = 640
const WINDOW_HEIGHT = 440

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
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // Float above other apps, including full-screen spaces (Raycast-style).
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // In dev, electron-vite serves the renderer; in prod we load the built file.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Dismiss when the user clicks away, like a launcher panel.
  win.on('blur', () => {
    if (win && !win.webContents.isDevToolsOpened()) win.hide()
  })
}

function positionWindow(): void {
  if (!win) return
  // Center horizontally on whichever display holds the cursor, upper third.
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { workArea } = display
  const [w, h] = win.getSize()
  const x = Math.round(workArea.x + (workArea.width - w) / 2)
  const y = Math.round(workArea.y + workArea.height * 0.2)
  win.setPosition(x, Math.min(y, workArea.y + workArea.height - h - 20), false)
}

function showWindow(): void {
  if (!win) createWindow()
  if (!win) return
  positionWindow()
  win.show()
  win.focus()
  // Tell the renderer to reset the query, selection and focus the search box.
  win.webContents.send('window:shown')
}

function toggleWindow(): void {
  if (win?.isVisible()) {
    win.hide()
  } else {
    showWindow()
  }
}

function createTray(): void {
  // An empty image plus a text title keeps the app asset-free while still
  // showing a recognizable glyph in the macOS menu bar.
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('📋')
  tray.setToolTip('TheDevTools — ⌘⇧V to open')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open (⌘⇧V)', click: () => showWindow() },
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

// Put the text on the clipboard, hide the panel so focus returns to the app
// the user was in, then simulate Cmd+V to insert it there.
function pasteIntoPreviousApp(text: string): void {
  copyToClipboard(text)
  win?.hide()
  if (process.platform !== 'darwin') return
  setTimeout(() => {
    exec(
      "osascript -e 'tell application \"System Events\" to keystroke \"v\" using {command down}'",
      (err) => {
        if (err) {
          console.error(
            'Paste failed — grant Accessibility permission in System Settings:',
            err.message
          )
        }
      }
    )
  }, 120)
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
  ipcMain.handle('paste', (_event, text: string) => pasteIntoPreviousApp(text))
  ipcMain.handle('window:hide', () => win?.hide())
}

app.whenReady().then(() => {
  load()

  // Launcher-style app: live in the menu bar, no dock icon.
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
  // Stay resident in the menu bar so the shortcut keeps working.
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
