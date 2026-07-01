import { useEffect, useMemo, useState } from 'react'
import HistoryTab from './components/HistoryTab'
import SnippetsTab from './components/SnippetsTab'
import type { Snippet } from './types'

type Tab = 'history' | 'snippets'

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('history')
  const [history, setHistory] = useState<string[]>([])
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    window.api.getHistory().then(setHistory)
    window.api.getSnippets().then(setSnippets)
    const unsubscribe = window.api.onHistoryUpdate(setHistory)
    return unsubscribe
  }, [])

  // Hide the popover on Escape, matching native menu-bar utilities.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.api.hideWindow()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    window.api.hideWindow()
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

  return (
    <div className="app">
      <header className="tabs">
        <button
          className={tab === 'history' ? 'tab active' : 'tab'}
          onClick={() => setTab('history')}
        >
          History
        </button>
        <button
          className={tab === 'snippets' ? 'tab active' : 'tab'}
          onClick={() => setTab('snippets')}
        >
          Snippets
        </button>
      </header>

      <input
        className="search"
        type="text"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      <main className="content">
        {tab === 'history' ? (
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
      </main>
    </div>
  )
}
