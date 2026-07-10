import { useEffect, useMemo, useState } from 'react'
import type { TimeEntry, Todo } from '../types'
import TimeStepper from '../calendar/TimeStepper'
import AutocompleteInput from '../components/AutocompleteInput'
import {
  fromDateTimeInputs,
  hmOfMinutes,
  minutesOfHM,
  toDateInput,
  toTimeInput
} from '../calendar/date-utils'
import { normalizeHashtag, type TimeEntryDraft } from './entry-utils'
import {
  hashtagSuggestions,
  projectSuggestions,
  subtaskSuggestions,
  taskSuggestions
} from './suggestions'

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
  const [todos, setTodos] = useState<Todo[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])

  // Load the sources backing the field autocompletes (todos/subtasks for
  // task/subtask, past entries for project/hashtag).
  useEffect(() => {
    window.api.getTodos().then(setTodos)
    window.api.getTimeEntries().then(setEntries)
  }, [])

  const taskSugs = useMemo(() => taskSuggestions(todos, task), [todos, task])
  const subtaskSugs = useMemo(
    () => subtaskSuggestions(todos, task, subtask),
    [todos, task, subtask]
  )
  const projectSugs = useMemo(() => projectSuggestions(entries, project), [entries, project])
  const hashtagSugs = useMemo(() => hashtagSuggestions(entries, hashtag), [entries, hashtag])
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
          <AutocompleteInput
            autoFocus
            value={task}
            onChange={setTask}
            suggestions={taskSugs}
            placeholder="What did you work on?"
            onFocusRefresh={() => window.api.getTodos().then(setTodos)}
          />
        </label>
        <label className="field">
          Subtask (optional)
          <AutocompleteInput
            value={subtask}
            onChange={setSubtask}
            suggestions={subtaskSugs}
            placeholder="Which part of it?"
            onFocusRefresh={() => window.api.getTodos().then(setTodos)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            Project (optional)
            <AutocompleteInput
              value={project}
              onChange={setProject}
              suggestions={projectSugs}
              placeholder="Which project?"
              onFocusRefresh={() => window.api.getTimeEntries().then(setEntries)}
            />
          </label>
          <label className="field">
            Hashtag (optional)
            <AutocompleteInput
              value={hashtag}
              onChange={setHashtag}
              suggestions={hashtagSugs}
              placeholder="#tag"
              onFocusRefresh={() => window.api.getTimeEntries().then(setEntries)}
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
