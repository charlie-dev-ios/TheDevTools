import { useEffect, useMemo, useState } from 'react'
import type { TimeEntry, Todo } from '../types'
import { formatTime, toDateInput } from '../calendar/date-utils'

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

export default function TimeTrackingView(): JSX.Element {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [task, setTask] = useState('')
  const [status, setStatus] = useState<TimerStatus>('idle')
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  // Seconds accumulated across finished run segments (paused time excluded).
  const [accumulated, setAccumulated] = useState(0)
  // Start of the segment currently running, null while paused/idle.
  const [segmentStart, setSegmentStart] = useState<Date | null>(null)
  const [now, setNow] = useState<Date>(() => new Date())
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    window.api.getTimeEntries().then(setEntries)
    window.api.getTodos().then(setTodos)
  }, [])

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

  // Incomplete todos due today or later, matching the typed text.
  const suggestions = useMemo(() => {
    const today = toDateInput(new Date())
    const query = task.trim().toLowerCase()
    const seen = new Set<string>()
    return todos
      .filter((t) => !t.completed && t.due >= today)
      .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))
      .filter((t) => {
        if (!t.title.toLowerCase().includes(query) || seen.has(t.title)) return false
        seen.add(t.title)
        return true
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [todos, task])

  async function persist(next: TimeEntry[]): Promise<void> {
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
      start: startedAt.toISOString(),
      end: end.toISOString(),
      seconds: Math.round(total)
    }
    void persist([entry, ...entries])
    setStatus('idle')
    setStartedAt(null)
    setSegmentStart(null)
    setAccumulated(0)
    setTask('')
  }

  async function remove(id: string): Promise<void> {
    await persist(entries.filter((e) => e.id !== id))
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
              <span className="row-text">{e.task}</span>
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
    </div>
  )
}
