import { useEffect, useState } from 'react'
import type { CalendarEvent } from '../types'
import MonthView from './MonthView'
import DayView from './DayView'
import EventModal from './EventModal'
import { addDays, addMonths, dayTitle, monthTitle } from './date-utils'

type Mode = 'month' | 'day'

interface Editing {
  event: CalendarEvent
  isNew: boolean
}

export default function CalendarView(): JSX.Element {
  const [mode, setMode] = useState<Mode>('month')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [editing, setEditing] = useState<Editing | null>(null)

  useEffect(() => {
    window.api.getEvents().then(setEvents)
  }, [])

  async function persist(next: CalendarEvent[]): Promise<void> {
    setEvents(next)
    await window.api.saveEvents(next)
  }

  function upsert(event: CalendarEvent): void {
    const exists = events.some((e) => e.id === event.id)
    const next = exists
      ? events.map((e) => (e.id === event.id ? event : e))
      : [...events, event]
    void persist(next)
  }

  function remove(id: string): void {
    void persist(events.filter((e) => e.id !== id))
    setEditing(null)
  }

  function newEventAt(start: Date, durationMin = 60): void {
    const end = new Date(start.getTime() + durationMin * 60_000)
    setEditing({
      event: {
        id: crypto.randomUUID(),
        title: '',
        start: start.toISOString(),
        end: end.toISOString()
      },
      isNew: true
    })
  }

  function step(direction: number): void {
    setCursor((c) => (mode === 'month' ? addMonths(c, direction) : addDays(c, direction)))
  }

  return (
    <div className="calendar">
      <header className="calendar-toolbar">
        <div className="toolbar-nav">
          <button className="icon-btn" onClick={() => step(-1)} title="Previous">
            ‹
          </button>
          <button className="icon-btn" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <button className="icon-btn" onClick={() => step(1)} title="Next">
            ›
          </button>
          <h2 className="calendar-title">
            {mode === 'month' ? monthTitle(cursor) : dayTitle(cursor)}
          </h2>
        </div>
        <div className="mode-toggle">
          <button
            className={mode === 'month' ? 'seg active' : 'seg'}
            onClick={() => setMode('month')}
          >
            Month
          </button>
          <button
            className={mode === 'day' ? 'seg active' : 'seg'}
            onClick={() => setMode('day')}
          >
            Day
          </button>
          <button
            className="btn primary new-event"
            onClick={() => {
              const start = new Date(cursor)
              start.setHours(9, 0, 0, 0)
              newEventAt(start)
            }}
          >
            + Event
          </button>
        </div>
      </header>

      <div className="calendar-body">
        {mode === 'month' ? (
          <MonthView
            cursor={cursor}
            events={events}
            onOpenDay={(day) => {
              setCursor(day)
              setMode('day')
            }}
            onSelect={(event) => setEditing({ event, isNew: false })}
          />
        ) : (
          <DayView
            date={cursor}
            events={events}
            onUpdate={upsert}
            onCreateAt={(start) => newEventAt(start, 60)}
            onSelect={(event) => setEditing({ event, isNew: false })}
          />
        )}
      </div>

      {editing && (
        <EventModal
          event={editing.event}
          isNew={editing.isNew}
          onSave={(event) => {
            upsert(event)
            setEditing(null)
          }}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
