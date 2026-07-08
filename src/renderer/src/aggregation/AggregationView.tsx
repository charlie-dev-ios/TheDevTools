import { useEffect, useMemo, useState } from 'react'
import type { TimeEntry } from '../types'
import {
  addDays,
  addMonths,
  dayTitle,
  monthTitle,
  startOfDay,
  startOfWeek
} from '../calendar/date-utils'

/** How tracked entries are bucketed in the totals list. */
type Grouping = 'task' | 'project' | 'hashtag'
/** The span of time the totals are limited to. */
type Period = 'day' | 'week' | 'month'

const GROUPINGS: { id: Grouping; label: string }[] = [
  { id: 'task', label: 'Task' },
  { id: 'project', label: 'Project' },
  { id: 'hashtag', label: 'Hashtag' }
]

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' }
]

// Bucket labels for entries missing the grouping field.
const NO_PROJECT = 'No project'
const NO_HASHTAG = 'No hashtag'

/** Human-readable effort, e.g. '2h 30m', '45m', '30s'. */
function formatEffort(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h === 0 && m === 0) return `${s}s`
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Half-open [start, end) window covering the period the cursor falls in. */
function periodRange(cursor: Date, period: Period): { start: Date; end: Date } {
  if (period === 'day') {
    const start = startOfDay(cursor)
    return { start, end: addDays(start, 1) }
  }
  if (period === 'week') {
    const start = startOfWeek(cursor)
    return { start, end: addDays(start, 7) }
  }
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  return { start, end: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) }
}

function shortDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Title describing the current window for the given period. */
function periodTitle(cursor: Date, period: Period): string {
  if (period === 'day') return dayTitle(cursor)
  if (period === 'month') return monthTitle(cursor)
  const { start, end } = periodRange(cursor, 'week')
  return `${shortDate(start)} – ${shortDate(addDays(end, -1))}`
}

/** The bucket an entry falls in for the chosen grouping. */
function groupKey(entry: TimeEntry, grouping: Grouping): string {
  if (grouping === 'task') return entry.task || 'Untitled'
  if (grouping === 'project') return entry.project?.trim() || NO_PROJECT
  return entry.hashtag?.trim() || NO_HASHTAG
}

interface Bucket {
  key: string
  seconds: number
  count: number
}

export default function AggregationView({ active = true }: { active?: boolean }): JSX.Element {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [grouping, setGrouping] = useState<Grouping>('task')
  const [period, setPeriod] = useState<Period>('week')
  const [cursor, setCursor] = useState<Date>(() => new Date())

  // Entries are written from both the Time Tracking and Calendar tabs, so
  // re-fetch whenever this tab becomes visible to pick up the latest data.
  useEffect(() => {
    if (!active) return
    window.api.getTimeEntries().then(setEntries)
  }, [active])

  function step(direction: number): void {
    setCursor((c) => {
      if (period === 'day') return addDays(c, direction)
      if (period === 'week') return addDays(c, direction * 7)
      return addMonths(c, direction)
    })
  }

  const { buckets, total } = useMemo(() => {
    const { start, end } = periodRange(cursor, period)
    const startMs = start.getTime()
    const endMs = end.getTime()
    const byKey = new Map<string, Bucket>()
    let sum = 0
    for (const entry of entries) {
      const t = new Date(entry.start).getTime()
      if (t < startMs || t >= endMs) continue
      const key = groupKey(entry, grouping)
      const bucket = byKey.get(key) ?? { key, seconds: 0, count: 0 }
      bucket.seconds += entry.seconds
      bucket.count += 1
      byKey.set(key, bucket)
      sum += entry.seconds
    }
    const list = [...byKey.values()].sort((a, b) => b.seconds - a.seconds)
    return { buckets: list, total: sum }
  }, [entries, grouping, period, cursor])

  const max = buckets.length > 0 ? buckets[0].seconds : 0

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Aggregation</h2>
        <span className="agg-total">Total {formatEffort(total)}</span>
      </header>

      <div className="agg-controls">
        <div className="segmented">
          {GROUPINGS.map((g) => (
            <button
              key={g.id}
              className={g.id === grouping ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setGrouping(g.id)}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              className={p.id === period ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="agg-nav">
        <button className="icon-btn" onClick={() => step(-1)} title="Previous">
          ‹
        </button>
        <button className="icon-btn" onClick={() => setCursor(new Date())}>
          Today
        </button>
        <button className="icon-btn" onClick={() => step(1)} title="Next">
          ›
        </button>
        <span className="agg-range">{periodTitle(cursor, period)}</span>
      </div>

      {buckets.length === 0 ? (
        <p className="empty">No tracked time in this period.</p>
      ) : (
        <ul className="list agg-list">
          {buckets.map((b) => (
            <li key={b.key} className="agg-row">
              <div className="agg-row-head">
                <span className="agg-name">{b.key}</span>
                <span className="agg-effort">{formatEffort(b.seconds)}</span>
              </div>
              <div className="agg-bar-track">
                <div
                  className="agg-bar-fill"
                  style={{ width: max > 0 ? `${(b.seconds / max) * 100}%` : '0%' }}
                />
              </div>
              <span className="agg-meta">
                {b.count} {b.count === 1 ? 'entry' : 'entries'} ·{' '}
                {total > 0 ? Math.round((b.seconds / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
