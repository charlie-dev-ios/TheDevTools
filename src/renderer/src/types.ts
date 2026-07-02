export interface Snippet {
  id: string
  title: string
  content: string
}

export interface CalendarEvent {
  id: string
  title: string
  /** ISO datetime string. */
  start: string
  /** ISO datetime string. */
  end: string
}
