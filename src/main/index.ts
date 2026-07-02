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
  getEvents,
  saveEvents,
  type Snippet,
  type CalendarEvent
} from './store.js'

const POLL_INTERVAL_MS = 800
const LAUNCHER_WIDTH = 640
const LAUNCHER_HEIGHT = 440
const RENDERER_HTML = join(__dirname, '../renderer/index.html')

let tray: Tray | null = null
let launcher: BrowserWindow | null = null
let mainWin: BrowserWindow | null = null
let lastClipboardText = ''
// Set while we write to the clipboard ourselves so polling doesn't re-record it.
let selfCopiedText: string | null = null

function rendererUrl(hash: string): string | null {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return devUrl ? `${devUrl}#${hash}` : null
}

/* ---------------- Quick launcher (floating panel) ---------------- */

function createLauncher(): void {
  launcher = new BrowserWindow({
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
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

  launcher.setAlwaysOnTop(true, 'floating')
  launcher.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const url = rendererUrl('launcher')
  if (url) launcher.loadURL(url)
  else launcher.loadFile(RENDERER_HTML, { hash: 'launcher' })

  launcher.on('blur', () => {
    if (launcher && !launcher.webContents.isDevToolsOpened()) launcher.hide()
  })
}

function positionLauncher(): void {
  if (!launcher) return
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { workArea } = display
  const [w, h] = launcher.getSize()
  const x = Math.round(workArea.x + (workArea.width - w) / 2)
  const y = Math.round(workArea.y + workArea.height * 0.2)
  launcher.setPosition(x, Math.min(y, workArea.y + workArea.height - h - 20), false)
}

function showLauncher(): void {
  if (!launcher) createLauncher()
  if (!launcher) return
  positionLauncher()
  launcher.show()
  launcher.focus()
  launcher.webContents.send('window:shown')
}

function toggleLauncher(): void {
  if (launcher?.isVisible()) launcher.hide()
  else showLauncher()
}

/* ---------------- Main window (calendar & tools) ---------------- */

function createMainWindow(): void {
  mainWin = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    show: false,
    title: 'TheDevTools',
    backgroundColor: '#1e1e20',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  const url = rendererUrl('main')
  if (url) mainWin.loadURL(url)
  else mainWin.loadFile(RENDERER_HTML, { hash: 'main' })

  mainWin.once('ready-to-show', () => mainWin?.show())
  mainWin.on('closed', () => {
    mainWin = null
    // Back to menu-bar-only once the app window is gone.
    if (process.platform === 'darwin') app.dock?.hide()
  })
}

function openMainWindow(): void {
  // Give the app a dock icon while a real window is open.
  if (process.platform === 'darwin') app.dock?.show()
  if (!mainWin) {
    createMainWindow()
    return
  }
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.show()
  mainWin.focus()
}

/* ---------------- Clipboard ---------------- */

function broadcast(channel: string, payload: unknown): void {
  for (const w of [launcher, mainWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
  }
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
      broadcast('history:update', getHistory())
    }
  }, POLL_INTERVAL_MS)
}

function copyToClipboard(text: string): void {
  selfCopiedText = text
  lastClipboardText = text
  clipboard.writeText(text)
}

// Simulate Cmd+V in whatever app now has focus (needs Accessibility permission).
function simulatePaste(): void {
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

// From the launcher: copy, hide the floating panel so focus returns to the
// previous app, then paste. (The main window only copies — it never inserts.)
function pasteFromLauncher(text: string): void {
  copyToClipboard(text)
  launcher?.hide()
  simulatePaste()
}

/* ---------------- Tray ---------------- */

function createTray(): void {
  tray = new Tray(nativeImage.createEmpty())
  tray.setTitle('📋')
  tray.setToolTip('TheDevTools — ⌘⇧V for the launcher')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open TheDevTools', click: () => openMainWindow() },
    { label: 'Quick Launcher (⌘⇧V)', click: () => showLauncher() },
    { type: 'separator' },
    {
      label: 'Clear clipboard history',
      click: () => {
        clearHistory()
        broadcast('history:update', getHistory())
      }
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' }
  ])

  tray.on('click', () => openMainWindow())
  tray.on('right-click', () => tray?.popUpContextMenu(contextMenu))
}

/* ---------------- IPC ---------------- */

function registerIpc(): void {
  ipcMain.handle('history:get', () => getHistory())
  ipcMain.handle('history:clear', () => {
    clearHistory()
    broadcast('history:update', getHistory())
    return getHistory()
  })
  ipcMain.handle('history:remove', (_event, text: string) => {
    removeHistory(text)
    broadcast('history:update', getHistory())
    return getHistory()
  })
  ipcMain.handle('snippets:get', () => getSnippets())
  ipcMain.handle('snippets:save', (_event, snippets: Snippet[]) => {
    saveSnippets(snippets)
    return getSnippets()
  })
  ipcMain.handle('events:get', () => getEvents())
  ipcMain.handle('events:save', (_event, events: CalendarEvent[]) => {
    saveEvents(events)
    return getEvents()
  })
  ipcMain.handle('clipboard:copy', (_event, text: string) => copyToClipboard(text))
  ipcMain.handle('paste', (_event, text: string) => pasteFromLauncher(text))
  ipcMain.handle('window:hide', () => launcher?.hide())
  ipcMain.handle('window:open-main', () => openMainWindow())
}

/* ---------------- App lifecycle ---------------- */

app.whenReady().then(() => {
  load()

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  createLauncher()
  createTray()
  registerIpc()
  startClipboardWatcher()

  const shortcut = 'CommandOrControl+Shift+V'
  if (!globalShortcut.register(shortcut, () => toggleLauncher())) {
    console.warn(`Failed to register global shortcut ${shortcut}`)
  }

  app.on('activate', () => openMainWindow())
})

app.on('window-all-closed', () => {
  // Stay resident in the menu bar so the shortcut keeps working.
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
