import { useState } from 'react'
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
  onSave: (events: CalendarEvent[]) => void
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
  const [count, setCount] = useState(DEFAULT_OCCURRENCES)

  // Changing the start keeps the current duration and shifts the end with it.
  function changeStart(value: string): void {
    const duration = Math.max(5, minutesOfHM(endTime) - minutesOfHM(startTime))
    setStartTime(value)
    setEndTime(hmOfMinutes(Math.min(minutesOfHM(value) + duration, DAY_MAX)))
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
      repeat
    }
    // Only a brand-new event expands into a series; editing an existing one
    // saves just that occurrence so the rest of the series is left untouched.
    onSave(isNew ? expandSeries(base, repeat === 'none' ? 1 : count) : [base])
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

        {isNew ? (
          <div className="field-row">
            <label className="field">
              <span>Repeat</span>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as CalendarRepeat)}
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
            <div className="field">
              <span>Repeat</span>
              <div className="repeat-note">🔁 {repeatLabel(event.repeat ?? 'none')} series</div>
            </div>
          )
        )}

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
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
