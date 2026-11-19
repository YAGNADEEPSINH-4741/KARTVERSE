// ============================================================================
// KARTVERSE — Supabase Leaderboard & Stats Service
// ============================================================================

import { supabase } from './client';

export interface LeaderboardEntry {
  id: string;
  username: string;
  track_id: string;
  completion_time: number;
  finish_time?: number;
  best_lap_time?: number;
  position: number;
  kart_id: string;
  race_date: string;
}

export interface RaceResultPayload {
  userId: string;
  username?: string;
  trackId: string;
  kartId?: string;
  mode?: string;
  finishTime: number;
  bestLapTime?: number;
  position: number;
  totalRacers?: number;
  laps?: number;
}

// The historic coast has different geometry. Its times belong to a separate record book.
const recordTrackId = (id: string) =>
  id === 'sunset_coast' ? 'sunset_island_v1' : id;

export class LeaderboardService {
  public static async getTrackLeaderboard(
    trackId: string,
    limit = 10,
  ): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('race_results')
      .select(
        'id,track_id,completion_time,position,race_date,profiles(username,selected_kart)',
      )
      .eq('track_id', recordTrackId(trackId))
      .gt('completion_time', 0)
      .order('completion_time', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((row: any) => ({
      ...row,
      username: row.profiles?.username || 'Guest driver',
      kart_id: row.profiles?.selected_kart,
      finish_time: row.completion_time,
    }));
  }

  public static getDeviceLeaderboard(
    trackId: string,
    limit = 10,
  ): LeaderboardEntry[] {
    try {
      const records: LeaderboardEntry[] = JSON.parse(
        localStorage.getItem('kartverse_records_' + recordTrackId(trackId)) ||
          '[]',
      );
      return Array.isArray(records) ? records.slice(0, limit) : [];
    } catch {
      return [];
    }
  }

  public static async recordRaceResult(
    arg1: string | RaceResultPayload,
    arg2?: string,
    arg3?: number,
    arg4?: number,
    arg5?: number,
  ): Promise<number> {
    let userId: string;
    let trackId: string;
    let position: number;
    let completionTime: number;
    let laps = 3;

    if (typeof arg1 === 'object') {
      userId = arg1.userId;
      trackId = arg1.trackId;
      position = arg1.position;
      completionTime = arg1.finishTime;
      laps = arg1.laps || 3;
    } else {
      userId = arg1;
      trackId = arg2!;
      position = arg3!;
      completionTime = arg4!;
      laps = arg5 || 3;
    }

    const xpEarned = Math.max(50, Math.round(500 / position));

    const record: LeaderboardEntry = {
      id:
        globalThis.crypto?.randomUUID?.() ||
        Date.now() + '-' + Math.random().toString(36).slice(2),
      username:
        typeof arg1 === 'object'
          ? arg1.username || 'Guest driver'
          : 'Guest driver',
      track_id: recordTrackId(trackId),
      completion_time: completionTime,
      position,
      best_lap_time: typeof arg1 === 'object' ? arg1.bestLapTime : undefined,
      kart_id:
        typeof arg1 === 'object' ? arg1.kartId || 'speed_demon' : 'speed_demon',
      race_date: new Date().toISOString(),
    };
    try {
      const records = [...this.getDeviceLeaderboard(trackId, 30), record];
      records.sort((a, b) => a.completion_time - b.completion_time);
      localStorage.setItem(
        'kartverse_records_' + record.track_id,
        JSON.stringify(records.slice(0, 30)),
      );
    } catch {
      // Storage is optional in private and embedded browsers.
    }

    const { error } = await supabase.from('race_results').insert({
      user_id: userId,
      track_id: record.track_id,
      position,
      completion_time: completionTime,
      laps,
      xp_earned: xpEarned,
    });
    if (error) console.warn('Cloud race result was not saved:', error.code);
    return xpEarned;
  }
}
