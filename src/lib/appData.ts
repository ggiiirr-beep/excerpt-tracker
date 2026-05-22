import type { AppData } from '../types';
import { sampleData } from './sampleData';

const starterExcerptIds = new Set(sampleData.excerpts.map((excerpt) => excerpt.id));
const starterListIds = new Set(sampleData.lists.map((list) => list.id));

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as AppData;
  return Array.isArray(data.excerpts) && Array.isArray(data.lists);
}

export function freshEmptyData(): AppData {
  return { excerpts: [], lists: [] };
}

export function freshSampleData(): AppData {
  return freshEmptyData();
}

export function isStarterData(data: AppData) {
  if (data.excerpts.length !== sampleData.excerpts.length || data.lists.length !== sampleData.lists.length) {
    return false;
  }

  return data.excerpts.every((excerpt) => starterExcerptIds.has(excerpt.id))
    && data.lists.every((list) => starterListIds.has(list.id));
}

export function exportData(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `excerpt-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importData(file: File): Promise<AppData> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!isAppData(parsed)) {
    throw new Error('Import file must contain excerpts and lists arrays.');
  }
  return parsed;
}
