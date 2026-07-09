import { useEffect, useMemo, useState } from 'react'
import type { Subtask, Todo, TodoRepeat } from '../types'
import { toDateInput, WEEKDAYS } from '../calendar/date-utils'

const REPEAT_OPTIONS: { value: TodoRepeat; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekdays', label: 'Weekly on days…' },
  { value: 'monthly', label: 'Monthly' }
]

function repeatLabel(repeat: TodoRepeat, repeatDays?: number[]): string {
  if (repeat === 'weekdays') {
    const days = [...(repeatDays ?? [])].sort((a, b) => a - b)
    return days.length > 0 ? days.map((d) => WEEKDAYS[d]).join(' · ') : 'Weekly'
  }
  return REPEAT_OPTIONS.find((o) => o.value === repeat)?.label ?? repeat
}

function formatDue(due: string): string {
  const [y, m, d] = due.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function dueStatus(due: string): 'overdue' | 'today' | 'upcoming' {
  const today = toDateInput(new Date())
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return 'upcoming'
}

export default function TodoView(): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [editing, setEditing] = useState<Todo | 'new' | null>(null)

  useEffect(() => {
    window.api.getTodos().then(setTodos)
  }, [])

  async function update(next: Todo[]): Promise<void> {
    setTodos(next)
    // The main process may roll repeating todos forward; keep in sync with it.
    setTodos(await window.api.saveTodos(next))
  }

  async function save(draft: {
    id?: string
    title: string
    due: string
    repeat: TodoRepeat
    repeatDays?: number[]
    subtasks: Subtask[]
  }): Promise<void> {
    const fields = {
      title: draft.title,
      due: draft.due,
      repeat: draft.repeat,
      repeatDays: draft.repeat === 'weekdays' ? draft.repeatDays : undefined,
      subtasks: draft.subtasks.length > 0 ? draft.subtasks : undefined
    }
    const next = draft.id
      ? todos.map((t) => (t.id === draft.id ? { ...t, ...fields } : t))
      : [...todos, { id: crypto.randomUUID(), ...fields, completed: false }]
    await update(next)
    setEditing(null)
  }

  async function remove(id: string): Promise<void> {
    await update(todos.filter((t) => t.id !== id))
  }

  // The next occurrence of a repeating todo is created by the main process
  // on the first fetch of the day it becomes due, not here at completion time.
  async function toggle(todo: Todo): Promise<void> {
    await update(todos.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)))
  }

  async function toggleSubtask(todo: Todo, subtaskId: string): Promise<void> {
    await update(
      todos.map((t) =>
        t.id === todo.id
          ? {
              ...t,
              subtasks: t.subtasks?.map((s) =>
                s.id === subtaskId ? { ...s, completed: !s.completed } : s
              )
            }
          : t
      )
    )
  }

  async function clearCompleted(): Promise<void> {
    await update(todos.filter((t) => !t.completed))
  }

  const active = useMemo(
    () =>
      todos
        .filter((t) => !t.completed)
        .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title)),
    [todos]
  )
  const completed = useMemo(
    () =>
      todos
        .filter((t) => t.completed)
        .sort((a, b) => b.due.localeCompare(a.due) || a.title.localeCompare(b.title)),
    [todos]
  )

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Todos</h2>
        <button className="link-btn" onClick={() => setEditing('new')}>
          + New todo
        </button>
      </header>

      {todos.length === 0 ? (
        <p className="empty">No todos yet. Add one!</p>
      ) : (
        <div className="todo-scroll">
          {active.length === 0 ? (
            <p className="empty">All done 🎉</p>
          ) : (
            <ul className="list">
              {active.map((t) => (
                <TodoRow
                  key={t.id}
                  todo={t}
                  onToggle={toggle}
                  onToggleSubtask={toggleSubtask}
                  onEdit={setEditing}
                  onRemove={remove}
                />
              ))}
            </ul>
          )}

          {completed.length > 0 && (
            <>
              <div className="todo-section">
                <span>Completed ({completed.length})</span>
                <button className="link-btn" onClick={clearCompleted}>
                  Clear completed
                </button>
              </div>
              <ul className="list">
                {completed.map((t) => (
                  <TodoRow
                    key={t.id}
                    todo={t}
                    onToggle={toggle}
                    onToggleSubtask={toggleSubtask}
                    onEdit={setEditing}
                    onRemove={remove}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {editing && (
        <TodoModal
          initial={editing === 'new' ? null : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function TodoRow({
  todo,
  onToggle,
  onToggleSubtask,
  onEdit,
  onRemove
}: {
  todo: Todo
  onToggle: (todo: Todo) => void
  onToggleSubtask: (todo: Todo, subtaskId: string) => void
  onEdit: (todo: Todo) => void
  onRemove: (id: string) => void
}): JSX.Element {
  const status = dueStatus(todo.due)
  const subtasks = todo.subtasks ?? []
  const doneCount = subtasks.filter((s) => s.completed).length
  return (
    <li className="todo-item">
      <div
        className={todo.completed ? 'row todo-row done' : 'row todo-row'}
        onClick={() => onEdit(todo)}
      >
        <input
          type="checkbox"
          className="todo-check"
          checked={todo.completed}
          title={todo.completed ? 'Mark as not done' : 'Mark as done'}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggle(todo)}
        />
        <span className="row-text todo-title">{todo.title}</span>
        {subtasks.length > 0 && (
          <span className="todo-progress" title={`Subtasks: ${doneCount}/${subtasks.length} done`}>
            ☑ {doneCount}/{subtasks.length}
          </span>
        )}
        {todo.repeat !== 'none' && (
          <span
            className="todo-repeat"
            title={`Repeats: ${repeatLabel(todo.repeat, todo.repeatDays)}`}
          >
            🔁 {repeatLabel(todo.repeat, todo.repeatDays)}
          </span>
        )}
        <span className={todo.completed ? 'todo-due' : `todo-due ${status}`}>
          {status === 'today' && !todo.completed ? 'Today' : formatDue(todo.due)}
        </span>
        <span className="row-buttons">
          <button
            className="row-action"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(todo)
            }}
          >
            ✎
          </button>
          <button
            className="row-action"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              onRemove(todo.id)
            }}
          >
            ✕
          </button>
        </span>
      </div>
      {subtasks.length > 0 && (
        <ul className="todo-subtasks">
          {subtasks.map((s) => (
            <li key={s.id} className={s.completed ? 'subtask-row done' : 'subtask-row'}>
              <input
                type="checkbox"
                className="todo-check subtask-check"
                checked={s.completed}
                title={s.completed ? 'Mark as not done' : 'Mark as done'}
                onChange={() => onToggleSubtask(todo, s.id)}
              />
              <span className="subtask-title">{s.title}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function TodoModal({
  initial,
  onSave,
  onCancel
}: {
  initial: Todo | null
  onSave: (draft: {
    id?: string
    title: string
    due: string
    repeat: TodoRepeat
    repeatDays?: number[]
    subtasks: Subtask[]
  }) => void
  onCancel: () => void
}): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [due, setDue] = useState(initial?.due ?? toDateInput(new Date()))
  const [repeat, setRepeat] = useState<TodoRepeat>(initial?.repeat ?? 'none')
  const [repeatDays, setRepeatDays] = useState<number[]>(initial?.repeatDays ?? [])
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial?.subtasks ?? [])
  const [newSubtask, setNewSubtask] = useState('')

  const valid =
    title.trim().length > 0 && due.length > 0 && (repeat !== 'weekdays' || repeatDays.length > 0)

  function toggleDay(day: number): void {
    setRepeatDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
    )
  }

  function changeRepeat(value: TodoRepeat): void {
    setRepeat(value)
    // Seed the weekday picker with the due date's weekday the first time.
    if (value === 'weekdays' && repeatDays.length === 0 && due) {
      const [y, m, d] = due.split('-').map(Number)
      setRepeatDays([new Date(y, m - 1, d).getDay()])
    }
  }

  function addSubtask(): void {
    const t = newSubtask.trim()
    if (!t) return
    setSubtasks((list) => [...list, { id: crypto.randomUUID(), title: t, completed: false }])
    setNewSubtask('')
  }

  function renameSubtask(id: string, value: string): void {
    setSubtasks((list) => list.map((s) => (s.id === id ? { ...s, title: value } : s)))
  }

  function removeSubtask(id: string): void {
    setSubtasks((list) => list.filter((s) => s.id !== id))
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    if (!valid) return
    // Include text still sitting in the "add" box so it isn't silently lost.
    const pending = newSubtask.trim()
    const cleaned = [
      ...subtasks.map((s) => ({ ...s, title: s.title.trim() })),
      ...(pending ? [{ id: crypto.randomUUID(), title: pending, completed: false }] : [])
    ].filter((s) => s.title.length > 0)
    onSave({
      id: initial?.id,
      title: title.trim(),
      due,
      repeat,
      repeatDays: repeat === 'weekdays' ? repeatDays : undefined,
      subtasks: cleaned
    })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-heading">{initial ? 'Edit todo' : 'New todo'}</div>
        <label className="field">
          Title
          <input
            autoFocus
            value={title}
            placeholder="What needs doing?"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field">
            Due date
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="field">
            Repeat
            <select value={repeat} onChange={(e) => changeRepeat(e.target.value as TodoRepeat)}>
              {REPEAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="field">
          Subtasks
          {subtasks.length > 0 && (
            <ul className="subtask-editor">
              {subtasks.map((s) => (
                <li key={s.id} className="subtask-editor-row">
                  <input
                    type="checkbox"
                    className="todo-check subtask-check"
                    checked={s.completed}
                    title={s.completed ? 'Mark as not done' : 'Mark as done'}
                    onChange={() =>
                      setSubtasks((list) =>
                        list.map((x) => (x.id === s.id ? { ...x, completed: !x.completed } : x))
                      )
                    }
                  />
                  <input
                    value={s.title}
                    placeholder="Subtask"
                    onChange={(e) => renameSubtask(s.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="row-action subtask-remove"
                    title="Remove subtask"
                    onClick={() => removeSubtask(s.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="subtask-add">
            <input
              value={newSubtask}
              placeholder="Add a subtask…"
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                // Ignore Enter used to confirm an IME conversion, otherwise the
                // in-progress candidate gets inserted as a subtask.
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  // Enter adds the subtask instead of submitting the form.
                  e.preventDefault()
                  addSubtask()
                }
              }}
            />
            <button type="button" className="btn" disabled={!newSubtask.trim()} onClick={addSubtask}>
              +
            </button>
          </div>
        </div>
        {repeat === 'weekdays' && (
          <div className="field">
            Repeat on
            <div className="weekday-picker">
              {WEEKDAYS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  className={repeatDays.includes(day) ? 'weekday-chip active' : 'weekday-chip'}
                  onClick={() => toggleDay(day)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={!valid}>
            {initial ? 'Save' : 'Add'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
