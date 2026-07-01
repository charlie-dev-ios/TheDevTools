# TheDevTools

A lightweight menu-bar utility for macOS that keeps a **clipboard history** and
a library of reusable **snippets**. Built with Electron + React + TypeScript.

## Features

- 📋 **Clipboard history** — automatically records text you copy (deduped, most
  recent first, capped at 200 items) and lets you re-copy any entry with a click.
- ✂️ **Snippets** — save frequently used text (commands, boilerplate, addresses)
  with a title and paste it back instantly.
- 🔍 **Search** across history and snippets.
- ⌨️ **Global shortcut** — `⌘⇧V` opens the popover from anywhere.
- 🍎 **Menu-bar only** — runs quietly in the menu bar with no dock icon.
- 💾 **Local persistence** — data is stored as JSON in the app's user-data
  directory. Nothing leaves your machine.

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron |
| UI | React 18 + TypeScript |
| Bundler | Vite (via `electron-vite`) |
| Packaging | `electron-builder` (`.dmg`) |

## Getting started

```bash
npm install      # install dependencies (downloads Electron)
npm run dev      # launch the app in development with hot reload
```

The window is a popover anchored to the menu-bar icon. Click the 📋 icon or
press `⌘⇧V` to toggle it. Right-click the icon for a menu (Open / Clear history
/ Quit).

## Building a distributable

```bash
npm run build        # type-check + bundle main, preload and renderer
npm run dist:mac     # produce a .dmg in ./release (run on macOS)
```

> Packaging a macOS `.dmg` must be done on a Mac. `npm run build` (bundling)
> works on any platform.

## Project structure

```
src/
  main/        Electron main process
    index.ts   window, tray, clipboard watcher, global shortcut, IPC
    store.ts   JSON persistence for history + snippets
  preload/
    index.ts   contextBridge API exposed to the renderer
  renderer/    React UI
    index.html
    src/
      App.tsx
      components/
        HistoryTab.tsx
        SnippetsTab.tsx
```

## Roadmap ideas

- Pin favorite clipboard items
- Rich content (images, files) in history
- Configurable shortcut and history size
- Launch at login toggle
