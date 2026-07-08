import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface Snippet {
  id: string
  title: string
  content: string
}

export interface CalendarEvent {
  id: string
  title: string
  /** Optional free-text notes about the event. */
  description?: string
  /** ISO datetime string. */
  start: string
  /** ISO datetime string. */
  end: string
}

export type TodoRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays'

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Todo {
  id: string
  title: string
  /** Due date as 'YYYY-MM-DD'. */
  due: string
  /** How the todo repeats. The next occurrence is created on the first fetch of its day. */
  repeat: TodoRepeat
  /** Weekdays the todo repeats on (0=Sun … 6=Sat) when repeat === 'weekdays'. */
  repeatDays?: number[]
  completed: boolean
  /** Optional checklist of smaller steps under this todo. */
  subtasks?: Subtask[]
}

export interface TimeEntry {
  id: string
  /** Task name being tracked. */
  task: string
  /** Optional subtask being tracked. */
  subtask?: string
  /** Optional project this entry belongs to. */
  project?: string
  /** Optional hashtag (stored without the leading '#'). */
  hashtag?: string
  /** ISO datetime when tracking started. */
  start: string
  /** ISO datetime when tracking stopped. */
  end: string
  /** Actively tracked seconds (paused time excluded). */
  seconds: number
}

interface Data {
  history: string[]
  snippets: Snippet[]
  events: CalendarEvent[]
  todos: Todo[]
  timeEntries: TimeEntry[]
}

const MAX_HISTORY = 200

const filePath = join(app.getPath('userData'), 'thedevtools-data.json')

let data: Data = { history: [], snippets: [], events: [], todos: [], timeEntries: [] }

export function load(): void {
  try {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<Data>
      data = {
        history: Array.isArray(parsed.history) ? parsed.history : [],
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        todos: Array.isArray(parsed.todos) ? parsed.todos : [],
        timeEntries: Array.isArray(parsed.timeEntries) ? parsed.timeEntries : []
      }
    }
  } catch (err) {
    console.error('Failed to load data, starting fresh:', err)
    data = { history: [], snippets: [], events: [], todos: [], timeEntries: [] }
  }
}

function persist(): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to persist data:', err)
  }
}

export function getHistory(): string[] {
  return data.history
}

export function addHistory(text: string): boolean {
  const trimmed = text
  if (!trimmed.trim()) return false
  // Move an existing identical entry to the top instead of duplicating.
  const existingIndex = data.history.indexOf(trimmed)
  if (existingIndex !== -1) {
    data.history.splice(existingIndex, 1)
  }
  data.history.unshift(trimmed)
  if (data.history.length > MAX_HISTORY) {
    data.history.length = MAX_HISTORY
  }
  persist()
  return true
}

export function removeHistory(text: string): void {
  const index = data.history.indexOf(text)
  if (index !== -1) {
    data.history.splice(index, 1)
    persist()
  }
}

export function clearHistory(): void {
  data.history = []
  persist()
}

export function getSnippets(): Snippet[] {
  return data.snippets
}

export function saveSnippets(snippets: Snippet[]): void {
  data.snippets = snippets
  persist()
}

export function getEvents(): CalendarEvent[] {
  return data.events
}

export function saveEvents(events: CalendarEvent[]): void {
  data.events = events
  persist()
}

function toDateInput(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The due date of the occurrence after `due` for a repeating todo. */
function nextDue(due: string, repeat: TodoRepeat, repeatDays?: number[]): string {
  const [y, m, d] = due.split('-').map(Number)
  if (repeat === 'daily') return toDateInput(new Date(y, m - 1, d + 1))
  if (repeat === 'weekly') return toDateInput(new Date(y, m - 1, d + 7))
  if (repeat === 'weekdays') {
    // The first day after `due` that falls on one of the selected weekdays.
    const days = repeatDays ?? []
    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(y, m - 1, d + i)
      if (days.includes(candidate.getDay())) return toDateInput(candidate)
    }
    return toDateInput(new Date(y, m - 1, d + 7))
  }
  // Monthly: clamp to the last day of the next month (e.g. Jan 31 → Feb 28).
  const lastOfNextMonth = new Date(y, m + 1, 0).getDate()
  return toDateInput(new Date(y, m, Math.min(d, lastOfNextMonth)))
}

function seriesKey(t: Todo): string {
  return `${t.title}|${t.repeat}|${(t.repeatDays ?? []).join(',')}`
}

/**
 * Create the current occurrence of each repeating todo series whose occurrences
 * are all completed and whose next due date has arrived. Idempotent: a series
 * with a pending (uncompleted) occurrence is left alone, so this can run on
 * every fetch and only the first one of the day creates anything.
 */
function rollForwardRepeats(): void {
  const today = toDateInput(new Date())
  const series = new Map<string, Todo[]>()
  for (const t of data.todos) {
    if (t.repeat === 'none') continue
    const key = seriesKey(t)
    const group = series.get(key)
    if (group) group.push(t)
    else series.set(key, [t])
  }

  let changed = false
  for (const group of series.values()) {
    if (group.some((t) => !t.completed)) continue
    const latest = group.reduce((a, b) => (a.due >= b.due ? a : b))
    let due = nextDue(latest.due, latest.repeat, latest.repeatDays)
    if (due > today) continue
    // Skip occurrences missed while the app was closed; keep only the latest.
    while (nextDue(due, latest.repeat, latest.repeatDays) <= today) {
      due = nextDue(due, latest.repeat, latest.repeatDays)
    }
    data.todos.push({
      id: randomUUID(),
      title: latest.title,
      due,
      repeat: latest.repeat,
      repeatDays: latest.repeatDays,
      completed: false,
      // Fresh copy of the checklist, unchecked, for the new occurrence.
      subtasks: latest.subtasks?.map((s) => ({
        id: randomUUID(),
        title: s.title,
        completed: false
      }))
    })
    changed = true
  }
  if (changed) persist()
}

export function getTodos(): Todo[] {
  rollForwardRepeats()
  return data.todos
}

export function saveTodos(todos: Todo[]): void {
  data.todos = todos
  persist()
}

export function getTimeEntries(): TimeEntry[] {
  return data.timeEntries
}

export function saveTimeEntries(timeEntries: TimeEntry[]): void {
  data.timeEntries = timeEntries
  persist()
}
