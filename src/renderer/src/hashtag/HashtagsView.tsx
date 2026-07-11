import { useEffect, useState } from 'react'
import type { Hashtag } from '../types'
import { normalizeHashtag } from '../timetracking/entry-utils'

/** A small palette offered when picking a hashtag color. */
const COLORS = ['#34a853', '#4c8bf5', '#f5a623', '#e0507a', '#a259e6', '#38b3b3']

interface Draft {
  name: string
  color: string
}

function emptyDraft(): Draft {
  return { name: '', color: COLORS[0] }
}

export default function HashtagsView(): JSX.Element {
  const [hashtags, setHashtags] = useState<Hashtag[]>([])
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.getHashtags().then(setHashtags)
  }, [])

  async function persist(next: Hashtag[]): Promise<void> {
    setHashtags(next)
    await window.api.saveHashtags(next)
  }

  function startNew(): void {
    setDraft(emptyDraft())
    setError(null)
    setEditingId('new')
  }

  function startEdit(h: Hashtag): void {
    setDraft({ name: h.name, color: h.color ?? COLORS[0] })
    setError(null)
    setEditingId(h.id)
  }

  function cancel(): void {
    setEditingId(null)
    setDraft(emptyDraft())
    setError(null)
  }

  async function save(): Promise<void> {
    const name = normalizeHashtag(draft.name)
    if (!name) {
      setError('Enter a tag name.')
      return
    }
    // Tag names are case-insensitively unique so the same tag isn't stored twice.
    const clash = hashtags.some(
      (h) => h.id !== editingId && h.name.toLowerCase() === name.toLowerCase()
    )
    if (clash) {
      setError(`#${name} already exists.`)
      return
    }
    const next =
      editingId && editingId !== 'new'
        ? hashtags.map((h) => (h.id === editingId ? { ...h, name, color: draft.color } : h))
        : [...hashtags, { id: crypto.randomUUID(), name, color: draft.color }]
    await persist(next)
    cancel()
  }

  async function remove(id: string): Promise<void> {
    await persist(hashtags.filter((h) => h.id !== id))
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

  function form(): JSX.Element {
    return (
      <div className="crud-form" onKeyDown={onKeyDown}>
        <HashtagFields draft={draft} setDraft={setDraft} onChange={() => setError(null)} />
        {error && <p className="crud-error">{error}</p>}
        <div className="editor-actions">
          <button className="btn primary" onClick={save} disabled={!draft.name.trim()}>
            {editingId === 'new' ? 'Add' : 'Save'} <span className="hint-key">⌘↵</span>
          </button>
          <button className="btn" onClick={cancel}>
            Cancel <span className="hint-key">esc</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Hashtags</h2>
        {editingId === null && (
          <button className="link-btn" onClick={startNew}>
            + New hashtag
          </button>
        )}
      </header>

      {editingId === 'new' && form()}

      {hashtags.length === 0 && editingId !== 'new' ? (
        <p className="empty">No hashtags yet. Add one to tag your time entries.</p>
      ) : (
        <ul className="list">
          {hashtags.map((h) =>
            editingId === h.id ? (
              <li key={h.id}>{form()}</li>
            ) : (
              <li key={h.id} className="row">
                <span className="row-text">
                  <span
                    className="tag-chip"
                    style={{
                      color: h.color ?? COLORS[0],
                      background: `${h.color ?? COLORS[0]}26`
                    }}
                  >
                    #{h.name}
                  </span>
                </span>
                <span className="row-buttons">
                  <button className="row-action" title="Edit" onClick={() => startEdit(h)}>
                    ✎
                  </button>
                  <button className="row-action" title="Delete" onClick={() => remove(h.id)}>
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

function HashtagFields({
  draft,
  setDraft,
  onChange
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  onChange: () => void
}): JSX.Element {
  return (
    <>
      <input
        className="editor-title"
        type="text"
        placeholder="#hashtag"
        value={draft.name}
        onChange={(e) => {
          setDraft((d) => ({ ...d, name: e.target.value }))
          onChange()
        }}
        autoFocus
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
