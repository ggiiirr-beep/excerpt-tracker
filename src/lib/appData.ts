import type { AppData } from '../types';
import { sampleData } from './sampleData';

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const data = value as AppData;
  return Array.isArray(data.excerpts) && Array.isArray(data.lists);
}

export function freshSampleData(): AppData {
  return JSON.parse(JSON.stringify(sampleData));
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
