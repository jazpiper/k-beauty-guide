import { QueueItem } from "./QueueItem";

export function QueuePanel({ queue, selectedId, onSelect }) {
  return (
    <div className="queue-panel">
      <div className="queue-panel-head">
        <h2>Queue</h2>
        <span>{queue.length} items</span>
      </div>
      <div className="queue-list">
        {queue.map((item) => (
          <QueueItem
            key={item.id}
            item={item}
            isSelected={selectedId === item.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
