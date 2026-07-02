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
  onOpenDay: (day: Date) => void
  onSelect: (event: CalendarEvent) => void
}

const MAX_PER_CELL = 3

export default function MonthView({
  cursor,
  events,
  onOpenDay,
  onSelect
}: Props): JSX.Element {
  const days = monthMatrix(cursor)
  const today = new Date()

  function eventsOn(day: Date): CalendarEvent[] {
    return events
      .filter((e) => isSameDay(new Date(e.start), day))
      .sort((a, b) => a.start.localeCompare(b.start))
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
          const dayEvents = eventsOn(day)
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
                {dayEvents.slice(0, MAX_PER_CELL).map((event) => (
                  <button
                    key={event.id}
                    className="cell-event"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(event)
                    }}
                  >
                    <span className="cell-event-time">
                      {formatTime(new Date(event.start))}
                    </span>
                    <span className="cell-event-title">{event.title}</span>
                  </button>
                ))}
                {dayEvents.length > MAX_PER_CELL && (
                  <button
                    className="cell-more"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenDay(day)
                    }}
                  >
                    +{dayEvents.length - MAX_PER_CELL} more
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
