import { useEffect, useMemo, useState } from 'react'
import HistoryTab from './components/HistoryTab'
import SnippetsTab from './components/SnippetsTab'
import type { Snippet } from './types'

type View = 'history' | 'snippets'

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'history', label: 'Clipboard History', icon: '📋' },
  { id: 'snippets', label: 'Snippets', icon: '✂️' }
]

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('history')
  const [history, setHistory] = useState<string[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    window.api.getHistory().then(setHistory)
    window.api.getSnippets().then(setSnippets)
    const unsubscribe = window.api.onHistoryUpdate(setHistory)
    return unsubscribe
  }, [])

  // Reset the search box when switching sections.
  useEffect(() => {
    setQuery('')
  }, [view])

  // Auto-dismiss the "Copied" toast.
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 1500)
    return () => clearTimeout(timer)
  }, [toast])

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return history
    return history.filter((item) => item.toLowerCase().includes(q))
  }, [history, query])

  const filteredSnippets = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return snippets
    return snippets.filter(
      (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    )
  }, [snippets, query])

  async function handleCopy(text: string): Promise<void> {
    await window.api.copy(text)
    setToast('Copied to clipboard')
  }

  async function handleClearHistory(): Promise<void> {
    const next = await window.api.clearHistory()
    setHistory(next)
  }

  async function handleRemoveHistory(text: string): Promise<void> {
    const next = await window.api.removeHistory(text)
    setHistory(next)
  }

  async function handleSaveSnippets(next: Snippet[]): Promise<void> {
    setSnippets(next)
    await window.api.saveSnippets(next)
  }

  const activeNav = NAV.find((n) => n.id === view)!

  return (
    <div className="app">
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

      <section className="main">
        <header className="main-header">
          <h1 className="main-title">{activeNav.label}</h1>
          <input
            className="search"
            type="text"
            placeholder={`Search ${activeNav.label.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>

        <div className="main-body">
          {view === 'history' ? (
            <HistoryTab
              items={filteredHistory}
              onCopy={handleCopy}
              onRemove={handleRemoveHistory}
              onClear={handleClearHistory}
            />
          ) : (
            <SnippetsTab
              snippets={filteredSnippets}
              allSnippets={snippets}
              onCopy={handleCopy}
              onSave={handleSaveSnippets}
            />
          )}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
