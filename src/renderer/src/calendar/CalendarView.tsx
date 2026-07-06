import { useEffect, useState } from 'react'
import type { CalendarEvent } from '../types'
import MonthView from './MonthView'
import DayView from './DayView'
import EventModal from './EventModal'
import EventPanel from './EventPanel'
import { HOUR_HEIGHT, addDays, addMonths, dayTitle, monthTitle } from './date-utils'

type Mode = 'month' | 'day'

const MODE_STORAGE_KEY = 'calendar:mode'
const DEFAULT_EVENT_MINUTES = 30

function loadInitialMode(): Mode {
  return localStorage.getItem(MODE_STORAGE_KEY) === 'day' ? 'day' : 'month'
}

interface Editing {
  event: CalendarEvent
  isNew: boolean
}

export default function CalendarView(): JSX.Element {
  const [mode, setMode] = useState<Mode>(loadInitialMode)
  const [cursor, setCursor] = useState<Date>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  // Month view edits through the modal; day view edits through the side panel.
  const [editing, setEditing] = useState<Editing | null>(null)
  const [draft, setDraft] = useState<Editing | null>(null)
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT)

  useEffect(() => {
    window.api.getEvents().then(setEvents)
  }, [])

  // Remember the last used view so the calendar reopens in it.
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  }, [mode])

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
    setDraft(null)
  }

  function newEventAt(start: Date, durationMin = DEFAULT_EVENT_MINUTES): void {
    const end = new Date(start.getTime() + durationMin * 60_000)
    const entry: Editing = {
      event: {
        id: crypto.randomUUID(),
        title: '',
        start: start.toISOString(),
        end: end.toISOString()
      },
      isNew: true
    }
    if (mode === 'day') {
      setDraft(entry)
    } else {
      setEditing(entry)
    }
  }

  function switchMode(next: Mode): void {
    if (next === 'month') setDraft(null)
    setMode(next)
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
            onClick={() => switchMode('month')}
          >
            Month
          </button>
          <button
            className={mode === 'day' ? 'seg active' : 'seg'}
            onClick={() => switchMode('day')}
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
          <>
            <DayView
              date={cursor}
              events={events}
              draft={draft?.event ?? null}
              hourHeight={hourHeight}
              onHourHeightChange={setHourHeight}
              onUpdate={upsert}
              onDraftChange={(event) => setDraft((d) => (d ? { ...d, event } : d))}
              onCreateAt={(start) => newEventAt(start)}
              onSelect={(event) => setDraft({ event: { ...event }, isNew: false })}
            />
            {draft && (
              <EventPanel
                event={draft.event}
                isNew={draft.isNew}
                onChange={(event) => setDraft((d) => (d ? { ...d, event } : d))}
                onSave={(event) => {
                  upsert(event)
                  setDraft(null)
                }}
                onDelete={remove}
                onCancel={() => setDraft(null)}
              />
            )}
          </>
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
