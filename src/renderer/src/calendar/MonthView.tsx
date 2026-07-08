import type { CalendarEvent } from '../types'
import {
  WEEKDAYS,
  formatTime,
  isSameDay,
  isSameMonth,
  monthMatrix
} from './date-utils'

interface Props {
  cursor: Date
  events: CalendarEvent[]
  /** Tracked time entries shown as "actual" chips. */
  tracked?: CalendarEvent[]
  onOpenDay: (day: Date) => void
  onSelect: (event: CalendarEvent) => void
  /** Called when a tracked "actual" chip is clicked (to edit its entry). */
  onSelectTracked?: (event: CalendarEvent) => void
}

const MAX_PER_CELL = 3

export default function MonthView({
  cursor,
  events,
  tracked = [],
  onOpenDay,
  onSelect,
  onSelectTracked
}: Props): JSX.Element {
  const days = monthMatrix(cursor)
  const today = new Date()

  function itemsOn(day: Date): { event: CalendarEvent; isTracked: boolean }[] {
    const onDay = (e: CalendarEvent): boolean => isSameDay(new Date(e.start), day)
    return [
      ...events.filter(onDay).map((event) => ({ event, isTracked: false })),
      ...tracked.filter(onDay).map((event) => ({ event, isTracked: true }))
    ].sort((a, b) => a.event.start.localeCompare(b.event.start))
  }

  return (
    <div className="monthview">
      <div className="month-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => {
          const items = itemsOn(day)
          const muted = !isSameMonth(day, cursor)
          return (
            <div
              key={day.toISOString()}
              className={`month-cell${muted ? ' muted' : ''}`}
              onClick={() => onOpenDay(day)}
              title="Open day view"
            >
              <span className={`day-number${isSameDay(day, today) ? ' today' : ''}`}>
                {day.getDate()}
              </span>
              <div className="cell-events">
                {items.slice(0, MAX_PER_CELL).map(({ event, isTracked }) => (
                  <button
                    key={event.id}
                    className={isTracked ? 'cell-event tracked' : 'cell-event'}
                    title={event.description ? `${event.title}\n${event.description}` : event.title}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Tracked chips edit their time entry; without a
                      // handler, fall back to opening the day view.
                      if (!isTracked) onSelect(event)
                      else if (onSelectTracked) onSelectTracked(event)
                      else onOpenDay(day)
                    }}
                  >
                    <span className="cell-event-time">
                      {formatTime(new Date(event.start))}
                    </span>
                    <span className="cell-event-title">
                      {event.repeat && event.repeat !== 'none' && '🔁 '}
                      {event.title}
                    </span>
                  </button>
                ))}
                {items.length > MAX_PER_CELL && (
                  <button
                    className="cell-more"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenDay(day)
                    }}
                  >
                    +{items.length - MAX_PER_CELL} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
