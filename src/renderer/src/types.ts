export interface Snippet {
  id: string
  title: string
  content: string
}

export type TodoRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Todo {
  id: string
  title: string
  /** Due date as 'YYYY-MM-DD'. */
  due: string
  /** How the todo repeats. Completing a repeating todo queues the next occurrence. */
  repeat: TodoRepeat
  completed: boolean
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
