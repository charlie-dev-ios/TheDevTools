import { useEffect, useMemo, useState } from 'react'
import type { TimeEntry, Todo, Project, Hashtag } from '../types'
import { formatTime } from '../calendar/date-utils'
import AutocompleteInput from '../components/AutocompleteInput'
import ManualEntryModal from './ManualEntryModal'
import {
  applyEntryEdit,
  entryFromDraft,
  normalizeHashtag,
  type TimeEntryDraft
} from './entry-utils'
import {
  hashtagSuggestions,
  projectSuggestions,
  subtaskSuggestions,
  taskSuggestions
} from './suggestions'

type TimerStatus = 'idle' | 'running' | 'paused'

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default function TimeTrackingView({ active = true }: { active?: boolean }): JSX.Element {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [hashtags, setHashtags] = useState<Hashtag[]>([])
  const [task, setTask] = useState('')
  const [subtask, setSubtask] = useState('')
  const [project, setProject] = useState('')
  const [hashtag, setHashtag] = useState('')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  // Seconds accumulated across finished run segments (paused time excluded).
  const [accumulated, setAccumulated] = useState(0)
  // Start of the segment currently running, null while paused/idle.
  const [segmentStart, setSegmentStart] = useState<Date | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [addingEntry, setAddingEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)

  // This view stays mounted in the background (so a running timer survives tab
  // switches), and the Calendar tab can also record entries. Re-fetch whenever
  // the tab becomes visible so those show up.
  useEffect(() => {
    if (!active) return
    window.api.getTimeEntries().then(setEntries)
    window.api.getTodos().then(setTodos)
    window.api.getProjects().then(setProjects)
    window.api.getHashtags().then(setHashtags)
  }, [active])

  // Tick every second while running so the display stays live.
  useEffect(() => {
    if (status !== 'running') return
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [status])

  const elapsed =
    accumulated +
    (status === 'running' && segmentStart
      ? (now.getTime() - segmentStart.getTime()) / 1000
      : 0)

  const taskSugs = useMemo(() => taskSuggestions(todos, task), [todos, task])
  const subtaskSugs = useMemo(
    () => subtaskSuggestions(todos, task, subtask),
    [todos, task, subtask]
  )
  const projectSugs = useMemo(
    () => projectSuggestions(entries, projects, project),
    [entries, projects, project]
  )
  const hashtagSugs = useMemo(
    () => hashtagSuggestions(entries, hashtags, hashtag),
    [entries, hashtags, hashtag]
  )

  // Entries are also written from the Calendar tab's Actual lane, so apply
  // changes to a fresh copy instead of trusting the local one.
  async function mutateEntries(
    change: (current: TimeEntry[]) => TimeEntry[]
  ): Promise<void> {
    const next = change(await window.api.getTimeEntries())
    setEntries(next)
    await window.api.saveTimeEntries(next)
  }

  function startTimer(): void {
    const t = new Date()
    setStartedAt(t)
    setSegmentStart(t)
    setAccumulated(0)
    setNow(t)
    setStatus('running')
  }

  function start(): void {
    if (!task.trim()) return
    startTimer()
  }

  // Start the timer again with a finished entry's task and subtask.
  function restart(entry: TimeEntry): void {
    if (status !== 'idle') return
    setTask(entry.task)
    setSubtask(entry.subtask ?? '')
    setProject(entry.project ?? '')
    setHashtag(entry.hashtag ?? '')
    startTimer()
  }

  function pause(): void {
    if (segmentStart) {
      setAccumulated((acc) => acc + (Date.now() - segmentStart.getTime()) / 1000)
    }
    setSegmentStart(null)
    setStatus('paused')
  }

  function resume(): void {
    const t = new Date()
    setSegmentStart(t)
    setNow(t)
    setStatus('running')
  }

  function stop(): void {
    if (!startedAt) return
    const end = new Date()
    const total =
      accumulated + (segmentStart ? (end.getTime() - segmentStart.getTime()) / 1000 : 0)
    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      task: task.trim(),
      subtask: subtask.trim() || undefined,
      project: project.trim() || undefined,
      hashtag: normalizeHashtag(hashtag),
      start: startedAt.toISOString(),
      end: end.toISOString(),
      seconds: Math.round(total)
    }
    void mutateEntries((current) => [entry, ...current])
    setStatus('idle')
    setStartedAt(null)
    setSegmentStart(null)
    setAccumulated(0)
    setTask('')
    setSubtask('')
    setProject('')
    setHashtag('')
  }

  async function remove(id: string): Promise<void> {
    await mutateEntries((current) => current.filter((e) => e.id !== id))
  }

  // Manual entries are independent of the timer, so they can be added while it runs.
  async function addManual(draft: TimeEntryDraft): Promise<void> {
    await mutateEntries((current) => [entryFromDraft(draft), ...current])
    setAddingEntry(false)
  }

  async function saveEdit(draft: TimeEntryDraft): Promise<void> {
    const target = editingEntry
    if (!target) return
    await mutateEntries((current) =>
      current.map((e) => (e.id === target.id ? applyEntryEdit(e, draft) : e))
    )
    setEditingEntry(null)
  }

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.start.localeCompare(a.start)),
    [entries]
  )

  const idle = status === 'idle'

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Time Tracking</h2>
        <button className="link-btn" onClick={() => setAddingEntry(true)}>
          + Add entry
        </button>
      </header>

      <div className="timer-card">
        <AutocompleteInput
          inputClassName="task-input"
          value={task}
          onChange={setTask}
          suggestions={taskSugs}
          disabled={!idle}
          placeholder="What are you working on?"
          // Refresh so todos added on the Todos tab show up.
          onFocusRefresh={() => window.api.getTodos().then(setTodos)}
        />

        <AutocompleteInput
          inputClassName="task-input subtask-input"
          value={subtask}
          onChange={setSubtask}
          suggestions={subtaskSugs}
          disabled={!idle}
          placeholder="Subtask (optional)"
          // Refresh so subtasks added on the Todos tab show up.
          onFocusRefresh={() => window.api.getTodos().then(setTodos)}
        />

        <div className="timer-meta">
          <AutocompleteInput
            inputClassName="task-input meta-input"
            value={project}
            onChange={setProject}
            suggestions={projectSugs}
            disabled={!idle}
            placeholder="Project (optional)"
            onFocusRefresh={() => {
              window.api.getTimeEntries().then(setEntries)
              window.api.getProjects().then(setProjects)
            }}
          />
          <AutocompleteInput
            inputClassName="task-input meta-input"
            value={hashtag}
            onChange={setHashtag}
            suggestions={hashtagSugs}
            disabled={!idle}
            placeholder="#hashtag (optional)"
            onFocusRefresh={() => {
              window.api.getTimeEntries().then(setEntries)
              window.api.getHashtags().then(setHashtags)
            }}
          />
        </div>

        <div className={status === 'running' ? 'timer-display running' : 'timer-display'}>
          {formatDuration(elapsed)}
        </div>

        <div className="timer-controls">
          {idle ? (
            <button className="btn primary" disabled={!task.trim()} onClick={start}>
              ▶ Start
            </button>
          ) : (
            <>
              {status === 'running' ? (
                <button className="btn" onClick={pause}>
                  ⏸ Pause
                </button>
              ) : (
                <button className="btn primary" onClick={resume}>
                  ▶ Resume
                </button>
              )}
              <button className="btn danger" onClick={stop}>
                ⏹ Stop
              </button>
            </>
          )}
        </div>

        {!idle && (
          <div className="timer-task">
            Tracking: <strong>{task}</strong>
            {subtask.trim() && (
              <>
                {' › '}
                <strong>{subtask.trim()}</strong>
              </>
            )}
            {status === 'paused' && ' (paused)'}
            {(project.trim() || normalizeHashtag(hashtag)) && (
              <div className="entry-tags">
                {project.trim() && <span className="tag-chip project-chip">{project.trim()}</span>}
                {normalizeHashtag(hashtag) && (
                  <span className="tag-chip hashtag-chip">#{normalizeHashtag(hashtag)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="todo-section">
        <span>Tracked ({sorted.length})</span>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">Nothing tracked yet. Enter a task and start the timer!</p>
      ) : (
        <ul className="list">
          {sorted.map((e) => (
            <li key={e.id} className="row entry-row">
              <span className="row-text">
                {e.task}
                {e.subtask && <span className="entry-subtask"> › {e.subtask}</span>}
                {(e.project || e.hashtag) && (
                  <span className="entry-tags">
                    {e.project && <span className="tag-chip project-chip">{e.project}</span>}
                    {e.hashtag && <span className="tag-chip hashtag-chip">#{e.hashtag}</span>}
                  </span>
                )}
              </span>
              <span className="entry-range">
                {formatEntryDate(e.start)} · {formatTime(new Date(e.start))}–
                {formatTime(new Date(e.end))}
              </span>
              <span className="entry-duration">{formatDuration(e.seconds)}</span>
              <span className="row-buttons">
                <button
                  className="row-action"
                  title={idle ? 'Start this task again' : 'Stop the running timer first'}
                  disabled={!idle}
                  onClick={() => restart(e)}
                >
                  ▶
                </button>
                <button className="row-action" title="Edit" onClick={() => setEditingEntry(e)}>
                  ✎
                </button>
                <button className="row-action" title="Delete" onClick={() => remove(e.id)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {addingEntry && (
        <ManualEntryModal onSave={addManual} onCancel={() => setAddingEntry(false)} />
      )}

      {editingEntry && (
        <ManualEntryModal
          editing
          initialTask={editingEntry.task}
          initialSubtask={editingEntry.subtask}
          initialProject={editingEntry.project}
          initialHashtag={editingEntry.hashtag}
          initialStart={new Date(editingEntry.start)}
          initialEnd={new Date(editingEntry.end)}
          onSave={saveEdit}
          onDelete={() => {
            void remove(editingEntry.id)
            setEditingEntry(null)
          }}
          onCancel={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
