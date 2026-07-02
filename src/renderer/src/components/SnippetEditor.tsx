import { useState } from 'react'
import type { Snippet } from '../types'

interface Props {
  initial: Snippet | null
  onSave: (draft: { id?: string; title: string; content: string }) => void
  onCancel: () => void
}

export default function SnippetEditor({ initial, onSave, onCancel }: Props): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')

  function save(): void {
    if (!content.trim()) {
      onCancel()
      return
    }
    onSave({ id: initial?.id, title: title.trim() || 'Untitled', content })
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    // Escape cancels; Cmd/Ctrl+Enter saves.
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      save()
    }
  }

  return (
    <div className="editor" onKeyDown={onKeyDown}>
      <div className="editor-heading">{initial ? 'Edit snippet' : 'New snippet'}</div>
      <input
        className="editor-title"
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="editor-content"
        placeholder="Snippet content…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="editor-actions">
        <button className="btn primary" onClick={save}>
          Save <span className="hint-key">⌘↵</span>
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel <span className="hint-key">esc</span>
        </button>
      </div>
    </div>
  )
}
