import { useEffect, useState } from 'react'
import { hmOfMinutes, minutesOfHM } from './date-utils'

const STEP = 5

interface Props {
  value: string // 'HH:mm'
  min?: number // minutes from midnight
  max?: number // minutes from midnight
  onChange: (value: string) => void
}

/** Parse loose time text: 'HH:mm', 'H:mm', 'HHmm', 'Hmm' or 'H'. */
function parse(text: string): number | null {
  const t = text.trim()
  let h: number
  let m: number
  const colon = t.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colon) {
    h = Number(colon[1])
    m = Number(colon[2])
  } else {
    const digits = t.replace(/\D/g, '')
    if (digits.length === 0) return null
    if (digits.length <= 2) {
      h = Number(digits)
      m = 0
    } else if (digits.length === 3) {
      h = Number(digits.slice(0, 1))
      m = Number(digits.slice(1))
    } else {
      h = Number(digits.slice(0, 2))
      m = Number(digits.slice(2, 4))
    }
  }
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null
  return h * 60 + m
}

export default function TimeStepper({
  value,
  min = 0,
  max = 24 * 60 - STEP,
  onChange
}: Props): JSX.Element {
  const [text, setText] = useState(value)

  // Reflect external changes (e.g. the start shifting the end).
  useEffect(() => setText(value), [value])

  function clampSnap(minutes: number): string {
    const snapped = Math.round(minutes / STEP) * STEP
    return hmOfMinutes(Math.max(min, Math.min(snapped, max)))
  }

  function step(delta: number): void {
    onChange(clampSnap(minutesOfHM(value) + delta))
  }

  function commit(): void {
    const parsed = parse(text)
    if (parsed == null) {
      setText(value) // revert invalid input
      return
    }
    onChange(clampSnap(parsed))
  }

  return (
    <div className="time-stepper">
      <button type="button" className="step-btn" onClick={() => step(-10)}>
        −10
      </button>
      <button type="button" className="step-btn" onClick={() => step(-5)}>
        −5
      </button>
      <input
        className="time-value"
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            step(STEP)
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            step(-STEP)
          }
        }}
      />
      <button type="button" className="step-btn" onClick={() => step(5)}>
        +5
      </button>
      <button type="button" className="step-btn" onClick={() => step(10)}>
        +10
      </button>
    </div>
  )
}
