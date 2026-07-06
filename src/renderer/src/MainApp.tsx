import { useEffect, useState } from 'react'
import CalendarView from './calendar/CalendarView'
import SnippetEditor from './components/SnippetEditor'
import TimeTrackingView from './timetracking/TimeTrackingView'
import TodoView from './todo/TodoView'
import type { Snippet } from './types'

type View = 'calendar' | 'todos' | 'tracking' | 'history' | 'snippets'

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'todos', label: 'Todos', icon: '✅' },
  { id: 'tracking', label: 'Time Tracking', icon: '⏱️' },
  { id: 'history', label: 'Clipboard History', icon: '📋' },
  { id: 'snippets', label: 'Snippets', icon: '✂️' }
]

export default function MainApp(): JSX.Element {
  const [view, setView] = useState<View>('calendar')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 1500)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="mainapp">
      <nav className="sidebar">
        <div className="brand">TheDevTools</div>
        <ul className="nav">
          {NAV.map((item) => (
            <li key={item.id}>
              <button
                className={item.id === view ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="content">
        {view === 'calendar' && <CalendarView />}
        {view === 'todos' && <TodoView />}
        {view === 'history' && <HistoryPanel onToast={setToast} />}
        {view === 'snippets' && <SnippetsPanel onToast={setToast} />}
        {/* Kept mounted so a running timer survives tab switches. */}
        <div className="tracking-host" style={{ display: view === 'tracking' ? undefined : 'none' }}>
          <TimeTrackingView />
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

/* ---------------- Clipboard history panel ---------------- */

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 140 ? `${oneLine.slice(0, 140)}…` : oneLine
}

function HistoryPanel({ onToast }: { onToast: (m: string) => void }): JSX.Element {
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    window.api.getHistory().then(setHistory)
    return window.api.onHistoryUpdate(setHistory)
  }, [])

  // In the main window, clicking just copies to the clipboard.
  async function copy(text: string): Promise<void> {
    await window.api.copy(text)
    onToast('Copied to clipboard')
  }

  async function remove(text: string): Promise<void> {
    setHistory(await window.api.removeHistory(text))
  }

  async function clear(): Promise<void> {
    setHistory(await window.api.clearHistory())
  }

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Clipboard History</h2>
        {history.length > 0 && (
          <button className="link-btn" onClick={clear}>
            Clear all
          </button>
        )}
      </header>
      {history.length === 0 ? (
        <p className="empty">No clipboard history yet. Copy something!</p>
      ) : (
        <ul className="list">
          {history.map((item, i) => (
            <li
              key={`${i}-${item.slice(0, 16)}`}
              className="row"
              title="Click to copy"
              onClick={() => copy(item)}
            >
              <span className="row-text">{preview(item)}</span>
              <button
                className="row-action"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation()
                  remove(item)
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- Snippets panel ---------------- */

function SnippetsPanel({ onToast }: { onToast: (m: string) => void }): JSX.Element {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [editing, setEditing] = useState<Snippet | 'new' | null>(null)

  useEffect(() => {
    window.api.getSnippets().then(setSnippets)
  }, [])

  async function save(draft: { id?: string; title: string; content: string }): Promise<void> {
    const next = draft.id
      ? snippets.map((s) =>
          s.id === draft.id ? { ...s, title: draft.title, content: draft.content } : s
        )
      : [...snippets, { id: crypto.randomUUID(), title: draft.title, content: draft.content }]
    setSnippets(next)
    await window.api.saveSnippets(next)
    setEditing(null)
  }

  async function remove(id: string): Promise<void> {
    const next = snippets.filter((s) => s.id !== id)
    setSnippets(next)
    await window.api.saveSnippets(next)
  }

  async function copy(text: string): Promise<void> {
    await window.api.copy(text)
    onToast('Copied to clipboard')
  }

  if (editing) {
    return (
      <div className="panel">
        <SnippetEditor
          initial={editing === 'new' ? null : editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  return (
    <div className="panel">
      <header className="panel-header">
        <h2 className="panel-title">Snippets</h2>
        <button className="link-btn" onClick={() => setEditing('new')}>
          + New snippet
        </button>
      </header>
      {snippets.length === 0 ? (
        <p className="empty">No snippets yet.</p>
      ) : (
        <ul className="list">
          {snippets.map((s) => (
            <li
              key={s.id}
              className="row"
              title="Click to copy"
              onClick={() => copy(s.content)}
            >
              <span className="row-text">
                <strong>{s.title}</strong>
              </span>
              <span className="row-buttons">
                <button
                  className="row-action"
                  title="Edit"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditing(s)
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
    </div>
  )
}
