# TheDevTools

A macOS productivity app that combines a **Raycast-style launcher** (clipboard
history + snippets, pasted straight into the app you were using) with a **main
window** that adds a **calendar**, **todos** and **time tracking**. Built with
Electron + React + TypeScript.

The app has two surfaces:

- **Quick launcher** — a floating panel on `⌘⇧V` for fast paste.
- **Main window** — a normal window (menu-bar icon → *Open TheDevTools*) with a
  sidebar: **Calendar**, **Todos**, **Time Tracking**, **Aggregation**,
  **Projects**, **Hashtags**, **Clipboard History**, **Snippets**.

## Features

### Launcher
- ⚡ **Floating launcher** — `⌘⇧V` pops up a centered, always-on-top search
  panel (works over full-screen apps). The search field is focused instantly.
- ⌨️ **Keyboard-first** — `↑`/`↓` to move, `↵` to select. The chosen text is
  pasted directly into the app you were in a moment ago.
- 🔍 **Unified search** across clipboard history and snippets in one list.

### Calendar
- 📅 **Month & Day views** with prev/next/today navigation. The day view shows
  an hour timeline with a live current-time indicator.
- 🗓️ **Events** — create (click a day or an hour), edit title/description/
  date/time, delete. Click a day number to jump into its day view.
- 🏷️ **Project & hashtag tags** — tag an event with a project and a hashtag
  (autocompleted from the shared catalogs, same as time entries) so plans and
  tracked time share one vocabulary; the tags show as chips on the day view.
- 🔁 **Repeating events** — daily/weekly/monthly series; delete a single
  occurrence or the whole series.
- 🔔 **Reminders** — desktop notifications 10 and 5 minutes before an event's
  start and its end. Toggle them off per event in the editor.
- 🖱️ **Drag to reschedule** — in the day view, drag an event to move it
  (15-minute snapping) or drag its bottom edge to change its duration.
- 🔎 **Zoomable timeline** — adjust the day-view hour height; the zoom is
  remembered between sessions.
- ⏱️ **"Actual" overlay** — toggle tracked time entries on top of the calendar
  to compare planned events against what you actually worked on, and add or
  edit tracked entries right from the calendar.

### Todos
- ✅ **Due dates** with overdue / today / upcoming status.
- 🔁 **Repeats** — daily, weekly, monthly, or specific weekdays. The next
  occurrence is created automatically once the current one is done and its day
  arrives (missed occurrences while the app was closed are collapsed to the
  latest).
- ☑️ **Subtasks** — a checklist of smaller steps under each todo, with progress.
- 🧹 Completed todos collect in their own section with a **Clear completed**.

### Time Tracking
- ⏱️ **Timer** — start / pause / resume / stop against a task, with optional
  subtask, project and `#hashtag`.
- 💡 **Autocomplete** — task and subtask fields suggest from your open todos and
  their subtasks.
- ✍️ **Manual entries** — add or edit past entries by hand; restart the timer
  from any previous entry.

### Aggregation
- 📊 **Effort totals** — summarize tracked time grouped by **task**, **project**
  or **hashtag**.
- 🗓️ **Scoped periods** — view a single day, week or month with
  prev/next/today navigation.
- 📈 Each bucket shows its total effort, a proportional bar, entry count and
  share of the period.

### Projects & Hashtags
- 📁 **Projects** — create, edit and delete named projects (with an optional
  description and color) used to organize time entries.
- #️⃣ **Hashtags** — manage a color-coded set of tags; names are normalized
  (leading `#` stripped) and kept case-insensitively unique.

### Shared
- 📋 **Clipboard history** — automatically records text you copy (deduped, most
  recent first, capped at 200 items).
- ✂️ **Snippets** — save reusable text (commands, boilerplate, addresses).
- 🍎 **Menu-bar resident** — lives in the menu bar; keeps recording clipboard
  changes in the background. A dock icon appears while the main window is open.
