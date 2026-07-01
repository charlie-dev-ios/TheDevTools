import { useState } from 'react'
import type { Snippet } from '../types'

interface Props {
  snippets: Snippet[]
  allSnippets: Snippet[]
  onCopy: (text: string) => void
  onSave: (next: Snippet[]) => void
}

interface Draft {
  id: string | null
  title: string
  content: string
}

const emptyDraft: Draft = { id: null, title: '', content: '' }

export default function SnippetsTab({
  snippets,
  allSnippets,
  onCopy,
  onSave
}: Props): JSX.Element {
  const [draft, setDraft] = useState<Draft | null>(null)

  function startAdd(): void {
    setDraft({ ...emptyDraft })
  }

  function startEdit(snippet: Snippet): void {
    setDraft({ id: snippet.id, title: snippet.title, content: snippet.content })
  }

  function commit(): void {
    if (!draft) return
    const title = draft.title.trim() || 'Untitled'
    const content = draft.content
    if (!content.trim()) {
      setDraft(null)
      return
    }
    if (draft.id) {
      onSave(
        allSnippets.map((s) => (s.id === draft.id ? { ...s, title, content } : s))
      )
    } else {
      onSave([...allSnippets, { id: crypto.randomUUID(), title, content }])
    }
    setDraft(null)
  }

  function remove(id: string): void {
    onSave(allSnippets.filter((s) => s.id !== id))
  }

  if (draft) {
    return (
      <div className="editor">
        <input
          className="editor-title"
          type="text"
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          autoFocus
        />
        <textarea
          className="editor-content"
          placeholder="Snippet content…"
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value })}
        />
        <div className="editor-actions">
          <button className="btn primary" onClick={commit}>
            Save
          </button>
          <button className="btn" onClick={() => setDraft(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="list-wrap">
      {snippets.length === 0 ? (
        <p className="empty">No snippets yet.</p>
      ) : (
        <ul className="list">
          {snippets.map((s) => (
            <li key={s.id} className="row" onClick={() => onCopy(s.content)}>
              <span className="row-text">
                <strong>{s.title}</strong>
              </span>
              <span className="row-buttons">
                <button
                  className="row-action"
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEdit(s)
                  }}
                >
                  ✎
                </button>
                <button
                  className="row-action"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(s.id)
                  }}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <footer className="list-footer">
        <button className="link-btn" onClick={startAdd}>
          + New snippet
        </button>
      </footer>
    </div>
  )
}
