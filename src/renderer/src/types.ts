export interface Snippet {
  id: string
  title: string
  content: string
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

export interface TimeEntry {
  id: string
  /** Task name being tracked (free text or picked from the todo autocomplete). */
  task: string
  /** ISO datetime when tracking started. */
  start: string
  /** ISO datetime when tracking stopped. */
  end: string
  /** Actively tracked seconds (paused time excluded). */
  seconds: number
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
