import type { JobEvent, Urgency } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function eventDateTime(event: JobEvent): number {
  const timePart = event.time || '00:00';
  return new Date(`${event.date}T${timePart}`).getTime();
}

export function daysUntil(event: JobEvent, now: Date = new Date()): number {
  const target = startOfDay(new Date(event.date));
  return Math.round((target - startOfDay(now)) / DAY_MS);
}

export function urgencyOf(event: JobEvent, now: Date = new Date()): Urgency {
  if (event.done) return 'done';
  const diff = daysUntil(event, now);
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return 'upcoming';
}

export function urgencyLabel(urgency: Urgency, diff: number): string {
  switch (urgency) {
    case 'done':
      return '完了';
    case 'overdue':
      return `期限超過（${Math.abs(diff)}日前）`;
    case 'soon':
      return diff === 0 ? '本日' : diff === 1 ? '明日' : `あと${diff}日`;
    case 'upcoming':
      return `あと${diff}日`;
  }
}
