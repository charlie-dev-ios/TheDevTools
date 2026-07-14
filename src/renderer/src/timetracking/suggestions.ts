import type { Todo, TimeEntry, Project, Hashtag } from '../types'
import type { AutocompleteSuggestion } from '../components/AutocompleteInput'
import { normalizeHashtag } from './entry-utils'

const MAX_SUGGESTIONS = 8

/** Distinct, most-recent-first values matching the query, blanks dropped. */
function distinctValues(values: Array<string | undefined>, query: string): string[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const value = raw?.trim()
    if (!value) continue
    const lower = value.toLowerCase()
    if (seen.has(lower) || (q && !lower.includes(q))) continue
    seen.add(lower)
    out.push(value)
    if (out.length >= MAX_SUGGESTIONS) break
  }
  return out
}

/** Incomplete todos (overdue included) whose title matches the typed text. */
export function taskSuggestions(todos: Todo[], query: string): AutocompleteSuggestion[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  return todos
    .filter((t) => !t.completed)
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title))
    .filter((t) => {
      if (!t.title.toLowerCase().includes(q) || seen.has(t.title)) return false
      seen.add(t.title)
      return true
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((t) => ({ key: t.id, value: t.title, label: t.title, hint: t.due }))
}

/** Incomplete subtasks of the todo matching taskName, filtered by the typed text. */
export function subtaskSuggestions(
  todos: Todo[],
  taskName: string,
  query: string
): AutocompleteSuggestion[] {
  const name = taskName.trim().toLowerCase()
  const q = query.trim().toLowerCase()
  if (!name) return []
  const seen = new Set<string>()
  return todos
    .filter((t) => !t.completed && t.title.trim().toLowerCase() === name)
    .flatMap((t) => t.subtasks ?? [])
    .filter((s) => {
      if (s.completed || !s.title.toLowerCase().includes(q) || seen.has(s.title)) return false
      seen.add(s.title)
      return true
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({ key: s.id, value: s.title, label: s.title }))
}

/**
 * Distinct project names matching the typed text. The dedicated Projects
 * catalog is offered first (so a project shows up before it's ever tracked),
 * followed by names seen on past entries.
 */
export function projectSuggestions(
  entries: TimeEntry[],
  projects: Project[],
  query: string
): AutocompleteSuggestion[] {
  return distinctValues(
    [...projects.map((p) => p.name), ...entries.map((e) => e.project)],
    query
  ).map((p) => ({ key: p, value: p, label: p }))
}

/**
 * Distinct hashtags matching the typed text (leading '#' optional). The
 * dedicated Hashtags catalog is offered first (so a tag shows up before it's
 * ever tracked), followed by tags seen on past entries.
 */
export function hashtagSuggestions(
  entries: TimeEntry[],
  hashtags: Hashtag[],
  query: string
): AutocompleteSuggestion[] {
  return distinctValues(
    [...hashtags.map((h) => h.name), ...entries.map((e) => e.hashtag)],
    normalizeHashtag(query) ?? ''
  ).map((h) => ({ key: h, value: h, label: `#${h}` }))
}
