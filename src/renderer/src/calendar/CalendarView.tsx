import { useEffect, useMemo, useState } from 'react'
import type { CalendarEvent, TimeEntry } from '../types'
import MonthView from './MonthView'
import DayView from './DayView'
import EventModal from './EventModal'
import EventPanel from './EventPanel'
import ManualEntryModal from '../timetracking/ManualEntryModal'
import { expandSeries } from './event-utils'
import {
  applyEntryEdit,
  entryFromDraft,
  type TimeEntryDraft
} from '../timetracking/entry-utils'
import {
  HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  addDays,
  addMinutes,
  addMonths,
  dayTitle,
  monthTitle
} from './date-utils'

type Mode = 'month' | 'day'

const MODE_STORAGE_KEY = 'calendar:mode'
const ACTUALS_STORAGE_KEY = 'calendar:showActuals'
const SCALE_STORAGE_KEY = 'calendar:hourHeight'
const DEFAULT_EVENT_MINUTES = 30

function loadInitialMode(): Mode {
  return localStorage.getItem(MODE_STORAGE_KEY) === 'day' ? 'day' : 'month'
}

function loadInitialShowActuals(): boolean {
  return localStorage.getItem(ACTUALS_STORAGE_KEY) === 'true'
}

// Restore the last day-view zoom, ignoring anything out of the allowed range.
function loadInitialHourHeight(): number {
  const raw = Number(localStorage.getItem(SCALE_STORAGE_KEY))
  return Number.isFinite(raw) && raw >= MIN_HOUR_HEIGHT && raw <= MAX_HOUR_HEIGHT
    ? raw
    : HOUR_HEIGHT
}

interface Editing {
  event: CalendarEvent
  isNew: boolean
  /** Snapshot of the event as it was opened, to detect repeat-rule changes. */
  original?: CalendarEvent
}

