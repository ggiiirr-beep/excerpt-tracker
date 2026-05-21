import type { AppData } from '../types';
import { isAppData } from './appData';

const CACHE_PREFIX = 'excerpt-tracker-cache-v1';

const cacheKey = (userId: string) => `${CACHE_PREFIX}:${userId}`;

export function loadCachedData(userId: string): AppData | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isAppData(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedData(userId: string, data: AppData) {
  localStorage.setItem(cacheKey(userId), JSON.stringify(data));
}
