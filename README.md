# TheDevTools

A desktop app for macOS that keeps a **clipboard history** and a library of
reusable **snippets**. A normal window with a left sidebar to switch between the
two sections. Built with Electron + React + TypeScript.

## Features

- 🗂️ **Sidebar navigation** — a normal app window with a left sidebar to switch
  between Clipboard History and Snippets.
- 📋 **Clipboard history** — automatically records text you copy (deduped, most
  recent first, capped at 200 items) and lets you re-copy any entry with a click.
- ✂️ **Snippets** — save frequently used text (commands, boilerplate, addresses)
  with a title and paste it back instantly.
- 🔍 **Search** within each section.
- ⌨️ **Global shortcut** — `⌘⇧V` brings the window to the front from anywhere.
- 🍎 **Menu-bar quick access** — a 📋 tray icon reopens the window and stays
  resident so history keeps recording in the background.
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

The app opens a normal resizable window on launch. Use the left sidebar to
switch between Clipboard History and Snippets. Press `⌘⇧V` or click the 📋
menu-bar icon to bring it to the front; right-click the icon for a menu
(Open / Clear clipboard history / Quit).

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
