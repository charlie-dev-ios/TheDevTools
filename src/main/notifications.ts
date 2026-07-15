import { Notification } from 'electron'
import { getEvents } from './store.js'

// How often the scheduler wakes to look for due reminders.
const CHECK_INTERVAL_MS = 30_000
// After a long gap (e.g. the machine slept), only fire reminders whose moment
// passed within this window so reopening the lid doesn't replay a whole day.
const MAX_CATCHUP_MS = 15 * 60_000

/** The reminders fired for each event: 10 and 5 minutes before start and end. */
const REMINDERS: { anchor: 'start' | 'end'; minutes: number }[] = [
  { anchor: 'start', minutes: 10 },
  { anchor: 'start', minutes: 5 },
  { anchor: 'end', minutes: 10 },
  { anchor: 'end', minutes: 5 }
]

function reminderBody(anchor: 'start' | 'end', minutes: number): string {
  const verb = anchor === 'start' ? 'Starts' : 'Ends'
  return `${verb} in ${minutes} minutes`
}

// Last time check() ran; reminders whose trigger falls in (lastCheck, now] fire.
// Seeded at start so reminders already past when the app launches don't replay.
let lastCheck = 0

function check(): void {
  if (!Notification.isSupported()) return
  const now = Date.now()
  // Ignore anything older than the catch-up window after a suspend/resume gap.
  const since = Math.max(lastCheck, now - MAX_CATCHUP_MS)

  for (const event of getEvents()) {
    if (event.notify === false) continue
    for (const { anchor, minutes } of REMINDERS) {
      const anchorMs = new Date(event[anchor]).getTime()
      if (Number.isNaN(anchorMs)) continue
      const triggerMs = anchorMs - minutes * 60_000
      // Cross the trigger exactly once: fire when it lands in this interval.
      if (triggerMs <= since || triggerMs > now) continue
      new Notification({
        title: event.title || 'Event',
        body: reminderBody(anchor, minutes)
      }).show()
    }
  }

  lastCheck = now
}

/**
 * Begin polling stored events and firing desktop reminders 10 and 5 minutes
 * before each event's start and end. Reads events fresh on every tick, so edits
 * and newly-added events are picked up without any extra wiring.
 */
export function startEventNotifier(): void {
  lastCheck = Date.now()
  setInterval(check, CHECK_INTERVAL_MS)
}
