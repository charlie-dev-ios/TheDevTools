import { useState } from 'react'
import type { CalendarEvent } from '../types'
import { fromDateTimeInputs, toDateInput, toTimeInput } from './date-utils'

interface Props {
  event: CalendarEvent
  isNew: boolean
  onSave: (event: CalendarEvent) => void
  onDelete: (id: string) => void
  onClose: () => void
}

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
  const [date, setDate] = useState(toDateInput(start))
  const [startTime, setStartTime] = useState(toTimeInput(start))
  const [endTime, setEndTime] = useState(toTimeInput(end))

  function save(): void {
    const s = fromDateTimeInputs(date, startTime)
    let e = fromDateTimeInputs(date, endTime)
    // Guarantee the event ends after it starts.
    if (e <= s) e = new Date(s.getTime() + 30 * 60_000)
    onSave({
      ...event,
      title: title.trim() || 'Untitled',
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
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Start</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="field">
            <span>End</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
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
