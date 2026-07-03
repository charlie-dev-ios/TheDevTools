import { app } from 'electron'
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

export interface Todo {
  id: string
  title: string
  /** Due date as 'YYYY-MM-DD'. */
  due: string
  /** How the todo repeats. Completing a repeating todo queues the next occurrence. */
  repeat: TodoRepeat
  /** Weekdays the todo repeats on (0=Sun … 6=Sat) when repeat === 'weekdays'. */
  repeatDays?: number[]
  completed: boolean
}

interface Data {
  history: string[]
  snippets: Snippet[]
  events: CalendarEvent[]
  todos: Todo[]
}

const MAX_HISTORY = 200

const filePath = join(app.getPath('userData'), 'thedevtools-data.json')

let data: Data = { history: [], snippets: [], events: [], todos: [] }

export function load(): void {
  try {
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<Data>
      data = {
        history: Array.isArray(parsed.history) ? parsed.history : [],
        snippets: Array.isArray(parsed.snippets) ? parsed.snippets : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        todos: Array.isArray(parsed.todos) ? parsed.todos : []
      }
    }
  } catch (err) {
    console.error('Failed to load data, starting fresh:', err)
    data = { history: [], snippets: [], events: [], todos: [] }
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

export function getTodos(): Todo[] {
  return data.todos
}

export function saveTodos(todos: Todo[]): void {
  data.todos = todos
  persist()
}
