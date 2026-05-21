import type { AppData } from '../types';
import { exportData, freshSampleData, importData, isAppData } from './appData';

const STORAGE_KEY = 'excerpt-tracker-data-v1';

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshSampleData();
    const parsed = JSON.parse(raw);
    return isAppData(parsed) ? parsed : freshSampleData();
  } catch {
    return freshSampleData();
  }
}

export function saveAppData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export { exportData, freshSampleData, importData };
