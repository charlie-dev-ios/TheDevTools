# CLAUDE.md

Guidance for Claude Code (and other AI coding agents) working in this
repository. Human-facing usage lives in `README.md`. A tool-agnostic mirror of
this file lives in `AGENTS.md` — **keep the two in sync** when you change build
commands, architecture, or conventions.

## What this is

**TheDevTools** is a macOS menu-bar productivity app built with **Electron +
React 18 + TypeScript**, bundled by **electron-vite**. It has two UI surfaces:

- **Quick launcher** — a frameless, always-on-top floating panel toggled with
  `⌘⇧V` for fast clipboard/snippet paste into the previously focused app.
- **Main window** — opened from the tray; a sidebar shell with Calendar, Todos,
  Time Tracking, Aggregation, Clipboard History and Snippets.

The app is macOS-first: it lives in the menu bar (`Tray`), hides the dock icon
until the main window opens, and pastes by simulating `⌘V` via AppleScript
(`osascript`), which requires the **Accessibility** permission.

## Commands

The toolchain is pinned in `mise.toml` (Bun as the primary runtime, Node 22 as a
fallback for `electron-builder`). `package.json` scripts are runner-agnostic, so
either `bun run <script>` or `npm run <script>` works.

| Task | Command |
|------|---------|
| Install deps | `bun install` (or `npm install`) |
| Dev (hot reload) | `bun run dev` / `mise run dev` |
| Type-check only | `bun run typecheck` (`tsc --noEmit`) |
| Build (bundle all 3 processes) | `bun run build` / `mise run build` |
| Package `.dmg` (macOS only) | `bun run dist:mac` |

**There is no test runner and no linter/formatter configured.** The only
automated check is the TypeScript compiler. Before finishing a change, always
run:

```bash
bun run typecheck   # must pass — strict mode, noUnusedLocals/Parameters are on
bun run build       # confirms all three process bundles compile
```

Running the app itself (`bun run dev`) launches an Electron window and only
works on a machine with a display (macOS for full functionality). CI/headless
environments should rely on `typecheck` + `build`. Packaging a `.dmg`
(`dist:mac`) must be done on a Mac.

## Architecture

Three Electron processes, each with its own Vite build (see
`electron.vite.config.ts`):

```
src/
  main/                Electron main process (Node)
    index.ts           windows, tray, global shortcut, clipboard watcher,
                       paste (osascript), all IPC handlers, app lifecycle
    store.ts           single-JSON-file persistence + repeating-todo roll-forward
    notifications.ts   polls stored events, fires desktop reminders before them
  preload/
    index.ts           contextBridge: exposes the typed `window.api` to renderer
  renderer/            React UI — ONE bundle shared by both windows
    index.html
    src/
      main.tsx         picks Launcher (#launcher) or MainApp (#main hash)
      Launcher.tsx     floating quick-paste panel
      MainApp.tsx      sidebar shell + Clipboard History / Snippets panels
      types.ts         shared renderer-side type definitions (canonical copy)
      env.d.ts         declares `window.api` typed from the preload `Api`
      index.css        all styling (single stylesheet)
      calendar/        month/day views, event modal/panel, drag-to-reschedule,
                       title autocomplete, date/event utils
      todo/            TodoView (due dates, repeats, subtasks)
      timetracking/    TimeTrackingView, manual-entry modal, entry utils
      aggregation/     AggregationView (tracked-effort totals)
      components/      SnippetEditor
```

### Data flow

- **Renderer → main** goes exclusively through `window.api.*` (defined in
  `src/preload/index.ts`), which calls `ipcRenderer.invoke(...)`. The main
  process registers matching handlers in `registerIpc()` in
  `src/main/index.ts`.
- **Main → renderer** uses `broadcast()` / `webContents.send(...)`; the renderer
  subscribes via `window.api.onHistoryUpdate` / `onWindowShown`, which return an
  unsubscribe function (call it in a `useEffect` cleanup).
