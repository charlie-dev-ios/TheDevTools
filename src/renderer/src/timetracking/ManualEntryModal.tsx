import { useState } from 'react'
import { fromDateTimeInputs, toDateInput, toTimeInput } from '../calendar/date-utils'

interface Props {
  /** Prefill for the start field. Defaults to one hour ago. */
  initialStart?: Date
  /** Prefill for the end field. Defaults to now. */
  initialEnd?: Date
  onSave: (draft: { task: string; subtask?: string; start: Date; end: Date }) => void
  onCancel: () => void
}

/** Modal for recording a time entry by hand, independent of the timer. */
export default function ManualEntryModal({
  initialStart,
  initialEnd,
  onSave,
  onCancel
}: Props): JSX.Element {
  const [task, setTask] = useState('')
  const [subtask, setSubtask] = useState('')
  const [date, setDate] = useState(() => toDateInput(initialStart ?? new Date()))
  // Default to the past hour so the fields land near what was just worked on.
  const [startTime, setStartTime] = useState(() =>
    toTimeInput(initialStart ?? new Date(Date.now() - 3600_000))
  )
  const [endTime, setEndTime] = useState(() => toTimeInput(initialEnd ?? new Date()))

  const start = date && startTime ? fromDateTimeInputs(date, startTime) : null
  const end = date && endTime ? fromDateTimeInputs(date, endTime) : null
  const valid = task.trim().length > 0 && start !== null && end !== null && end > start

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    if (!valid || !start || !end) return
    onSave({ task: task.trim(), subtask: subtask.trim() || undefined, start, end })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-heading">Add time entry</div>
        <label className="field">
          Task
          <input
            autoFocus
            value={task}
            placeholder="What did you work on?"
            onChange={(e) => setTask(e.target.value)}
          />
        </label>
        <label className="field">
          Subtask (optional)
          <input
            value={subtask}
            placeholder="Which part of it?"
            onChange={(e) => setSubtask(e.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            Start
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="field">
            End
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        {start && end && end <= start && (
          <div className="field-error">End time must be after start time.</div>
        )}
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={!valid}>
            Add
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
