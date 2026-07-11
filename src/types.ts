export const EVENT_KINDS = [
  '書類提出',
  'カジュアル面談',
  '一次面接',
  '二次面接',
  '三次面接',
  '最終面接',
  'オファー回答',
  'その他',
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export interface JobEvent {
  id: string;
  company: string;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm, optional (empty string if not set)
  notes: string;
  done: boolean;
  createdAt: number;
}

export type FilterKey = 'all' | 'active' | 'done';

export type Urgency = 'overdue' | 'soon' | 'upcoming' | 'done';
