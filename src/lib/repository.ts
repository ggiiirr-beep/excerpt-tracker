import type { AppData } from '../types';
import { freshEmptyData, isStarterData } from './appData';
import { loadCachedData, saveCachedData } from './cache';
import { supabase } from './supabaseClient';

export type DataRepository = {
  load(userId: string): Promise<AppData>;
  save(userId: string, data: AppData): Promise<void>;
  importBackup(userId: string, data: AppData): Promise<void>;
};

type AppDataRow = {
  user_id: string;
  data: AppData;
  updated_at?: string;
};

export class SupabaseDataRepository implements DataRepository {
  async load(userId: string): Promise<AppData> {
    const cached = loadCachedData(userId);
    const { data, error } = await supabase!
      .from('user_app_data')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle<AppDataRow>();

    if (error) {
      if (cached) return cached;
      throw error;
    }

    if (data?.data) {
      if (isStarterData(data.data)) {
        const emptyData = freshEmptyData();
        await this.save(userId, emptyData);
        return emptyData;
      }
      saveCachedData(userId, data.data);
      return data.data;
    }

    const seeded = cached && !isStarterData(cached) ? cached : freshEmptyData();
    await this.save(userId, seeded);
    return seeded;
  }

  async save(userId: string, data: AppData): Promise<void> {
    saveCachedData(userId, data);
    const { error } = await supabase!
      .from('user_app_data')
      .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

    if (error) throw error;
  }

  async importBackup(userId: string, data: AppData): Promise<void> {
    await this.save(userId, data);
  }
}

export const repository: DataRepository = new SupabaseDataRepository();
