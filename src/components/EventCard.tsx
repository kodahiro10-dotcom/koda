import type { JobEvent } from '../types';
import { daysUntil, urgencyLabel, urgencyOf } from '../urgency';

interface EventCardProps {
  event: JobEvent;
  onToggleDone: (id: string) => void;
  onEdit: (event: JobEvent) => void;
  onDelete: (id: string) => void;
}

export function EventCard({ event, onToggleDone, onEdit, onDelete }: EventCardProps) {
  const urgency = urgencyOf(event);
  const diff = daysUntil(event);

  return (
    <li className={`event-card urgency-${urgency}`}>
      <div className="event-card-main">
        <input
          type="checkbox"
          checked={event.done}
          onChange={() => onToggleDone(event.id)}
          aria-label="完了にする"
        />
        <div className="event-card-body">
          <div className="event-card-top">
            <span className="event-company">{event.company}</span>
            <span className="event-kind">{event.kind}</span>
          </div>
          <div className="event-card-meta">
            <span className="event-date">
              {event.date}
              {event.time ? ` ${event.time}` : ''}
            </span>
            <span className={`event-badge badge-${urgency}`}>{urgencyLabel(urgency, diff)}</span>
          </div>
          {event.notes && <p className="event-notes">{event.notes}</p>}
        </div>
      </div>
      <div className="event-card-actions">
        <button type="button" onClick={() => onEdit(event)} aria-label="編集">
          編集
        </button>
        <button type="button" onClick={() => onDelete(event.id)} aria-label="削除" className="btn-danger">
          削除
        </button>
      </div>
    </li>
  );
}
