import { useMemo, useState } from 'react';
import { EventForm } from './components/EventForm';
import { EventList } from './components/EventList';
import type { FilterKey, JobEvent } from './types';
import { loadEvents, saveEvents } from './storage';
import { eventDateTime, urgencyOf } from './urgency';

function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [events, setEvents] = useState<JobEvent[]>(() => loadEvents());
  const [filter, setFilter] = useState<FilterKey>('active');
  const [editing, setEditing] = useState<JobEvent | null>(null);

  function persist(next: JobEvent[]) {
    setEvents(next);
    saveEvents(next);
  }

  function handleAddOrUpdate(input: Omit<JobEvent, 'id' | 'createdAt' | 'done'>) {
    if (editing) {
      persist(events.map((e) => (e.id === editing.id ? { ...e, ...input } : e)));
      setEditing(null);
    } else {
      const newEvent: JobEvent = { ...input, id: createId(), createdAt: Date.now(), done: false };
      persist([...events, newEvent]);
    }
  }

  function handleToggleDone(id: string) {
    persist(events.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));
  }

  function handleDelete(id: string) {
    if (editing?.id === id) setEditing(null);
    persist(events.filter((e) => e.id !== id));
  }

  const sorted = useMemo(() => [...events].sort((a, b) => eventDateTime(a) - eventDateTime(b)), [events]);

  const filtered = useMemo(() => {
    if (filter === 'active') return sorted.filter((e) => !e.done);
    if (filter === 'done') return sorted.filter((e) => e.done);
    return sorted;
  }, [sorted, filter]);

  const stats = useMemo(() => {
    const active = events.filter((e) => !e.done);
    const overdue = active.filter((e) => urgencyOf(e) === 'overdue').length;
    const soon = active.filter((e) => urgencyOf(e) === 'soon').length;
    return { total: events.length, active: active.length, overdue, soon };
  }, [events]);

  const reminders = useMemo(
    () => sorted.filter((e) => !e.done && (urgencyOf(e) === 'overdue' || urgencyOf(e) === 'soon')),
    [sorted],
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>転職活動スケジュール管理</h1>
        <p className="app-subtitle">面接・書類提出などの期限をひと目で管理</p>
      </header>

      <section className="stats-bar">
        <div className="stat">
          <span className="stat-value">{stats.active}</span>
          <span className="stat-label">未対応</span>
        </div>
        <div className="stat stat-overdue">
          <span className="stat-value">{stats.overdue}</span>
          <span className="stat-label">期限超過</span>
        </div>
        <div className="stat stat-soon">
          <span className="stat-value">{stats.soon}</span>
          <span className="stat-label">3日以内</span>
        </div>
        <div className="stat">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">全件</span>
        </div>
      </section>

      {reminders.length > 0 && (
        <section className="reminder-banner" role="alert">
          <strong>まもなく期限です：</strong>
          {reminders.map((r) => `${r.company}（${r.kind}・${r.date}）`).join(' / ')}
        </section>
      )}

      <section className="panel">
        <h2>{editing ? '予定を編集' : '新しい予定を追加'}</h2>
        <EventForm initial={editing} onSubmit={handleAddOrUpdate} onCancel={() => setEditing(null)} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>予定一覧</h2>
          <div className="filter-tabs">
            <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>
              未対応
            </button>
            <button className={filter === 'done' ? 'active' : ''} onClick={() => setFilter('done')}>
              完了
            </button>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              すべて
            </button>
          </div>
        </div>
        <EventList events={filtered} onToggleDone={handleToggleDone} onEdit={setEditing} onDelete={handleDelete} />
      </section>
    </div>
  );
}
