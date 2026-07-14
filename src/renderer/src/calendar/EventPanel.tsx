import { useEffect, useMemo, useState } from 'react'
import type { CalendarEvent, CalendarRepeat, Hashtag, Project } from '../types'
import TimeStepper from './TimeStepper'
import TitleAutocomplete from './TitleAutocomplete'
import AutocompleteInput from '../components/AutocompleteInput'
import { normalizeHashtag } from '../timetracking/entry-utils'
import { hashtagSuggestions, projectSuggestions } from '../timetracking/suggestions'
import {
  fromDateTimeInputs,
  hmOfMinutes,
  minutesOfHM,
  toDateInput,
  toTimeInput,
  WEEKDAYS
} from './date-utils'
import { REPEAT_OPTIONS } from './event-utils'

interface Props {
  event: CalendarEvent
  isNew: boolean
  onChange: (event: CalendarEvent) => void
  /** Receives the edited base event; the parent expands/rebuilds the series. */
  onSave: (base: CalendarEvent) => void
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
  const repeatDays = event.repeatDays ?? []

  // Sources backing the project/hashtag autocompletes: the shared catalogs plus
  // values already used on other events.
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [hashtags, setHashtags] = useState<Hashtag[]>([])

  useEffect(() => {
    window.api.getEvents().then(setEvents)
    window.api.getProjects().then(setProjects)
    window.api.getHashtags().then(setHashtags)
  }, [])

  const projectSugs = useMemo(
    () => projectSuggestions(events.map((e) => e.project), projects, event.project ?? ''),
    [events, projects, event.project]
  )
  const hashtagSugs = useMemo(
    () => hashtagSuggestions(events.map((e) => e.hashtag), hashtags, event.hashtag ?? ''),
    [events, hashtags, event.hashtag]
  )

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

  function changeRepeat(value: CalendarRepeat): void {
    // Seed the weekday picker with the event's own weekday the first time.
    const days = value === 'weekdays' && repeatDays.length === 0 ? [start.getDay()] : event.repeatDays
    onChange({ ...event, repeat: value, repeatDays: value === 'weekdays' ? days : undefined })
  }

  function toggleDay(day: number): void {
    const next = repeatDays.includes(day)
      ? repeatDays.filter((d) => d !== day)
      : [...repeatDays, day].sort((a, b) => a - b)
    onChange({ ...event, repeatDays: next })
  }

  function save(): void {
    let e = end
    if (e <= start) e = new Date(start.getTime() + 30 * 60_000)
    const base: CalendarEvent = {
      ...event,
      title: event.title.trim() || 'Untitled',
      description: event.description?.trim(),
      project: event.project?.trim() || undefined,
      hashtag: normalizeHashtag(event.hashtag ?? ''),
      end: e.toISOString(),
      repeat,
      repeatDays: repeat === 'weekdays' ? repeatDays : undefined
    }
    onSave(base)
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

      <div className="field-row">
        <label className="field">
          <span>Project</span>
          <AutocompleteInput
            value={event.project ?? ''}
            onChange={(project) => onChange({ ...event, project })}
            suggestions={projectSugs}
            placeholder="Which project? (optional)"
            onFocusRefresh={() => window.api.getProjects().then(setProjects)}
          />
        </label>
        <label className="field">
          <span>Hashtag</span>
          <AutocompleteInput
            value={event.hashtag ?? ''}
            onChange={(hashtag) => onChange({ ...event, hashtag })}
            suggestions={hashtagSugs}
            placeholder="#tag (optional)"
            onFocusRefresh={() => window.api.getHashtags().then(setHashtags)}
          />
        </label>
      </div>

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

      <label className="field">
        <span>Repeat</span>
        <select value={repeat} onChange={(e) => changeRepeat(e.target.value as CalendarRepeat)}>
          {REPEAT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {repeat === 'weekdays' && (
        <div className="field">
          <span>Repeat on</span>
          <div className="weekday-picker">
            {WEEKDAYS.map((label, day) => (
              <button
                key={day}
                type="button"
                className={repeatDays.includes(day) ? 'weekday-chip active' : 'weekday-chip'}
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {!isNew && (
        <div className="repeat-note">
          Changing the repeat rebuilds the series from this occurrence.
        </div>
      )}

      <div className="panel-hint">
        Drag the dashed block on the timeline to move it, or drag its bottom edge to resize.
      </div>

      <div className="modal-actions">
        <button
          className="btn primary"
          disabled={repeat === 'weekdays' && repeatDays.length === 0}
          onClick={save}
        >
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
