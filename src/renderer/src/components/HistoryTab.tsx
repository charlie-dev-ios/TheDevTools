interface Props {
  items: string[]
  onCopy: (text: string) => void
  onRemove: (text: string) => void
  onClear: () => void
}

function preview(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 120 ? `${oneLine.slice(0, 120)}…` : oneLine
}

export default function HistoryTab({ items, onCopy, onRemove, onClear }: Props): JSX.Element {
  if (items.length === 0) {
    return <p className="empty">No clipboard history yet. Copy something!</p>
  }

  return (
    <div className="list-wrap">
      <ul className="list">
        {items.map((item, index) => (
          <li key={`${index}-${item.slice(0, 24)}`} className="row" onClick={() => onCopy(item)}>
            <span className="row-text">{preview(item)}</span>
            <button
              className="row-action"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(item)
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <footer className="list-footer">
        <button className="link-btn" onClick={onClear}>
          Clear all
        </button>
      </footer>
    </div>
  )
}
