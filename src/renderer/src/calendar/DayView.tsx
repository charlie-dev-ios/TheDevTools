import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '../types'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  formatTime,
  isSameDay,
  minutesSinceMidnight,
  SNAP_MINUTES
} from './date-utils'

interface Props {
  date: Date
  events: CalendarEvent[]
  /** Working copy being edited in the side panel, shown as a dashed block. */
  draft: CalendarEvent | null
  hourHeight: number
  onHourHeightChange: (height: number) => void
  onUpdate: (event: CalendarEvent) => void
  onDraftChange: (event: CalendarEvent) => void
  onCreateAt: (start: Date) => void
  onSelect: (event: CalendarEvent) => void
}

interface DragState {
  id: string
  kind: 'event' | 'draft'
  mode: 'move' | 'resize'
  grabOffsetMin: number // pointer offset within the event at grab (move only)
  durationMin: number
  startMin: number // live, absolute minutes from midnight, snapped
  endMin: number // live, absolute minutes from midnight, snapped
}

const RANGE_START_MIN = DAY_START_HOUR * 60
const RANGE_END_MIN = DAY_END_HOUR * 60
// Hour lines at 7, 8, … 21.
const HOUR_MARKS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i
)

function snapClamp(absMin: number, maxStart: number): number {
  const snapped = Math.round(absMin / SNAP_MINUTES) * SNAP_MINUTES
  return Math.max(RANGE_START_MIN, Math.min(snapped, maxStart))
}

// Minimum rendered block height in pixels: zoomed in, short events show their
// true duration; zoomed out, a block never collapses below one readable line.
const MIN_EVENT_PX = 16

interface Positioned {
  event: CalendarEvent
  startMin: number
  endMin: number
}

interface Laid extends Positioned {
  col: number
  cols: number
}

/** Rendered bottom edge in minutes: real end, but at least `minMin` tall. */
function visualEnd(p: Positioned, minMin: number): number {
  return Math.max(p.endMin, p.startMin + minMin)
}

/**
 * Assign overlapping events to side-by-side columns. Events are grouped into
 * clusters of transitively overlapping blocks (using their rendered extents,
 * so the pixel minimum height counts as occupied space); every event in a
 * cluster shares the cluster's column count, and non-overlapping events keep
 * a single full-width column. `minMin` is the minimum block height expressed
 * in minutes at the current zoom.
 */
function layoutEvents(items: Positioned[], minMin: number): Laid[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const laid: Laid[] = []
  let cluster: Laid[] = []
  let colEnds: number[] = [] // per column, visual end of its last event
  let clusterEnd = -Infinity

  function flush(): void {
    for (const l of cluster) l.cols = colEnds.length
    laid.push(...cluster)
    cluster = []
    colEnds = []
    clusterEnd = -Infinity
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush()
    let col = colEnds.findIndex((end) => end <= item.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(visualEnd(item, minMin))
    } else {
      colEnds[col] = visualEnd(item, minMin)
    }
    cluster.push({ ...item, col, cols: 0 })
    clusterEnd = Math.max(clusterEnd, visualEnd(item, minMin))
  }
  flush()
  return laid
}

