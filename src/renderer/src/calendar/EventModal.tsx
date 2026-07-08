import { useState } from 'react'
import type { CalendarEvent } from '../types'
import TimeStepper from './TimeStepper'
import TitleAutocomplete from './TitleAutocomplete'
import {
  fromDateTimeInputs,
  hmOfMinutes,
  minutesOfHM,
  toDateInput,
  toTimeInput
} from './date-utils'

interface Props {
  event: CalendarEvent
  isNew: boolean
  onSave: (event: CalendarEvent) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const DAY_MAX = 24 * 60 - 5

export default function EventModal({
  event,
  isNew,
  onSave,
  onDelete,
  onClose
}: Props): JSX.Element {
  const start = new Date(event.start)
  const end = new Date(event.end)

  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description ?? '')
  const [date, setDate] = useState(toDateInput(start))
  const [startTime, setStartTime] = useState(toTimeInput(start))
  const [endTime, setEndTime] = useState(toTimeInput(end))

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
    onSave({
      ...event,
      title: title.trim() || 'Untitled',
      description: description.trim(),
      start: s.toISOString(),
      end: e.toISOString()
    })
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

        <div className="modal-actions">
          <button className="btn primary" onClick={save}>
            Save
          </button>
          {!isNew && (
            <button className="btn danger" onClick={() => onDelete(event.id)}>
              Delete
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
