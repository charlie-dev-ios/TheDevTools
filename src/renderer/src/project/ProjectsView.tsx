import { useEffect, useState } from 'react'
import type { Project } from '../types'

/** A small palette offered when picking a project color. */
const COLORS = ['#4c8bf5', '#34a853', '#f5a623', '#e0507a', '#a259e6', '#38b3b3']

interface Draft {
  name: string
  description: string
  color: string
}

function emptyDraft(): Draft {
  return { name: '', description: '', color: COLORS[0] }
}

export default function ProjectsView(): JSX.Element {
  const [projects, setProjects] = useState<Project[]>([])
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  useEffect(() => {
    window.api.getProjects().then(setProjects)
  }, [])

  async function persist(next: Project[]): Promise<void> {
    setProjects(next)
    await window.api.saveProjects(next)
  }

  function startNew(): void {
    setDraft(emptyDraft())
    setEditingId('new')
  }

  function startEdit(p: Project): void {
    setDraft({ name: p.name, description: p.description ?? '', color: p.color ?? COLORS[0] })
    setEditingId(p.id)
  }

  function cancel(): void {
    setEditingId(null)
    setDraft(emptyDraft())
  }

  async function save(): Promise<void> {
    const name = draft.name.trim()
    if (!name) return
    const description = draft.description.trim() || undefined
    const next =
      editingId && editingId !== 'new'
        ? projects.map((p) =>
            p.id === editingId ? { ...p, name, description, color: draft.color } : p
          )
        : [...projects, { id: crypto.randomUUID(), name, description, color: draft.color }]
    await persist(next)
    cancel()
  }

  async function remove(id: string): Promise<void> {
    await persist(projects.filter((p) => p.id !== id))
    if (editingId === id) cancel()
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
  }

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Projects</h2>
        {editingId === null && (
          <button className="link-btn" onClick={startNew}>
            + New project
          </button>
        )}
      </header>

      {editingId === 'new' && (
        <div className="crud-form" onKeyDown={onKeyDown}>
          <ProjectFields draft={draft} setDraft={setDraft} autoFocus />
          <div className="editor-actions">
            <button className="btn primary" onClick={save} disabled={!draft.name.trim()}>
              Add <span className="hint-key">⌘↵</span>
            </button>
            <button className="btn" onClick={cancel}>
              Cancel <span className="hint-key">esc</span>
            </button>
          </div>
        </div>
      )}

      {projects.length === 0 && editingId !== 'new' ? (
        <p className="empty">No projects yet. Add one to organize your time entries.</p>
      ) : (
        <ul className="list">
          {projects.map((p) =>
            editingId === p.id ? (
              <li key={p.id} className="crud-form" onKeyDown={onKeyDown}>
                <ProjectFields draft={draft} setDraft={setDraft} autoFocus />
                <div className="editor-actions">
                  <button className="btn primary" onClick={save} disabled={!draft.name.trim()}>
                    Save <span className="hint-key">⌘↵</span>
                  </button>
                  <button className="btn" onClick={cancel}>
                    Cancel <span className="hint-key">esc</span>
                  </button>
                </div>
              </li>
            ) : (
              <li key={p.id} className="row">
                <span className="row-text">
                  <span
                    className="color-dot"
                    style={{ background: p.color ?? COLORS[0] }}
                    aria-hidden
                  />
                  <strong>{p.name}</strong>
                  {p.description && <span className="crud-desc"> — {p.description}</span>}
                </span>
                <span className="row-buttons">
                  <button className="row-action" title="Edit" onClick={() => startEdit(p)}>
                    ✎
                  </button>
                  <button className="row-action" title="Delete" onClick={() => remove(p.id)}>
                    ✕
                  </button>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  )
}

function ProjectFields({
  draft,
  setDraft,
  autoFocus
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  autoFocus?: boolean
}): JSX.Element {
  return (
    <>
      <input
        className="editor-title"
        type="text"
        placeholder="Project name"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        autoFocus={autoFocus}
      />
      <input
        className="editor-title"
        type="text"
        placeholder="Description (optional)"
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
      />
      <div className="color-picker">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={c === draft.color ? 'color-swatch selected' : 'color-swatch'}
            style={{ background: c }}
            title={c}
            onClick={() => setDraft((d) => ({ ...d, color: c }))}
          />
        ))}
      </div>
    </>
  )
}
