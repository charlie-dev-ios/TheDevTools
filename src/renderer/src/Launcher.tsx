import { useEffect, useMemo, useRef, useState } from 'react'
import SnippetEditor from './components/SnippetEditor'
import type { Snippet } from './types'

interface ResultItem {
  key: string
  kind: 'snippet' | 'history'
  title: string
  content: string
  snippet?: Snippet
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 100 ? `${oneLine.slice(0, 100)}…` : oneLine
}

export default function Launcher(): JSX.Element {
  const [history, setHistory] = useState<string[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [editing, setEditing] = useState<Snippet | 'new' | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getHistory().then(setHistory)
    window.api.getSnippets().then(setSnippets)
    return window.api.onHistoryUpdate(setHistory)
  }, [])

  // Each time the panel is shown: clear the query, reset selection, focus search.
  useEffect(() => {
    return window.api.onWindowShown(() => {
      setQuery('')
      setSelected(0)
      setEditing(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    })
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase()
    const matchedSnippets = snippets
      .filter(
        (s) =>
          !q || s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
      )
      .map<ResultItem>((s) => ({
        key: `s:${s.id}`,
        kind: 'snippet',
        title: s.title,
        content: s.content,
        snippet: s
      }))
    const matchedHistory = history
      .filter((h) => !q || h.toLowerCase().includes(q))
      .map<ResultItem>((h, i) => ({
        key: `h:${i}`,
        kind: 'history',
        title: h,
        content: h
      }))
    return [...matchedSnippets, ...matchedHistory]
  }, [query, snippets, history])

  // Keep the selection within bounds as results change.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)))
  }, [results.length])

  // Scroll the highlighted row into view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  async function paste(item?: ResultItem): Promise<void> {
    const target = item ?? results[selected]
    if (!target) return
    await window.api.paste(target.content)
  }

  async function saveSnippet(draft: {
    id?: string
    title: string
    content: string
  }): Promise<void> {
    const next = draft.id
      ? snippets.map((s) =>
          s.id === draft.id ? { ...s, title: draft.title, content: draft.content } : s
        )
      : [...snippets, { id: crypto.randomUUID(), title: draft.title, content: draft.content }]
    setSnippets(next)
    await window.api.saveSnippets(next)
    setEditing(null)
    inputRef.current?.focus()
  }

  async function deleteSnippet(id: string): Promise<void> {
    const next = snippets.filter((s) => s.id !== id)
    setSnippets(next)
    await window.api.saveSnippets(next)
  }

  async function removeHistoryItem(text: string): Promise<void> {
    const next = await window.api.removeHistory(text)
    setHistory(next)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (editing) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      paste()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      window.api.hide()
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      setEditing('new')
    }
  }

  if (editing) {
    return (
      <div className="app">
        <SnippetEditor
          initial={editing === 'new' ? null : editing}
          onSave={saveSnippet}
          onCancel={() => {
            setEditing(null)
            inputRef.current?.focus()
          }}
        />
      </div>
    )
  }

  return (
    <div className="app" onKeyDown={onKeyDown}>
      <input
        ref={inputRef}
        className="search"
        type="text"
        placeholder="Search clipboard history and snippets…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <div className="results" ref={listRef}>
        {results.length === 0 ? (
          <p className="empty">
            No matches. Press <span className="hint-key">⌘N</span> to create a snippet.
          </p>
        ) : (
          results.map((item, i) => {
            const showHeader = i === 0 || results[i - 1].kind !== item.kind
            return (
              <div key={item.key}>
                {showHeader && (
                  <div className="section-header">
                    {item.kind === 'snippet' ? 'Snippets' : 'Clipboard History'}
                  </div>
                )}
                <div
                  className={i === selected ? 'result active' : 'result'}
                  data-index={i}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => paste(item)}
                >
                  <span className="result-icon">
                    {item.kind === 'snippet' ? '✂️' : '📋'}
                  </span>
                  <span className="result-text">
                    {item.kind === 'snippet' ? (
                      <strong>{item.title}</strong>
                    ) : (
                      preview(item.content)
                    )}
                  </span>
                  <span className="result-actions">
                    {item.kind === 'snippet' ? (
                      <>
                        <button
                          className="row-action"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing(item.snippet!)
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className="row-action"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSnippet(item.snippet!.id)
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <button
                        className="row-action"
                        title="Remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeHistoryItem(item.content)
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      <footer className="footer">
        <span className="hint">
          <span className="hint-key">↑↓</span> Navigate
        </span>
        <span className="hint">
          <span className="hint-key">↵</span> Paste
        </span>
        <span className="hint">
          <span className="hint-key">⌘N</span> New snippet
        </span>
        <span className="hint">
          <span className="hint-key">esc</span> Close
        </span>
      </footer>
    </div>
  )
}
