import { useEffect, useRef, useState } from 'react'
import type { CalendarEvent } from '../types'
import {
  HOUR_HEIGHT,
  formatTime,
  isSameDay,
  minutesSinceMidnight,
  snap
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
  grabOffsetMin: number // where inside the event the pointer grabbed (move only)
  durationMin: number
  startMin: number // live, snapped
  endMin: number // live, snapped
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function DayView({
  date,
  events,
  onUpdate,
  onCreateAt,
  onSelect
}: Props): JSX.Element {
  const gridRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // Suppress the click that fires right after a drag ends.
  const draggedRef = useRef(false)

  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.start), date))
    .sort((a, b) => a.start.localeCompare(b.start))

  function pointerMinutes(clientY: number): number {
    const grid = gridRef.current
    if (!grid) return 0
    const rect = grid.getBoundingClientRect()
    const y = clientY - rect.top + grid.scrollTop
    return (y / HOUR_HEIGHT) * 60
  }

  useEffect(() => {
    if (!drag) return

    function onMove(e: PointerEvent): void {
      draggedRef.current = true
      const pointer = pointerMinutes(e.clientY)
      setDrag((prev) => {
        if (!prev) return prev
        if (prev.mode === 'move') {
          const startMin = snap(pointer - prev.grabOffsetMin, 24 * 60 - prev.durationMin)
          return { ...prev, startMin, endMin: startMin + prev.durationMin }
        }
        // resize: keep start, move end (min 15 min long)
        const endMin = snap(Math.max(pointer, prev.startMin + 15))
        return { ...prev, endMin }
      })
    }

    function onUp(): void {
      setDrag((prev) => {
        // Only persist if the pointer actually moved; a plain click just selects.
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
      // Let the click handler see the drag flag, then clear it.
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
    const pointer = pointerMinutes(e.clientY)
    setDrag({
      id: event.id,
      mode,
      grabOffsetMin: pointer - startMin,
      durationMin: endMin - startMin,
      startMin,
      endMin
    })
  }

  function onGridClick(e: React.MouseEvent): void {
    if (draggedRef.current) return
    const startMin = snap(pointerMinutes(e.clientY), 24 * 60 - 30)
    const start = new Date(date)
    start.setHours(0, startMin, 0, 0)
    onCreateAt(start)
  }

  return (
    <div className="dayview" ref={gridRef}>
      <div className="dayview-grid" style={{ height: 24 * HOUR_HEIGHT }} onClick={onGridClick}>
        {HOURS.map((h) => (
          <div key={h} className="hour-row" style={{ height: HOUR_HEIGHT }}>
            <span className="hour-label">{`${h.toString().padStart(2, '0')}:00`}</span>
          </div>
        ))}

        {dayEvents.map((event) => {
          const live = drag && drag.id === event.id
          const startMin = live ? drag.startMin : minutesSinceMidnight(new Date(event.start))
          const endMin = live ? drag.endMin : minutesSinceMidnight(new Date(event.end))
          const top = (startMin / 60) * HOUR_HEIGHT
          const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 18)
          const startLabel = fmtMin(startMin)
          const endLabel = fmtMin(endMin)
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
                {startLabel}–{endLabel}
              </div>
              <div
                className="event-resize"
                onPointerDown={(e) => beginDrag(e, event, 'resize')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtMin(totalMinutes: number): string {
  const d = new Date()
  d.setHours(0, totalMinutes, 0, 0)
  return formatTime(d)
}
