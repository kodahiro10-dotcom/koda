import type { JobEvent } from '../types';
import { EventCard } from './EventCard';

interface EventListProps {
  events: JobEvent[];
  onToggleDone: (id: string) => void;
  onEdit: (event: JobEvent) => void;
  onDelete: (id: string) => void;
}

export function EventList({ events, onToggleDone, onEdit, onDelete }: EventListProps) {
  if (events.length === 0) {
    return <p className="empty-state">該当する予定はありません。</p>;
  }

  return (
    <ul className="event-list">
      {events.map((event) => (
        <EventCard key={event.id} event={event} onToggleDone={onToggleDone} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </ul>
  );
}
