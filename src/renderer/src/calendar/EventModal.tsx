import { useState } from 'react'
import type { CalendarEvent } from '../types'
import {
  fromDateTimeInputs,
  hmOfMinutes,
  minutesOfHM,
  timeOptions,
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

const TIME_OPTIONS = timeOptions()
const DAY_MAX = 24 * 60 - 15

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
    const duration = Math.max(15, minutesOfHM(endTime) - minutesOfHM(startTime))
    setStartTime(value)
    setEndTime(hmOfMinutes(Math.min(minutesOfHM(value) + duration, DAY_MAX + 15)))
  }

  // Only offer end times after the start.
  const endOptions = TIME_OPTIONS.filter((o) => minutesOfHM(o) > minutesOfHM(startTime))

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
          <input
            type="text"
            value={title}
            placeholder="Untitled"
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
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

        <div className="field-row">
          <label className="field">
            <span>Start</span>
            <select value={startTime} onChange={(e) => changeStart(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>End</span>
            <select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
              {endOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
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
