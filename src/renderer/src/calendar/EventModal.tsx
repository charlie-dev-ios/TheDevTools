import { useState } from 'react'
import type { CalendarEvent, CalendarRepeat } from '../types'
import TimeStepper from './TimeStepper'
import TitleAutocomplete from './TitleAutocomplete'
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
  /** Receives the edited base event; the parent expands/rebuilds the series. */
  onSave: (base: CalendarEvent) => void
  onDelete: (id: string) => void
  onDeleteSeries: (seriesId: string) => void
  onClose: () => void
}

const DAY_MAX = 24 * 60 - 5

export default function EventModal({
  event,
  isNew,
  onSave,
  onDelete,
  onDeleteSeries,
  onClose
}: Props): JSX.Element {
  const start = new Date(event.start)
  const end = new Date(event.end)

  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? '')
  const [date, setDate] = useState(toDateInput(start))
  const [startTime, setStartTime] = useState(toTimeInput(start))
  const [endTime, setEndTime] = useState(toTimeInput(end))
  const [repeat, setRepeat] = useState<CalendarRepeat>(event.repeat ?? 'none')
  const [repeatDays, setRepeatDays] = useState<number[]>(event.repeatDays ?? [])
  const [notify, setNotify] = useState(event.notify !== false)

  // Changing the start keeps the current duration and shifts the end with it.
  function changeStart(value: string): void {
    const duration = Math.max(5, minutesOfHM(endTime) - minutesOfHM(startTime))
    setStartTime(value)
    setEndTime(hmOfMinutes(Math.min(minutesOfHM(value) + duration, DAY_MAX)))
  }

  function toggleDay(day: number): void {
    setRepeatDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
    )
  }

  function changeRepeat(value: CalendarRepeat): void {
    setRepeat(value)
    // Seed the weekday picker with the event's own weekday the first time.
    if (value === 'weekdays' && repeatDays.length === 0) {
      setRepeatDays([fromDateTimeInputs(date, startTime).getDay()])
    }
  }

  function save(): void {
    const s = fromDateTimeInputs(date, startTime)
    let e = fromDateTimeInputs(date, endTime)
    if (e <= s) e = new Date(s.getTime() + 30 * 60_000)
    const base: CalendarEvent = {
      ...event,
      title: title.trim() || 'Untitled',
      description: description.trim(),
      start: s.toISOString(),
      end: e.toISOString(),
      repeat,
      repeatDays: repeat === 'weekdays' ? repeatDays : undefined,
      notify
    }
    onSave(base)
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading">{isNew ? 'New event' : 'Edit event'}</div>

        <label className="field">
          <span>Title</span>
          <TitleAutocomplete
            value={title}
            placeholder="Untitled"
            autoFocus
            onChange={setTitle}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            rows={3}
            value={description}
            placeholder="What are you doing? (optional)"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            onChange={setEndTime}
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

        <label className="field-check">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          <span>Remind me 10 &amp; 5 minutes before it starts and ends</span>
        </label>

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
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
