import { useMemo, useState } from 'react'
import type { Todo } from '../types'

const MAX_SUGGESTIONS = 8

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Title input for calendar events with a todo-backed autocomplete, mirroring
 * the Time Tracking task field so you can schedule a todo straight onto the
 * calendar. Suggests incomplete todos (overdue included) matching the text.
 */
export default function TitleAutocomplete({
  value,
  onChange,
  placeholder,
  autoFocus
}: Props): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [show, setShow] = useState(false)

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase()
    const seen = new Set<string>()
    return todos
      .filter((t) => !t.completed)
      .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))
      .filter((t) => {
        if (!t.title.toLowerCase().includes(query) || seen.has(t.title)) return false
        seen.add(t.title)
        return true
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [todos, value])

  return (
    <div className="autocomplete">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value)
          setShow(true)
        }}
        onFocus={() => {
          // Refresh so todos added on the Todos tab show up.
          window.api.getTodos().then(setTodos)
          setShow(true)
        }}
        onBlur={() => setShow(false)}
      />
      {show && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                // Keep the input's blur from closing the list before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(t.title)
                  setShow(false)
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
  )
}
