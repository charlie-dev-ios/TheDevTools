import { useState } from 'react'

export interface AutocompleteSuggestion {
  /** Stable key for React. */
  key: string
  /** Value written to the field when this suggestion is chosen. */
  value: string
  /** Primary text shown in the row. */
  label: string
  /** Optional secondary text shown right-aligned (e.g. a due date). */
  hint?: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  /** Suggestions to show; already filtered and ranked by the caller. */
  suggestions: AutocompleteSuggestion[]
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  /** Class applied to the <input> so each caller keeps its own styling. */
  inputClassName?: string
  /** Called on focus so the caller can refresh its suggestion source. */
  onFocusRefresh?: () => void
}

/**
 * Text input with a dropdown of suggestions. The caller owns the suggestion
 * data (todos, subtasks, past projects/hashtags, …) and this only renders the
 * list and manages showing/hiding it. Markup mirrors the original inline
 * autocompletes so the existing .autocomplete/.suggestions CSS applies.
 */
export default function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  autoFocus,
  disabled,
  inputClassName,
  onFocusRefresh
}: Props): JSX.Element {
  const [show, setShow] = useState(false)

  return (
    <div className="autocomplete">
      <input
        type="text"
        className={inputClassName}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value)
          setShow(true)
        }}
        onFocus={() => {
          onFocusRefresh?.()
          setShow(true)
        }}
        onBlur={() => setShow(false)}
      />
      {!disabled && show && suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                // Keep the input's blur from closing the list before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.value)
                  setShow(false)
                }}
              >
                <span className="suggestion-title">{s.label}</span>
                {s.hint !== undefined && <span className="suggestion-due">{s.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
