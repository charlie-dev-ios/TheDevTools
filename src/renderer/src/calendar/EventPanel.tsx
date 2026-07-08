import { useEffect, useState } from 'react'
import type { CalendarEvent, CalendarRepeat } from '../types'
import TimeStepper from './TimeStepper'
import TitleAutocomplete from './TitleAutocomplete'
import {
  fromDateTimeInputs,
  hmOfMinutes,
  minutesOfHM,
  toDateInput,
  toTimeInput
} from './date-utils'
import {
  DEFAULT_OCCURRENCES,
  MAX_OCCURRENCES,
  REPEAT_OPTIONS,
  expandSeries,
  repeatLabel
} from './event-utils'

interface Props {
  event: CalendarEvent
  isNew: boolean
  onChange: (event: CalendarEvent) => void
  onSave: (events: CalendarEvent[]) => void
  onDelete: (id: string) => void
  onDeleteSeries: (seriesId: string) => void
  onCancel: () => void
}

const DAY_MAX = 24 * 60 - 5

/**
 * Side panel for creating/editing an event in the day view. Unlike the modal,
 * edits apply to the draft immediately so the dashed placeholder on the
 * timeline stays in sync, and dragging the placeholder updates the form.
 */
export default function EventPanel({
  event,
  isNew,
  onChange,
  onSave,
  onDelete,
  onDeleteSeries,
  onCancel
}: Props): JSX.Element {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const startTime = toTimeInput(start)
  const endTime = toTimeInput(end)
  const repeat = event.repeat ?? 'none'
  const [count, setCount] = useState(DEFAULT_OCCURRENCES)

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function setTimes(startMin: number, endMin: number): void {
    const dateStr = toDateInput(start)
    const s = fromDateTimeInputs(dateStr, hmOfMinutes(startMin))
    const e = fromDateTimeInputs(dateStr, hmOfMinutes(endMin))
    onChange({ ...event, start: s.toISOString(), end: e.toISOString() })
  }

  // Changing the start keeps the current duration and shifts the end with it.
  function changeStart(value: string): void {
    const duration = Math.max(5, minutesOfHM(endTime) - minutesOfHM(startTime))
    const startMin = minutesOfHM(value)
    setTimes(startMin, Math.min(startMin + duration, DAY_MAX))
  }

  function changeEnd(value: string): void {
    setTimes(minutesOfHM(startTime), minutesOfHM(value))
  }

  // Moving the date carries both start and end to the new day.
  function changeDate(dateStr: string): void {
    if (!dateStr) return
    const s = fromDateTimeInputs(dateStr, startTime)
    const e = fromDateTimeInputs(dateStr, endTime)
    onChange({ ...event, start: s.toISOString(), end: e.toISOString() })
  }

  function save(): void {
    let e = end
    if (e <= start) e = new Date(start.getTime() + 30 * 60_000)
    const base: CalendarEvent = {
      ...event,
      title: event.title.trim() || 'Untitled',
      description: event.description?.trim(),
      end: e.toISOString(),
      repeat
    }
    // Only a brand-new event expands into a series; editing an existing one
    // saves just that occurrence so the rest of the series is left untouched.
    onSave(isNew ? expandSeries(base, repeat === 'none' ? 1 : count) : [base])
  }

  return (
    <aside className="event-panel">
      <div className="panel-heading-row">
        <div className="modal-heading">{isNew ? 'New event' : 'Edit event'}</div>
        <button className="icon-btn" onClick={onCancel} title="Close (Esc)">
          ✕
        </button>
      </div>

      <label className="field">
        <span>Title</span>
        <TitleAutocomplete
          value={event.title}
          placeholder="Untitled"
          autoFocus
          onChange={(title) => onChange({ ...event, title })}
        />
      </label>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={event.description ?? ''}
          placeholder="What are you doing? (optional)"
          onChange={(e) => onChange({ ...event, description: e.target.value })}
        />
      </label>

      <label className="field">
        <span>Date</span>
        <input type="date" value={toDateInput(start)} onChange={(e) => changeDate(e.target.value)} />
      </label>

      <div className="field">
        <span>Start</span>
        <TimeStepper value={startTime} max={DAY_MAX} onChange={changeStart} />
      </div>
      <div className="field">
        <span>End</span>
        <TimeStepper
          value={endTime}
          min={minutesOfHM(startTime) + 5}
          max={DAY_MAX}
          onChange={changeEnd}
        />
      </div>

      {isNew ? (
        <div className="field-row">
          <label className="field">
            <span>Repeat</span>
            <select
              value={repeat}
              onChange={(e) => onChange({ ...event, repeat: e.target.value as CalendarRepeat })}
            >
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {repeat !== 'none' && (
            <label className="field">
              <span>Occurrences</span>
              <input
                type="number"
                min={1}
                max={MAX_OCCURRENCES}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          )}
        </div>
      ) : (
        event.seriesId && (
          <label className="field">
            <span>Repeat</span>
            <div className="repeat-note">🔁 {repeatLabel(repeat)} series</div>
          </label>
        )
      )}

      <div className="panel-hint">
        Drag the dashed block on the timeline to move it, or drag its bottom edge to resize.
      </div>

      <div className="modal-actions">
        <button className="btn primary" onClick={save}>
          Save
        </button>
        {!isNew && (
          <button className="btn danger" onClick={() => onDelete(event.id)}>
            Delete
          </button>
        )}
        {!isNew && event.seriesId && (
          <button
            className="btn danger"
            onClick={() => onDeleteSeries(event.seriesId as string)}
          >
            Delete series
          </button>
        )}
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </aside>
  )
}
