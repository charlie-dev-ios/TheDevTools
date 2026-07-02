# TheDevTools

A Raycast-style launcher for macOS that keeps a **clipboard history** and a
library of reusable **snippets**. Hit a global shortcut, a floating search
panel appears, pick an item with the keyboard, and it is pasted straight into
whatever app you were using. Built with Electron + React + TypeScript.

## Features

- ⚡ **Floating launcher** — `⌘⇧V` pops up a centered, always-on-top search
  panel (works over full-screen apps). The search field is focused instantly.
- ⌨️ **Keyboard-first** — `↑`/`↓` to move, `↵` to select. The chosen text is
  pasted directly into the app you were in a moment ago.
- 📋 **Clipboard history** — automatically records text you copy (deduped, most
  recent first, capped at 200 items).
- ✂️ **Snippets** — save reusable text (commands, boilerplate, addresses).
  `⌘N` creates one; hover a row to edit or delete.
- 🔍 **Unified search** across clipboard history and snippets in one list.
- 🍎 **Menu-bar resident** — lives in the menu bar with no dock icon; keeps
  recording clipboard changes in the background.
- 💾 **Local persistence** — data is stored as JSON in the app's user-data
  directory. Nothing leaves your machine.

## Required macOS permission

To paste into the previously focused app, TheDevTools simulates `⌘V` via an
AppleScript keystroke, which needs **Accessibility** permission:

> System Settings → Privacy & Security → Accessibility → enable the app
> (in `npm run dev` this is "Electron" or your terminal).

Without it, the selected text is still placed on the clipboard — you just paste
it yourself with `⌘V`.

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

Nothing appears on launch except the 📋 menu-bar icon. Press `⌘⇧V` (or click
the icon) to open the floating panel, type to filter, and press `↵` to paste
the highlighted item into the app you were using. `Esc` or clicking away hides
the panel. Right-click the icon for a menu (Open / Clear clipboard history /
Quit).

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
    index.ts   floating panel, tray, clipboard watcher, shortcut, paste, IPC
    store.ts   JSON persistence for history + snippets
  preload/
    index.ts   contextBridge API exposed to the renderer
  renderer/    React UI
    index.html
    src/
      App.tsx           launcher: search, results, keyboard navigation
      components/
        SnippetEditor.tsx
```

## Roadmap ideas

- Pin favorite clipboard items
- Rich content (images, files) in history
- Configurable shortcut and history size
- Launch at login toggle
