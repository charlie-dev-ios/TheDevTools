import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '../types'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  formatTime,
  isSameDay,
  minutesSinceMidnight,
  SNAP_MINUTES
} from './date-utils'

interface Props {
  date: Date
  events: CalendarEvent[]
  onUpdate: (event: CalendarEvent) => void
  onCreateAt: (start: Date) => void
  onSelect: (event: CalendarEvent) => void
}

interface DragState {
  id: string
  mode: 'move' | 'resize'
  grabOffsetMin: number // pointer offset within the event at grab (move only)
  durationMin: number
  startMin: number // live, absolute minutes from midnight, snapped
  endMin: number // live, absolute minutes from midnight, snapped
}

const RANGE_START_MIN = DAY_START_HOUR * 60
const RANGE_END_MIN = DAY_END_HOUR * 60
const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT
// Hour lines at 7, 8, … 21.
const HOUR_MARKS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
  (_, i) => DAY_START_HOUR + i
)

/** Absolute minutes-from-midnight → pixels from the top of the grid. */
function minToTop(absMin: number): number {
  return ((absMin - RANGE_START_MIN) / 60) * HOUR_HEIGHT
}

function snapClamp(absMin: number, maxStart: number): number {
  const snapped = Math.round(absMin / SNAP_MINUTES) * SNAP_MINUTES
  return Math.max(RANGE_START_MIN, Math.min(snapped, maxStart))
}

export default function DayView({
  date,
  events,
  onUpdate,
  onCreateAt,
  onSelect
}: Props): JSX.Element {
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const draggedRef = useRef(false)
  // Re-render every minute so the "now" line stays current.
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.start), date))
    .sort((a, b) => a.start.localeCompare(b.start))

  /** Client Y → absolute minutes from midnight. */
  function pointerAbsMin(clientY: number): number {
    const grid = gridRef.current
    if (!grid) return RANGE_START_MIN
    const rect = grid.getBoundingClientRect()
    const y = clientY - rect.top
    return RANGE_START_MIN + (y / HOUR_HEIGHT) * 60
  }

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
      setDrag((prev) => {
        if (prev && draggedRef.current) {
          const start = new Date(date)
          start.setHours(0, prev.startMin, 0, 0)
          const end = new Date(date)
          end.setHours(0, prev.endMin, 0, 0)
          const source = dayEvents.find((ev) => ev.id === prev.id)
          if (source) {
            onUpdate({ ...source, start: start.toISOString(), end: end.toISOString() })
          }
        }
        return null
      })
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
  }, [drag, date, dayEvents, onUpdate])

  function beginDrag(
    e: React.PointerEvent,
    event: CalendarEvent,
    mode: 'move' | 'resize'
  ): void {
    e.preventDefault()
    e.stopPropagation()
    const startMin = minutesSinceMidnight(new Date(event.start))
    const endMin = minutesSinceMidnight(new Date(event.end))
    setDrag({
      id: event.id,
      mode,
      grabOffsetMin: pointerAbsMin(e.clientY) - startMin,
      durationMin: endMin - startMin,
      startMin,
      endMin
    })
  }

  function onGridClick(e: React.MouseEvent): void {
    if (draggedRef.current) return
    const startMin = snapClamp(pointerAbsMin(e.clientY), RANGE_END_MIN - 30)
    const start = new Date(date)
    start.setHours(0, startMin, 0, 0)
    onCreateAt(start)
  }

  const nowMin = minutesSinceMidnight(now)
  const showNow = isSameDay(now, date) && nowMin >= RANGE_START_MIN && nowMin <= RANGE_END_MIN

  return (
    <div className="dayview">
      <div
        className="dayview-grid"
        ref={gridRef}
        style={{ height: GRID_HEIGHT }}
        onClick={onGridClick}
      >
        {HOUR_MARKS.map((h) => (
          <div key={h} className="hour-line" style={{ top: minToTop(h * 60) }}>
            <span className="hour-label">{`${h.toString().padStart(2, '0')}:00`}</span>
          </div>
        ))}

        {dayEvents.map((event) => {
          const live = drag && drag.id === event.id
          const startMin = live ? drag.startMin : minutesSinceMidnight(new Date(event.start))
          const endMin = live ? drag.endMin : minutesSinceMidnight(new Date(event.end))
          const top = minToTop(startMin)
          const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 18)
          return (
            <div
              key={event.id}
              className={live ? 'event dragging' : 'event'}
              style={{ top, height }}
              onPointerDown={(e) => beginDrag(e, event, 'move')}
              onClick={(e) => {
                e.stopPropagation()
                if (!draggedRef.current) onSelect(event)
              }}
            >
              <div className="event-title">{event.title}</div>
              <div className="event-time">
                {fmtMin(startMin)}–{fmtMin(endMin)}
              </div>
              <div
                className="event-resize"
                onPointerDown={(e) => beginDrag(e, event, 'resize')}
              />
            </div>
          )
        })}

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
