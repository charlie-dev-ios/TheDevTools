# TheDevTools

A macOS productivity app that combines a **Raycast-style launcher** (clipboard
history + snippets, pasted straight into the app you were using) with a **main
window** that adds a **calendar** for scheduling. Built with Electron + React +
TypeScript.

The app has two surfaces:

- **Quick launcher** — a floating panel on `⌘⇧V` for fast paste.
- **Main window** — a normal window (menu-bar icon → *Open TheDevTools*) with a
  sidebar: **Calendar**, **Clipboard History**, **Snippets**.

## Features

### Launcher
- ⚡ **Floating launcher** — `⌘⇧V` pops up a centered, always-on-top search
  panel (works over full-screen apps). The search field is focused instantly.
- ⌨️ **Keyboard-first** — `↑`/`↓` to move, `↵` to select. The chosen text is
  pasted directly into the app you were in a moment ago.
- 🔍 **Unified search** across clipboard history and snippets in one list.

### Calendar
- 📅 **Month & Day views** with prev/next/today navigation.
- 🗓️ **Events** — create (click a day or an hour), edit title/date/time,
  delete. Click a day number to jump into its day view.
- 🖱️ **Drag to reschedule** — in the day view, drag an event to move it
  (15-minute snapping) or drag its bottom edge to change its duration.

### Shared
- 📋 **Clipboard history** — automatically records text you copy (deduped, most
  recent first, capped at 200 items).
- ✂️ **Snippets** — save reusable text (commands, boilerplate, addresses).
- 🍎 **Menu-bar resident** — lives in the menu bar; keeps recording clipboard
  changes in the background. A dock icon appears while the main window is open.
- 💾 **Local persistence** — history, snippets and events are stored as JSON in
  the app's user-data directory. Nothing leaves your machine.

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

Nothing appears on launch except the 📋 menu-bar icon.

- **Launcher:** press `⌘⇧V` to open the floating panel, type to filter, and
  press `↵` to paste the highlighted item into the app you were using. `Esc` or
  clicking away hides it.
- **Main window (calendar & tools):** click the menu-bar icon, or right-click it
  and choose *Open TheDevTools*. Use the sidebar to switch between Calendar,
  Clipboard History and Snippets.

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
    index.ts   launcher + main window, tray, clipboard watcher, paste, IPC
    store.ts   JSON persistence for history, snippets and events
  preload/
    index.ts   contextBridge API exposed to the renderer
  renderer/    React UI (one bundle; window hash selects the surface)
    index.html
    src/
      main.tsx          picks Launcher (#launcher) or MainApp (#main)
      Launcher.tsx      floating quick-paste panel
      MainApp.tsx       sidebar shell + history/snippets panels
      calendar/
        CalendarView.tsx   month/day toggle, navigation, event CRUD
        MonthView.tsx      month grid
        DayView.tsx        hour timeline with drag-to-reschedule
        EventModal.tsx     create/edit/delete an event
        date-utils.ts      zero-dependency date helpers
      components/
        SnippetEditor.tsx
```

## Roadmap ideas

- Pin favorite clipboard items
- Rich content (images, files) in history
- Configurable shortcut and history size
- Launch at login toggle
