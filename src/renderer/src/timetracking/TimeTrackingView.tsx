import { useEffect, useMemo, useState } from 'react'
import type { TimeEntry, Todo } from '../types'
import { formatTime } from '../calendar/date-utils'
import ManualEntryModal from './ManualEntryModal'

type TimerStatus = 'idle' | 'running' | 'paused'

const MAX_SUGGESTIONS = 8

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
  const [task, setTask] = useState('')
  const [subtask, setSubtask] = useState('')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  // Seconds accumulated across finished run segments (paused time excluded).
  const [accumulated, setAccumulated] = useState(0)
  // Start of the segment currently running, null while paused/idle.
  const [segmentStart, setSegmentStart] = useState<Date | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showSubtaskSuggestions, setShowSubtaskSuggestions] = useState(false)
  const [addingEntry, setAddingEntry] = useState(false)

  // This view stays mounted in the background (so a running timer survives tab
  // switches), and the Calendar tab can also record entries. Re-fetch whenever
  // the tab becomes visible so those show up.
  useEffect(() => {
    if (!active) return
    window.api.getTimeEntries().then(setEntries)
    window.api.getTodos().then(setTodos)
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

  // Incomplete todos (overdue ones included) matching the typed text.
  const suggestions = useMemo(() => {
    const query = task.trim().toLowerCase()
    const seen = new Set<string>()
    return todos
      .filter((t) => !t.completed)
      .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))
      .filter((t) => {
        if (!t.title.toLowerCase().includes(query) || seen.has(t.title)) return false
        seen.add(t.title)
        return true
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [todos, task])

  // Incomplete subtasks of the todo whose title matches the task, matching the typed text.
  const subtaskSuggestions = useMemo(() => {
    const taskName = task.trim().toLowerCase()
    const query = subtask.trim().toLowerCase()
    if (!taskName) return []
    const seen = new Set<string>()
    return todos
      .filter((t) => !t.completed && t.title.trim().toLowerCase() === taskName)
      .flatMap((t) => t.subtasks ?? [])
      .filter((s) => {
        if (s.completed || !s.title.toLowerCase().includes(query) || seen.has(s.title)) return false
        seen.add(s.title)
        return true
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [todos, task, subtask])

  // Entries are also written from the Calendar tab's Actual lane, so apply
  // changes to a fresh copy instead of trusting the local one.
  async function mutateEntries(
    change: (current: TimeEntry[]) => TimeEntry[]
  ): Promise<void> {
    const next = change(await window.api.getTimeEntries())
    setEntries(next)
    await window.api.saveTimeEntries(next)
  }

  function start(): void {
    if (!task.trim()) return
    const t = new Date()
    setStartedAt(t)
    setSegmentStart(t)
    setAccumulated(0)
    setNow(t)
    setStatus('running')
    setShowSuggestions(false)
    setShowSubtaskSuggestions(false)
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
  }

  async function remove(id: string): Promise<void> {
    await mutateEntries((current) => current.filter((e) => e.id !== id))
  }

  // Manual entries are independent of the timer, so they can be added while it runs.
  async function addManual(draft: {
    task: string
    subtask?: string
    start: Date
    end: Date
  }): Promise<void> {
    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      task: draft.task,
      subtask: draft.subtask,
      start: draft.start.toISOString(),
      end: draft.end.toISOString(),
      seconds: Math.round((draft.end.getTime() - draft.start.getTime()) / 1000)
    }
    await mutateEntries((current) => [entry, ...current])
    setAddingEntry(false)
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
        <div className="autocomplete">
          <input
            className="task-input"
            value={task}
            disabled={!idle}
            placeholder="What are you working on?"
            onChange={(e) => {
              setTask(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => {
              // Refresh so todos added on the Todos tab show up.
              window.api.getTodos().then(setTodos)
              setShowSuggestions(true)
            }}
            onBlur={() => setShowSuggestions(false)}
          />
          {idle && showSuggestions && suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    // Keep the input's blur from closing the list before the click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setTask(t.title)
                      setShowSuggestions(false)
                    }}
                  >
                    <span className="suggestion-title">{t.title}</span>
                    <span className="suggestion-due">{t.due}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="autocomplete">
          <input
            className="task-input subtask-input"
            value={subtask}
            disabled={!idle}
            placeholder="Subtask (optional)"
            onChange={(e) => {
              setSubtask(e.target.value)
              setShowSubtaskSuggestions(true)
            }}
            onFocus={() => {
              // Refresh so subtasks added on the Todos tab show up.
              window.api.getTodos().then(setTodos)
              setShowSubtaskSuggestions(true)
            }}
            onBlur={() => setShowSubtaskSuggestions(false)}
          />
          {idle && showSubtaskSuggestions && subtaskSuggestions.length > 0 && (
            <ul className="suggestions">
              {subtaskSuggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    // Keep the input's blur from closing the list before the click lands.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSubtask(s.title)
                      setShowSubtaskSuggestions(false)
                    }}
                  >
                    <span className="suggestion-title">{s.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
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
              </span>
              <span className="entry-range">
                {formatEntryDate(e.start)} · {formatTime(new Date(e.start))}–
                {formatTime(new Date(e.end))}
              </span>
              <span className="entry-duration">{formatDuration(e.seconds)}</span>
              <span className="row-buttons">
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
    </div>
  )
}
