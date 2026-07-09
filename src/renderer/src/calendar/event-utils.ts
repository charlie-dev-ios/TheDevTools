import type { CalendarEvent, CalendarRepeat } from '../types'
import { addDays, addMonthsClamped, WEEKDAYS } from './date-utils'

/** Cap on generated occurrences so a repeating event can't blow up the store. */
export const MAX_OCCURRENCES = 366
/** How far ahead a repeating series is generated, in days (~1 year). */
export const REPEAT_HORIZON_DAYS = 365

export const REPEAT_OPTIONS: { value: CalendarRepeat; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekdays', label: 'Weekly on days…' },
  { value: 'monthly', label: 'Monthly' }
]

export function repeatLabel(repeat: CalendarRepeat, repeatDays?: number[]): string {
  if (repeat === 'weekdays') {
    const days = [...(repeatDays ?? [])].sort((a, b) => a - b)
    return days.length > 0 ? days.map((d) => WEEKDAYS[d]).join(' · ') : 'Weekly'
  }
  return REPEAT_OPTIONS.find((o) => o.value === repeat)?.label ?? repeat
}

/** The start of the i-th fixed-interval occurrence (i=0 is the base event itself). */
function occurrenceStart(start: Date, repeat: CalendarRepeat, i: number): Date {
  if (repeat === 'daily') return addDays(start, i)
  if (repeat === 'weekly') return addDays(start, i * 7)
  if (repeat === 'monthly') return addMonthsClamped(start, i)
  return new Date(start)
}

/**
 * Every occurrence start from the base up to the generation horizon (~1 year),
 * capped at MAX_OCCURRENCES. Weekday series keep the base occurrence and add one
 * for each selected weekday that follows it; the other kinds step by a fixed
 * interval.
 */
function seriesStarts(base: CalendarEvent, repeat: CalendarRepeat): Date[] {
  const start = new Date(base.start)
  const horizon = addDays(start, REPEAT_HORIZON_DAYS)
  const starts: Date[] = [new Date(start)]
  if (repeat === 'weekdays') {
    const days = base.repeatDays ?? []
    if (days.length === 0) return starts
    for (let i = 1; starts.length < MAX_OCCURRENCES; i++) {
      const s = addDays(start, i)
      if (s > horizon) break
      if (days.includes(s.getDay())) starts.push(s)
    }
    return starts
  }
  for (let i = 1; starts.length < MAX_OCCURRENCES; i++) {
    const s = occurrenceStart(start, repeat, i)
    if (s > horizon) break
    starts.push(s)
  }
  return starts
}

/**
 * Expand a base event into the concrete occurrences of a repeating series that
 * fall within roughly a year. Each occurrence keeps the base's duration, shares
 * a `seriesId`, and gets its own id (the first reuses the base id). A
 * non-repeating base, or a series with no further occurrences, returns just the
 * base event unchanged.
 */
export function expandSeries(base: CalendarEvent): CalendarEvent[] {
  const repeat = base.repeat ?? 'none'
  if (repeat === 'none') return [{ ...base, repeat }]
  const start = new Date(base.start)
  const duration = new Date(base.end).getTime() - start.getTime()
  const starts = seriesStarts(base, repeat)
  if (starts.length <= 1) return [{ ...base, repeat }]
  const seriesId = base.seriesId ?? crypto.randomUUID()
  return starts.map((s, i) => ({
    ...base,
    id: i === 0 ? base.id : crypto.randomUUID(),
    seriesId,
    repeat,
    start: s.toISOString(),
    end: new Date(s.getTime() + duration).toISOString()
  }))
}
