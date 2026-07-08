export const HOUR_HEIGHT = 48 // default px per hour in the day view
// Cmd+wheel zoom bounds for the day view (px per hour).
export const MIN_HOUR_HEIGHT = 24
export const MAX_HOUR_HEIGHT = 192
export const SNAP_MINUTES = 15
// Visible range of the day view (hours, 24h clock).
export const DAY_START_HOUR = 7
export const DAY_END_HOUR = 23
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Add whole months, clamping the day to the last day of the target month so a
 * naive month overflow can't happen (e.g. Jan 31 + 1 month → Feb 28, not Mar 3).
 * The time of day is preserved.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const y = date.getFullYear()
  const m = date.getMonth()
  const lastDay = new Date(y, m + months + 1, 0).getDate()
  return new Date(
    y,
    m + months,
    Math.min(date.getDate(), lastDay),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  )
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** The 6x7 = 42 day grid covering the month `date` falls in (weeks start Sun). */
export function monthMatrix(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const gridStart = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function monthTitle(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function dayTitle(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 'YYYY-MM-DD' for <input type="date">. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'HH:mm' for <input type="time">. */
export function toTimeInput(date: Date): string {
  return formatTime(date)
}

/** Build a Date from a 'YYYY-MM-DD' and 'HH:mm' pair in local time. */
export function fromDateTimeInputs(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = timeStr.split(':').map(Number)
  return new Date(y, m - 1, d, h, min)
}

/** Snap a minute value to the nearest SNAP_MINUTES, clamped to [0, max]. */
export function snap(minutes: number, max = 24 * 60): number {
  const snapped = Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES
  return Math.max(0, Math.min(snapped, max))
}

export function minutesOfHM(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function hmOfMinutes(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}
