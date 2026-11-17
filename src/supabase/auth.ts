// ============================================================================
// KARTVERSE — Supabase Auth & Guest/User Profile Management (kart_users table)
// Supports real-time database updates and runtime name changes
// ============================================================================

import { supabase } from './client';

export interface UserProfile {
  id: string;
  username: string;
  avatar?: string;
  avatar_url: string;
  xp: number;
  level: number;
  selected_kart: string;
}

const GUEST_STORAGE_KEY = 'kartverse_guest_profile_v1';

export class AuthService {
  public static async getCurrentProfile(): Promise<UserProfile> {
    const local = this.getOrCreateGuest();

    try {
      // 1. Check if user already exists in Supabase kart_users table
      const { data, error } = await supabase
        .from('kart_users')
        .select('*')
        .eq('id', local.id)
        .single();

      if (!error && data) {
        const synced: UserProfile = {
          id: data.id,
          username: data.username,
          avatar: '🏎️',
          avatar_url: data.avatar_url || 'kart_racer_1',
          xp: data.xp ?? 150,
          level: data.level ?? 1,
          selected_kart: data.selected_kart || 'speed_demon'
        };
        this.saveGuest(synced);
        return synced;
      } else {
        // First time: insert into Supabase
        await supabase.from('kart_users').upsert({
          id: local.id,
          username: local.username,
          avatar_url: local.avatar_url,
          xp: local.xp,
          level: local.level,
          selected_kart: local.selected_kart,
          updated_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Could not connect to Supabase kart_users, using local cache:', e);
    }

    return local;
  }

  public static getOrCreateGuest(): UserProfile {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem(GUEST_STORAGE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // regenerate
        }
      }
    }

    const name = this.generateRandomName();

    const guest: UserProfile = {
      id: crypto.randomUUID(),
      username: name,
      avatar: '🏎️',
      avatar_url: 'kart_racer_1',
      xp: 150,
      level: 1,
      selected_kart: 'speed_demon'
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guest));
    }
    return guest;
  }

  public static generateRandomName(): string {
    const adjectives = ['Turbo', 'Nitro', 'Drift', 'Apex', 'Hyper', 'Sonic', 'Vortex', 'Blaze', 'Quantum', 'Shadow'];
    const nouns = ['Racer', 'Rider', 'Phantom', 'Ghost', 'Knight', 'Pilot', 'Challenger', 'Striker', 'Speedster'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}_${Math.floor(Math.random() * 900 + 100)}`;
  }

  public static saveGuest(profile: UserProfile): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(profile));
    }
  }

  // --------------------------------------------------------------------------
  // RUNTIME USERNAME & PROFILE UPDATE IN SUPABASE
  // --------------------------------------------------------------------------
  public static async updateUsername(newUsername: string, kartId?: string): Promise<{ success: boolean; profile: UserProfile; error?: string }> {
    const current = this.getOrCreateGuest();
    const cleanName = newUsername.trim() || 'Racer_One';

    const updated: UserProfile = {
      ...current,
      username: cleanName,
      selected_kart: kartId || current.selected_kart
    };

    this.saveGuest(updated);

    try {
      // 1. Sync with Supabase kart_users
      const { error: kartUsersError } = await supabase.from('kart_users').upsert({
        id: updated.id,
        username: updated.username,
        avatar_url: updated.avatar_url,
        xp: updated.xp,
        level: updated.level,
        selected_kart: updated.selected_kart,
        updated_at: new Date().toISOString()
      });

      if (kartUsersError) {
        console.warn('kart_users upsert warning:', kartUsersError);
      }

      // 2. Also sync with profiles table
      await supabase.from('profiles').upsert({
        id: updated.id,
        username: updated.username,
        avatar_url: updated.avatar_url,
        xp: updated.xp,
        level: updated.level,
        selected_kart: updated.selected_kart,
        updated_at: new Date().toISOString()
      });

      return { success: true, profile: updated };
    } catch (err: any) {
      console.error('Failed to update name in Supabase:', err);
      return { success: true, profile: updated, error: err.message };
    }
  }
}