- **Persistence** is a single JSON file (`thedevtools-data.json`) in the app's
  `userData` directory, managed by `src/main/store.ts`. `load()` runs once at
  startup; every mutation calls `persist()`. The whole file is rewritten on each
  save — there is no database and no partial writes.
- **Two windows, one bundle:** the main process loads the same renderer with a
  URL hash (`#launcher` / `#main`); `main.tsx` branches on
  `window.location.hash`.

### Persisted data model

`store.ts` owns the on-disk shape: `{ history, snippets, events, todos,
timeEntries, projects, hashtags }`. Renderers read/write whole arrays via the
`save*`/`get*` IPC methods (e.g. `saveTodos(todos)` replaces the entire list).
Key entities are `Snippet`, `CalendarEvent` (with optional `project`/`hashtag`
plus `repeat`/`seriesId`), `Todo` (with `repeat`/`repeatDays`/`subtasks`), `TimeEntry`
(task/subtask/project/hashtag + tracked `seconds`), and the standalone `Project`
(name/description/color) and `Hashtag` (name/color) catalogs. Clipboard history
is a capped (`MAX_HISTORY = 200`), deduped, most-recent-first `string[]`.

## Conventions

Match the existing style — it is consistent across the codebase:

- **No semicolons**, single quotes, 2-space indentation.
- **TypeScript strict mode.** Explicit return types on functions (`: void`,
  `: JSX.Element`, `Promise<...>`). `noUnusedLocals` and `noUnusedParameters`
  are enabled, so unused imports/vars fail the build — prefix intentionally
  unused params with `_` (e.g. `(_event, text: string)`).
- **React:** function components with hooks only (no classes). Default exports
  for components. Plain CSS classes from `index.css` — no CSS-in-JS or CSS
  modules.
- **Node built-ins** are imported with the `node:` prefix (`node:path`,
  `node:child_process`, `node:crypto`).
- **ESM everywhere** (`"type": "module"`). Note main-process relative imports of
  compiled files use `.js` (e.g. `from './store.js'`).
- **Comments** explain *why*, not *what*; interface fields carry short JSDoc
  (see `types.ts` / `store.ts`). Keep them terse and in the same voice.
- IDs are generated with `crypto.randomUUID()` (renderer) / `randomUUID()` from
  `node:crypto` (main).

## Gotchas

- **Types are duplicated in three places.** `Snippet`, `CalendarEvent`, `Todo`,
  `Subtask` and `TimeEntry` are declared independently in `src/main/store.ts`,
  `src/preload/index.ts`, and `src/renderer/src/types.ts` (with the renderer's
  `types.ts` as the fuller, canonical version). There is no shared module —
  when you change a data shape, **update all relevant copies** or the IPC
  contract silently drifts. `store.ts`'s copies can lag (e.g. `repeat`/
  `seriesId` on events); keep them in sync when you touch them.
- **Adding a new IPC channel touches four spots:** an `ipcMain.handle` in
  `registerIpc()` (main), a method on `api` in the preload (which types it), the
  consuming call in the renderer, and — for a persisted resource — getter/setter
  functions in `store.ts`.
- **macOS-only behaviors are guarded** with `process.platform === 'darwin'`
  (dock, paste). Keep new platform-specific code behind the same guard.
- **The clipboard watcher polls** every `POLL_INTERVAL_MS` (800ms). When the app
  writes to the clipboard itself it sets `selfCopiedText` so the poll doesn't
  re-record it — preserve that guard if you touch clipboard writes.
- **Repeating todos roll forward on read:** `getTodos()` calls
  `rollForwardRepeats()`, which is deliberately idempotent (safe to run on every
  fetch — a series with a pending occurrence is left alone, and occurrences
  missed while the app was closed are collapsed to the latest). Don't move that
  logic into a timer without understanding it.
- **Prefer `bun`** to match the pinned toolchain (`mise.toml`); the
  `package.json` scripts are runner-agnostic so `npm` works too.
- Keep `README.md` (feature list and project-structure section) and `AGENTS.md`
  roughly in step with `src/` when you add or move top-level UI areas.
