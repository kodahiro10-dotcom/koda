import type { JobEvent } from './types';

const STORAGE_KEY = 'job-search-tracker.events.v1';

export function loadEvents(): JobEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveEvents(events: JobEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
