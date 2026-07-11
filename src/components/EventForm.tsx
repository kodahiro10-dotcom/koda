import { useEffect, useState } from 'react';
import { EVENT_KINDS, type EventKind, type JobEvent } from '../types';

interface EventFormProps {
  initial?: JobEvent | null;
  onSubmit: (event: Omit<JobEvent, 'id' | 'createdAt' | 'done'>) => void;
  onCancel?: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EventForm({ initial, onSubmit, onCancel }: EventFormProps) {
  const [company, setCompany] = useState(initial?.company ?? '');
  const [kind, setKind] = useState<EventKind>(initial?.kind ?? '書類提出');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [time, setTime] = useState(initial?.time ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  useEffect(() => {
    setCompany(initial?.company ?? '');
    setKind(initial?.kind ?? '書類提出');
    setDate(initial?.date ?? todayISO());
    setTime(initial?.time ?? '');
    setNotes(initial?.notes ?? '');
  }, [initial]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !date) return;
    onSubmit({ company: company.trim(), kind, date, time, notes: notes.trim() });
    if (!initial) {
      setCompany('');
      setKind('書類提出');
      setDate(todayISO());
      setTime('');
      setNotes('');
    }
  }

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="company">企業名</label>
        <input
          id="company"
          type="text"
          placeholder="例）株式会社サンプル"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />
      </div>

      <div className="form-row form-row-split">
        <div>
          <label htmlFor="kind">種別</label>
          <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date">期限・日付</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="time">時刻（任意）</label>
          <input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="form-row">
        <label htmlFor="notes">メモ（任意）</label>
        <textarea
          id="notes"
          placeholder="持ち物、面接形式、担当者名など"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {initial ? '更新する' : '追加する'}
        </button>
        {initial && onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}
