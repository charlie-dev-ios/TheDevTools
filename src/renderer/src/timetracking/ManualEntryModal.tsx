import { useState } from 'react'
import TimeStepper from '../calendar/TimeStepper'
import {
  fromDateTimeInputs,
  hmOfMinutes,
  minutesOfHM,
  toDateInput,
  toTimeInput
} from '../calendar/date-utils'
import { normalizeHashtag, type TimeEntryDraft } from './entry-utils'

const DAY_MAX = 24 * 60 - 5

interface Props {
  /** Switches the copy from adding a new entry to editing an existing one. */
  editing?: boolean
  /** Prefill for the task field. */
  initialTask?: string
  /** Prefill for the subtask field. */
  initialSubtask?: string
  /** Prefill for the project field. */
  initialProject?: string
  /** Prefill for the hashtag field (without the leading '#'). */
  initialHashtag?: string
  /** Prefill for the start field. Defaults to one hour ago. */
  initialStart?: Date
  /** Prefill for the end field. Defaults to now. */
  initialEnd?: Date
  onSave: (draft: TimeEntryDraft) => void
  /** When provided, a Delete button is shown. */
  onDelete?: () => void
  onCancel: () => void
}

/** Modal for recording or editing a time entry by hand, independent of the timer. */
export default function ManualEntryModal({
  editing = false,
  initialTask,
  initialSubtask,
  initialProject,
  initialHashtag,
  initialStart,
  initialEnd,
  onSave,
  onDelete,
  onCancel
}: Props): JSX.Element {
  const [task, setTask] = useState(initialTask ?? '')
  const [subtask, setSubtask] = useState(initialSubtask ?? '')
  const [project, setProject] = useState(initialProject ?? '')
  const [hashtag, setHashtag] = useState(initialHashtag ?? '')
  const [date, setDate] = useState(() => toDateInput(initialStart ?? new Date()))
  // Default to the past hour so the fields land near what was just worked on.
  const [startTime, setStartTime] = useState(() =>
    toTimeInput(initialStart ?? new Date(Date.now() - 3600_000))
  )
  const [endTime, setEndTime] = useState(() => toTimeInput(initialEnd ?? new Date()))

  const start = date && startTime ? fromDateTimeInputs(date, startTime) : null
  const end = date && endTime ? fromDateTimeInputs(date, endTime) : null
  const valid = task.trim().length > 0 && start !== null && end !== null && end > start

  // Changing the start keeps the current duration and shifts the end with it.
  function changeStart(value: string): void {
    const duration = Math.max(5, minutesOfHM(endTime) - minutesOfHM(startTime))
    setStartTime(value)
    setEndTime(hmOfMinutes(Math.min(minutesOfHM(value) + duration, DAY_MAX)))
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    if (!valid || !start || !end) return
    onSave({
      task: task.trim(),
      subtask: subtask.trim() || undefined,
      project: project.trim() || undefined,
      hashtag: normalizeHashtag(hashtag),
      start,
      end
    })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-heading">{editing ? 'Edit time entry' : 'Add time entry'}</div>
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
            Project (optional)
            <input
              value={project}
              placeholder="Which project?"
              onChange={(e) => setProject(e.target.value)}
            />
          </label>
          <label className="field">
            Hashtag (optional)
            <input
              value={hashtag}
              placeholder="#tag"
              onChange={(e) => setHashtag(e.target.value)}
            />
          </label>
        </div>
        <label className="field">
          Date
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
        {start && end && end <= start && (
          <div className="field-error">End time must be after start time.</div>
        )}
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={!valid}>
            {editing ? 'Save' : 'Add'}
          </button>
          {onDelete && (
            <button type="button" className="btn danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
