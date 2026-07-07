import type { TimeEntry } from '../types'

/** Fields collected by ManualEntryModal for a new or edited entry. */
export interface TimeEntryDraft {
  task: string
  subtask?: string
  start: Date
  end: Date
}

/** Build a new entry from a draft; seconds span the whole range. */
export function entryFromDraft(draft: TimeEntryDraft): TimeEntry {
  return {
    id: crypto.randomUUID(),
    task: draft.task,
    subtask: draft.subtask,
    start: draft.start.toISOString(),
    end: draft.end.toISOString(),
    seconds: Math.round((draft.end.getTime() - draft.start.getTime()) / 1000)
  }
}

/** Epoch ms of an ISO stamp truncated to the minute, the modal's precision. */
function minuteOf(iso: string): number {
  return new Date(iso).setSeconds(0, 0)
}

/**
 * Apply an edit draft to an existing entry. Timer-recorded entries carry
 * sub-minute stamps and a seconds count that excludes paused stretches, so
 * fields the user left untouched (at the modal's minute precision) keep their
 * original values; once a time is changed, seconds are recomputed from the
 * new range.
 */
export function applyEntryEdit(entry: TimeEntry, draft: TimeEntryDraft): TimeEntry {
  const startChanged = draft.start.getTime() !== minuteOf(entry.start)
  const endChanged = draft.end.getTime() !== minuteOf(entry.end)
  return {
    ...entry,
    task: draft.task,
    subtask: draft.subtask,
    start: startChanged ? draft.start.toISOString() : entry.start,
    end: endChanged ? draft.end.toISOString() : entry.end,
    seconds:
      startChanged || endChanged
        ? Math.round((draft.end.getTime() - draft.start.getTime()) / 1000)
        : entry.seconds
  }
}
