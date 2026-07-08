import type { CalendarEvent, CalendarRepeat } from '../types'
import { addDays, addMonthsClamped } from './date-utils'

/** Cap on generated occurrences so a repeating event can't blow up the store. */
export const MAX_OCCURRENCES = 366
/** Default number of occurrences offered when a repeat is first chosen. */
export const DEFAULT_OCCURRENCES = 12

export const REPEAT_OPTIONS: { value: CalendarRepeat; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
]

export function repeatLabel(repeat: CalendarRepeat): string {
  return REPEAT_OPTIONS.find((o) => o.value === repeat)?.label ?? repeat
}

/** The start of the i-th occurrence (i=0 is the base event itself). */
function occurrenceStart(start: Date, repeat: CalendarRepeat, i: number): Date {
  if (repeat === 'daily') return addDays(start, i)
  if (repeat === 'weekly') return addDays(start, i * 7)
  if (repeat === 'monthly') return addMonthsClamped(start, i)
  return new Date(start)
}

/**
 * Expand a base event into `count` concrete occurrences of a repeating series.
 * Each occurrence keeps the base's duration, shares a `seriesId`, and gets its
 * own id (the first reuses the base id). A non-repeating base, or a count of
 * one or less, returns just the base event unchanged.
 */
export function expandSeries(base: CalendarEvent, count: number): CalendarEvent[] {
  const repeat = base.repeat ?? 'none'
  if (repeat === 'none' || count <= 1) return [{ ...base, repeat }]
  const start = new Date(base.start)
  const duration = new Date(base.end).getTime() - start.getTime()
  const n = Math.min(Math.max(1, Math.floor(count)), MAX_OCCURRENCES)
  const seriesId = base.seriesId ?? crypto.randomUUID()
  const events: CalendarEvent[] = []
  for (let i = 0; i < n; i++) {
    const s = occurrenceStart(start, repeat, i)
    events.push({
      ...base,
      id: i === 0 ? base.id : crypto.randomUUID(),
      seriesId,
      repeat,
      start: s.toISOString(),
      end: new Date(s.getTime() + duration).toISOString()
    })
  }
  return events
}