- 💾 **Local persistence** — history, snippets, events, todos and time entries
  are stored as JSON in the app's user-data directory. Nothing leaves your
  machine.

## Required macOS permission

To paste into the previously focused app, TheDevTools simulates `⌘V` via an
AppleScript keystroke, which needs **Accessibility** permission:

> System Settings → Privacy & Security → Accessibility → enable the app
> (in `bun run dev` this is "Electron" or your terminal).

Without it, the selected text is still placed on the clipboard — you just paste
it yourself with `⌘V`.

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron |
| UI | React 18 + TypeScript |
| Bundler | Vite (via `electron-vite`) |
| Packaging | `electron-builder` (`.dmg`) |
| Toolchain | [mise](https://mise.jdx.dev) — Bun (primary) + Node 22 (fallback) |

## Getting started

The toolchain is pinned in `mise.toml` (Bun as the primary runtime, Node 22 as
a fallback for `electron-builder`). The `package.json` scripts are
runner-agnostic, so `bun run …` and `npm run …` both work.

```bash
mise install     # install the pinned Bun + Node (optional but recommended)
bun install      # install dependencies (downloads Electron)
bun run dev      # launch the app in development with hot reload
```

Nothing appears on launch except the 📋 menu-bar icon.

- **Launcher:** press `⌘⇧V` to open the floating panel, type to filter, and
  press `↵` to paste the highlighted item into the app you were using. `Esc` or
  clicking away hides it.
- **Main window (calendar & tools):** click the menu-bar icon, or right-click it
  and choose *Open TheDevTools*. Use the sidebar to switch between Calendar,
  Todos, Time Tracking, Aggregation, Projects, Hashtags, Clipboard History and
  Snippets.

## Building a distributable

```bash
bun run build        # type-check + bundle main, preload and renderer
bun run dist:mac     # produce a .dmg in ./release (run on macOS)
```

> Packaging a macOS `.dmg` must be done on a Mac. `bun run build` (bundling)
> works on any platform. `bun run typecheck` runs the TypeScript compiler on
> its own.

## Project structure

```
src/
  main/        Electron main process
    index.ts   launcher + main window, tray, clipboard watcher, paste, IPC
    store.ts   JSON persistence + repeating-todo roll-forward
  preload/
    index.ts   contextBridge API exposed to the renderer
  renderer/    React UI (one bundle; window hash selects the surface)
    index.html
    src/
      main.tsx          picks Launcher (#launcher) or MainApp (#main)
      Launcher.tsx      floating quick-paste panel
      MainApp.tsx       sidebar shell + history/snippets panels
      types.ts          shared renderer-side types
      calendar/
        CalendarView.tsx     month/day toggle, navigation, event CRUD,
                             repeating series, "Actual" overlay
        MonthView.tsx        month grid
        DayView.tsx          hour timeline with drag-to-reschedule + zoom
        EventModal.tsx       create/edit/delete an event (month view)
        EventPanel.tsx       day-view side panel for editing an event
        TimeStepper.tsx      hour/minute stepper input
        TitleAutocomplete.tsx event-title suggestions
        date-utils.ts        zero-dependency date helpers
        event-utils.ts       repeating-event expansion helpers
      todo/
        TodoView.tsx         todo list + editor (due, repeat, subtasks)
      timetracking/
        TimeTrackingView.tsx timer + tracked-entry list
        ManualEntryModal.tsx add/edit a time entry by hand
        entry-utils.ts       time-entry draft helpers
      aggregation/
        AggregationView.tsx  tracked-effort totals by task/project/hashtag
      project/
        ProjectsView.tsx     project CRUD (name, description, color)
      hashtag/
        HashtagsView.tsx     hashtag CRUD (name, color)
      components/
        SnippetEditor.tsx
```

## Roadmap ideas

- Pin favorite clipboard items
- Rich content (images, files) in history
- Configurable shortcut and history size
- Launch at login toggle
- Reports/summaries for tracked time (by project or hashtag)