export default function DayView({
  date,
  events,
  draft,
  hourHeight,
  onHourHeightChange,
  onUpdate,
  onDraftChange,
  onCreateAt,
  onSelect
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const draggedRef = useRef(false)
  // Scroll offset to apply after a zoom re-render, keeping the pointer anchored.
  const pendingScrollRef = useRef<number | null>(null)
  // Re-render every minute so the "now" line stays current.
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * hourHeight

  /** Absolute minutes-from-midnight → pixels from the top of the grid. */
  function minToTop(absMin: number): number {
    return ((absMin - RANGE_START_MIN) / 60) * hourHeight
  }

  const draftOnDay = draft && isSameDay(new Date(draft.start), date) ? draft : null
  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.start), date))
    .filter((e) => !draft || e.id !== draft.id)
    .sort((a, b) => a.start.localeCompare(b.start))

  /** Client Y → absolute minutes from midnight. */
  function pointerAbsMin(clientY: number): number {
    const grid = gridRef.current
    if (!grid) return RANGE_START_MIN
    const rect = grid.getBoundingClientRect()
    const y = clientY - rect.top
    return RANGE_START_MIN + (y / hourHeight) * 60
  }

  // Cmd (or Ctrl) + wheel zooms the timeline around the pointer.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e: WheelEvent): void {
      if (!(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      const next = Math.max(
        MIN_HOUR_HEIGHT,
        Math.min(hourHeight * Math.exp(-e.deltaY * 0.002), MAX_HOUR_HEIGHT)
      )
      if (next === hourHeight) return
      const rect = container!.getBoundingClientRect()
      const offsetY = e.clientY - rect.top
      const pointerMin = RANGE_START_MIN + ((container!.scrollTop + offsetY) / hourHeight) * 60
      pendingScrollRef.current =
        ((pointerMin - RANGE_START_MIN) / 60) * next - offsetY
      onHourHeightChange(next)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [hourHeight, onHourHeightChange])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (container && pendingScrollRef.current != null) {
      container.scrollTop = Math.max(0, pendingScrollRef.current)
    }
    pendingScrollRef.current = null
  }, [hourHeight])

  useEffect(() => {
    if (!drag) return

    function onMove(e: PointerEvent): void {
      draggedRef.current = true
      const pointer = pointerAbsMin(e.clientY)
      setDrag((prev) => {
        if (!prev) return prev
        if (prev.mode === 'move') {
          const startMin = snapClamp(pointer - prev.grabOffsetMin, RANGE_END_MIN - prev.durationMin)
          return { ...prev, startMin, endMin: startMin + prev.durationMin }
        }
        // resize: keep start, move the end (min one snap step long)
        const endMin = Math.max(
          prev.startMin + SNAP_MINUTES,
          Math.min(Math.round(pointer / SNAP_MINUTES) * SNAP_MINUTES, RANGE_END_MIN)
        )
        return { ...prev, endMin }
      })
    }

    function onUp(): void {
      // The effect re-subscribes whenever `drag` changes, so the closure is fresh.
      if (drag && draggedRef.current) {
        const start = new Date(date)
        start.setHours(0, drag.startMin, 0, 0)
        const end = new Date(date)
        end.setHours(0, drag.endMin, 0, 0)
        if (drag.kind === 'draft') {
          if (draft) {
            onDraftChange({ ...draft, start: start.toISOString(), end: end.toISOString() })
          }
        } else {
          const source = dayEvents.find((ev) => ev.id === drag.id)
          if (source) {
            onUpdate({ ...source, start: start.toISOString(), end: end.toISOString() })
          }
        }
      }
      setDrag(null)
      setTimeout(() => {
        draggedRef.current = false
      }, 0)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [drag, date, dayEvents, draft, onUpdate, onDraftChange])

  function beginDrag(
    e: React.PointerEvent,
    event: CalendarEvent,
    mode: 'move' | 'resize',
    kind: 'event' | 'draft' = 'event'
  ): void {
    e.preventDefault()
    e.stopPropagation()
    const startMin = minutesSinceMidnight(new Date(event.start))
    const endMin = minutesSinceMidnight(new Date(event.end))
    setDrag({
      id: event.id,
      kind,
      mode,
      grabOffsetMin: pointerAbsMin(e.clientY) - startMin,
      durationMin: endMin - startMin,
      startMin,
      endMin
    })
  }

  function onGridClick(e: React.MouseEvent): void {
    if (draggedRef.current) return
    if (draft) {
      // A draft is open: clicking the grid moves it there, keeping its duration.
      const durationMin = Math.max(
        SNAP_MINUTES,
        (new Date(draft.end).getTime() - new Date(draft.start).getTime()) / 60_000
      )
      const startMin = snapClamp(pointerAbsMin(e.clientY), RANGE_END_MIN - durationMin)
      const start = new Date(date)
      start.setHours(0, startMin, 0, 0)
      const end = new Date(date)
      end.setHours(0, startMin + durationMin, 0, 0)
      onDraftChange({ ...draft, start: start.toISOString(), end: end.toISOString() })
      return
    }
    const startMin = snapClamp(pointerAbsMin(e.clientY), RANGE_END_MIN - 30)
    const start = new Date(date)
    start.setHours(0, startMin, 0, 0)
    onCreateAt(start)
  }

  const nowMin = minutesSinceMidnight(now)
  const showNow = isSameDay(now, date) && nowMin >= RANGE_START_MIN && nowMin <= RANGE_END_MIN

  // The pixel minimum height converted to minutes at the current zoom.
  const minVisualMin = (MIN_EVENT_PX / hourHeight) * 60

  // Apply live drag positions, then lay overlapping events out side by side.
  const laidEvents = layoutEvents(
    dayEvents.map((event) => {
      const live = drag && drag.kind === 'event' && drag.id === event.id
      return {
        event,
        startMin: live ? drag.startMin : minutesSinceMidnight(new Date(event.start)),
        endMin: live ? drag.endMin : minutesSinceMidnight(new Date(event.end))
      }
    }),
    minVisualMin
  )

  function renderBlock(
    { event, startMin, endMin, col, cols }: Laid,
    kind: 'event' | 'draft'
  ): JSX.Element {
    const live = drag && drag.kind === kind && drag.id === event.id
    // The top edge sits exactly at the start time; the height never drops
    // below the pixel minimum, so short events' bottom edge may overshoot.
    const top = minToTop(startMin)
    const height = Math.max(((endMin - startMin) / 60) * hourHeight, MIN_EVENT_PX)
    // 4px inset on the left, 12px on the right, 2px gutter between columns.
    const left = `calc(4px + (100% - 16px) * ${col} / ${cols})`
    const width = `calc((100% - 16px) / ${cols}${cols > 1 ? ' - 2px' : ''})`
    const classes = ['event']
    if (kind === 'draft') classes.push('draft')
    if (live) classes.push('dragging')
    return (
      <div
        key={kind === 'draft' ? 'draft' : event.id}
        className={classes.join(' ')}
        style={{ top, height, left, width }}
        onPointerDown={(e) => beginDrag(e, event, 'move', kind)}
        onClick={(e) => {
          e.stopPropagation()
          if (kind === 'event' && !draggedRef.current) onSelect(event)
        }}
      >
        <div className="event-header">
          <span className="event-title">
            {event.title || (kind === 'draft' ? 'New event' : '')}
          </span>
          <span className="event-time">
            {fmtMin(startMin)}–{fmtMin(endMin)}
          </span>
        </div>
        {event.description && <div className="event-desc">{event.description}</div>}
        <div className="event-resize" onPointerDown={(e) => beginDrag(e, event, 'resize', kind)} />
      </div>
    )
  }

  return (
    <div className="dayview" ref={containerRef}>
      <div
        className="dayview-grid"
        ref={gridRef}
        style={{ height: gridHeight }}
        onClick={onGridClick}
      >
        {HOUR_MARKS.map((h) => (
          <div key={h} className="hour-line" style={{ top: minToTop(h * 60) }}>
            <span className="hour-label">{`${h.toString().padStart(2, '0')}:00`}</span>
          </div>
        ))}

        {laidEvents.map((laid) => renderBlock(laid, 'event'))}

        {draftOnDay &&
          renderBlock(
            {
              event: draftOnDay,
              startMin:
                drag?.kind === 'draft'
                  ? drag.startMin
                  : minutesSinceMidnight(new Date(draftOnDay.start)),
              endMin:
                drag?.kind === 'draft'
                  ? drag.endMin
                  : minutesSinceMidnight(new Date(draftOnDay.end)),
              col: 0,
              cols: 1
            },
            'draft'
          )}

        {showNow && (
          <div className="now-line" style={{ top: minToTop(nowMin) }}>
            <span className="now-dot" />
            <span className="now-label">{formatTime(now)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function fmtMin(totalMinutes: number): string {
  const d = new Date()
  d.setHours(0, totalMinutes, 0, 0)
  return formatTime(d)
}
