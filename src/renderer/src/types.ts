export interface Snippet {
  id: string
  title: string
  content: string
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
  /** Task name being tracked (free text or picked from the todo autocomplete). */
  task: string
  /** Optional subtask being tracked (free text or picked from the todo's subtasks). */
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

/** How a calendar event repeats. */
export type CalendarRepeat = 'none' | 'daily' | 'weekly' | 'monthly'

export interface CalendarEvent {
  id: string
  title: string
  /** Optional free-text notes about the event. */
  description?: string
  /** ISO datetime string. */
  start: string
  /** ISO datetime string. */
  end: string
  /** How this event repeats. Absent/`'none'` for a one-off event. */
  repeat?: CalendarRepeat
  /** Shared id linking every occurrence generated from the same series. */
  seriesId?: string
}