export default function CalendarView(): JSX.Element {
  const [mode, setMode] = useState<Mode>(loadInitialMode)
  const [cursor, setCursor] = useState<Date>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  // Month view edits through the modal; day view edits through the side panel.
  const [editing, setEditing] = useState<Editing | null>(null)
  const [draft, setDraft] = useState<Editing | null>(null)
  const [hourHeight, setHourHeight] = useState(loadInitialHourHeight)
  // "Actual" toggle: overlay tracked time entries on the calendar.
  const [showActuals, setShowActuals] = useState<boolean>(loadInitialShowActuals)
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  // Prefill for the manual time-entry modal, null while closed.
  const [addingActual, setAddingActual] = useState<{ start: Date; end: Date } | null>(null)
  // Tracked entry being edited through the modal, null while closed.
  const [editingActual, setEditingActual] = useState<TimeEntry | null>(null)
  // Live times/task reported by the open time-entry modal, drawn as a dashed
  // preview block in the actual lane (mirrors the planned-event draft).
  const [actualPreview, setActualPreview] = useState<{
    start: Date
    end: Date
    task: string
  } | null>(null)

  useEffect(() => {
    window.api.getEvents().then(setEvents)
  }, [])

  // Remember the last used view so the calendar reopens in it.
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  }, [mode])

  // Remember the Actual toggle so it survives tab switches and restarts.
  useEffect(() => {
    localStorage.setItem(ACTUALS_STORAGE_KEY, String(showActuals))
  }, [showActuals])

  // Remember the day-view zoom so the timeline reopens at the same scale.
  useEffect(() => {
    localStorage.setItem(SCALE_STORAGE_KEY, String(hourHeight))
  }, [hourHeight])

  // Refetch on every toggle-on so newly stopped timers show up.
  useEffect(() => {
    if (showActuals) window.api.getTimeEntries().then(setTimeEntries)
  }, [showActuals])

  const trackedEvents = useMemo<CalendarEvent[]>(
    () =>
      showActuals
        ? timeEntries.map((e) => ({
            id: `tracked-${e.id}`,
            title: e.subtask ? `${e.task} › ${e.subtask}` : e.task,
            start: e.start,
            end: e.end
          }))
        : [],
    [showActuals, timeEntries]
  )

  // The dashed actual-lane preview, shaped like an event so DayView can lay it
  // out with the same renderer as tracked blocks.
  const actualDraft = useMemo<CalendarEvent | null>(
    () =>
      actualPreview
        ? {
            id: 'actual-draft',
            title: actualPreview.task,
            start: actualPreview.start.toISOString(),
            end: actualPreview.end.toISOString()
          }
        : null,
    [actualPreview]
  )

  async function persist(next: CalendarEvent[]): Promise<void> {
    setEvents(next)
    await window.api.saveEvents(next)
  }

  // Entries are also written from the Time Tracking tab, so apply changes to
  // a fresh copy instead of trusting the local one.
  async function mutateTimeEntries(
    change: (current: TimeEntry[]) => TimeEntry[]
  ): Promise<void> {
    const next = change(await window.api.getTimeEntries())
    setTimeEntries(next)
    await window.api.saveTimeEntries(next)
  }

  // Record a time entry from the calendar, same shape the timer produces.
  async function addActual(draft: TimeEntryDraft): Promise<void> {
    await mutateTimeEntries((current) => [entryFromDraft(draft), ...current])
    setAddingActual(null)
  }

  // A tracked block/chip was clicked: look the entry back up from its id.
  function selectTracked(event: CalendarEvent): void {
    const entry = timeEntries.find((e) => `tracked-${e.id}` === event.id)
    if (entry) setEditingActual(entry)
  }

  async function saveActualEdit(draft: TimeEntryDraft): Promise<void> {
    const target = editingActual
    if (!target) return
    await mutateTimeEntries((current) =>
      current.map((e) => (e.id === target.id ? applyEntryEdit(e, draft) : e))
    )
    setEditingActual(null)
  }

  async function removeActual(id: string): Promise<void> {
    await mutateTimeEntries((current) => current.filter((e) => e.id !== id))
    setEditingActual(null)
  }

  function upsert(event: CalendarEvent): void {
    const exists = events.some((e) => e.id === event.id)
    const next = exists
      ? events.map((e) => (e.id === event.id ? event : e))
      : [...events, event]
    void persist(next)
  }

  // Save a batch: replace any events sharing an incoming id, append the rest.
  // Used when a new event expands into a repeating series of occurrences.
  function upsertMany(incoming: CalendarEvent[]): void {
    const ids = new Set(incoming.map((e) => e.id))
    void persist([...events.filter((e) => !ids.has(e.id)), ...incoming])
    setEditing(null)
    setDraft(null)
  }

  // True when the repeat rule (kind or selected weekdays) differs.
  function repeatRuleChanged(a: CalendarEvent, b: CalendarEvent): boolean {
    if ((a.repeat ?? 'none') !== (b.repeat ?? 'none')) return true
    const days = (e: CalendarEvent): string =>
      [...(e.repeatDays ?? [])].sort((x, y) => x - y).join(',')
    return days(a) !== days(b)
  }

  // Commit a create/edit from the modal or panel. New events expand into a
  // series; edits that leave the repeat rule untouched save just that
  // occurrence (the rest of the series is left alone). Editing the repeat rule
  // rebuilds the series from this occurrence, dropping the previous rule's
  // occurrences — setting it to "none" collapses the series to this one event.
  function commitEvent(base: CalendarEvent, isNew: boolean, original?: CalendarEvent): void {
    if (isNew) {
      upsertMany(expandSeries(base))
      return
    }
    if (original && !repeatRuleChanged(original, base)) {
      upsertMany([base])
      return
    }
    const oldSeriesId = original?.seriesId
    const rest = oldSeriesId
      ? events.filter((e) => e.seriesId !== oldSeriesId)
      : events.filter((e) => e.id !== base.id)
    const next =
      (base.repeat ?? 'none') === 'none'
        ? [...rest, { ...base, repeat: 'none' as const, repeatDays: undefined, seriesId: undefined }]
        : [...rest, ...expandSeries(base)]
    void persist(next)
    setEditing(null)
    setDraft(null)
  }

  function remove(id: string): void {
    void persist(events.filter((e) => e.id !== id))
    setEditing(null)
    setDraft(null)
  }

  // Delete every occurrence generated from the same repeating series.
  function removeSeries(seriesId: string): void {
    void persist(events.filter((e) => e.seriesId !== seriesId))
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
            className={showActuals ? 'seg actual-toggle active' : 'seg actual-toggle'}
            onClick={() => setShowActuals((v) => !v)}
            title="Overlay tracked time entries"
          >
            ⏱ Actual
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
          {showActuals && (
            <button
              className="btn new-event new-actual"
              title="Record a time entry"
              onClick={() => {
                const start = new Date(cursor)
                start.setHours(9, 0, 0, 0)
                setAddingActual({ start, end: addMinutes(start, DEFAULT_EVENT_MINUTES) })
              }}
            >
              + Actual
            </button>
          )}
        </div>
      </header>

      <div className="calendar-body">
        {mode === 'month' ? (
          <MonthView
            cursor={cursor}
            events={events}
            tracked={trackedEvents}
            onOpenDay={(day) => {
              setCursor(day)
              setMode('day')
            }}
            onSelect={(event) => setEditing({ event, isNew: false, original: event })}
            onSelectTracked={selectTracked}
          />
        ) : (
          <>
            <DayView
              date={cursor}
              events={events}
              // Undefined when off so the day view collapses back to one lane.
              tracked={showActuals ? trackedEvents : undefined}
              draft={draft?.event ?? null}
              actualDraft={actualDraft}
              // Hide the block being edited so the dashed preview stands in for it.
              hideTrackedId={editingActual ? `tracked-${editingActual.id}` : null}
              hourHeight={hourHeight}
              onHourHeightChange={setHourHeight}
              onUpdate={upsert}
              onDraftChange={(event) => setDraft((d) => (d ? { ...d, event } : d))}
              onCreateAt={(start) => newEventAt(start)}
              onCreateActualAt={(start) =>
                setAddingActual({ start, end: addMinutes(start, DEFAULT_EVENT_MINUTES) })
              }
              onSelect={(event) =>
                setDraft({ event: { ...event }, isNew: false, original: { ...event } })
              }
              onSelectTracked={selectTracked}
            />
            {draft && (
              <EventPanel
                event={draft.event}
                isNew={draft.isNew}
                onChange={(event) => setDraft((d) => (d ? { ...d, event } : d))}
                onSave={(base) => commitEvent(base, draft.isNew, draft.original)}
                onDelete={remove}
                onDeleteSeries={removeSeries}
                onCancel={() => setDraft(null)}
              />
            )}
          </>
        )}
      </div>

      {addingActual && (
        <ManualEntryModal
          initialStart={addingActual.start}
          initialEnd={addingActual.end}
          onSave={addActual}
          onCancel={() => setAddingActual(null)}
          onPreviewChange={setActualPreview}
        />
      )}

      {editingActual && (
        <ManualEntryModal
          editing
          initialTask={editingActual.task}
          initialSubtask={editingActual.subtask}
          initialProject={editingActual.project}
          initialHashtag={editingActual.hashtag}
          initialStart={new Date(editingActual.start)}
          initialEnd={new Date(editingActual.end)}
          onSave={saveActualEdit}
          onDelete={() => void removeActual(editingActual.id)}
          onCancel={() => setEditingActual(null)}
          onPreviewChange={setActualPreview}
        />
      )}

      {editing && (
        <EventModal
          event={editing.event}
          isNew={editing.isNew}
          onSave={(base) => commitEvent(base, editing.isNew, editing.original)}
          onDelete={remove}
          onDeleteSeries={removeSeries}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
