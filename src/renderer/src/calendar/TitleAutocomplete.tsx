import { useMemo, useState } from 'react'
import type { Todo } from '../types'
import AutocompleteInput from '../components/AutocompleteInput'
import { taskSuggestions } from '../timetracking/suggestions'

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

  const suggestions = useMemo(() => taskSuggestions(todos, value), [todos, value])

  return (
    <AutocompleteInput
      value={value}
      onChange={onChange}
      suggestions={suggestions}
      placeholder={placeholder}
      autoFocus={autoFocus}
      // Refresh so todos added on the Todos tab show up.
      onFocusRefresh={() => window.api.getTodos().then(setTodos)}
    />
  )
}
