// ============================================================================
// KARTVERSE — Master State Management (Zustand)
// ============================================================================

import { create } from 'zustand';
import { UserProfile, AuthService } from '../supabase/auth';

export type ScreenState =
  | 'MENU'
  | 'QUICK_RACE'
  | 'GRAND_PRIX'
  | 'TIME_TRIAL'
  | 'BATTLE_ARENA'
  | 'MULTIPLAYER_LOBBY'
  | 'GARAGE'
  | 'TRACK_SELECT'
  | 'LEADERBOARD'
  | 'SETTINGS';

export type GameRaceMode =
  | 'QUICK_RACE'
  | 'GRAND_PRIX'
  | 'TIME_TRIAL'
  | 'BATTLE_ARENA'
  | 'MULTIPLAYER';
export type RaceStatus =
  | 'IDLE'
  | 'COUNTDOWN'
  | 'RACING'
  | 'FINISHED'
  | 'PAUSED';
export type AIDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface LeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  lap: number;
  isPlayer: boolean;
  isHost?: boolean;
}

export interface RaceTelemetry {
  position: number;
  totalRacers: number;
  currentLap: number;
  totalLaps: number;
  speedKmh: number;
  nitroPercent: number;
  driftLevel: number; // 0=none, 1=blue, 2=orange, 3=purple
  currentItem: string | null;
  raceTime: number;
  bestLapTime: number;
  countdownNumber: number | null; // 3, 2, 1, 0 (GO)
  isWrongWay: boolean;
  racerPositions?: {
    x: number;
    z: number;
    isPlayer: boolean;
    id?: string;
    name?: string;
    kartColor?: string;
  }[];
  isReversing?: boolean;
  isNitroActive?: boolean;
  miniTurboNotification?: string | null;
  leaderboard?: LeaderboardEntry[];
}

export interface MultiplayerPlayer {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  kartId: string;
  kartColor: string;
  isReady: boolean;
  isHost: boolean;
}

export interface GameState {
  currentScreen: ScreenState;
  raceMode: GameRaceMode;
  raceStatus: RaceStatus;
  selectedKart: string;
  kartColor: string;
  selectedTrack: string;
  aiDifficulty: AIDifficulty;
  profile: UserProfile;

  // Race Telemetry
  telemetry: RaceTelemetry;

  // Multiplayer
  isMultiplayer: boolean;
  roomCode: string | null;
  isHost: boolean;
  roomPlayers: MultiplayerPlayer[];

  // Settings
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  graphicsQuality: GraphicsQuality;

  // Actions
  setScreen: (screen: ScreenState) => void;
  setRaceMode: (mode: GameRaceMode) => void;
  setRaceStatus: (status: RaceStatus) => void;
  setSelectedKart: (kartId: string) => void;
  setKartColor: (color: string) => void;
  setSelectedTrack: (trackId: string) => void;
  setAIDifficulty: (diff: AIDifficulty) => void;
  updateTelemetry: (partial: Partial<RaceTelemetry>) => void;
  setTelemetry: (partial: Partial<RaceTelemetry>) => void;
  setIsHost: (isHost: boolean) => void;
  setRoomCode: (code: string | null) => void;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setProfile: (profile: UserProfile) => void;
  addXP: (xp: number) => void;
  setMultiplayerRoom: (
    code: string | null,
    isHost: boolean,
    players?: MultiplayerPlayer[],
  ) => void;
  setRoomPlayers: (players: MultiplayerPlayer[]) => void;
  setSettings: (settings: {
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
    graphicsQuality?: GraphicsQuality;
  }) => void;
}

const preferencesKey = 'kartverse_preferences';

function readPreferences(): Partial<Preferences> {
  try {
    return (
      JSON.parse(localStorage.getItem(preferencesKey) || '{}')?.state || {}
    );
  } catch {
    return {};
  }
}

type Preferences = Pick<
  GameState,
  | 'selectedKart'
  | 'kartColor'
  | 'selectedTrack'
  | 'aiDifficulty'
  | 'graphicsQuality'
  | 'masterVolume'
  | 'musicVolume'
  | 'sfxVolume'
>;

function preferencesOf({
  selectedKart,
  kartColor,
  selectedTrack,
  aiDifficulty,
  graphicsQuality,
  masterVolume,
  musicVolume,
  sfxVolume,
}: GameState): Preferences {
  return {
    selectedKart,
    kartColor,
    selectedTrack,
    aiDifficulty,
    graphicsQuality,
    masterVolume,
    musicVolume,
    sfxVolume,
  };
}

export const useGameStore = create<GameState>((set) => ({
  currentScreen: 'MENU',
  raceMode: 'QUICK_RACE',
  raceStatus: 'IDLE',
  selectedKart: 'speed_demon',
  kartColor: '#00d2ff',
  selectedTrack: 'sunset_coast',
  aiDifficulty: 'MEDIUM',
  profile: AuthService.getOrCreateGuest(),

  telemetry: {
    position: 1,
    totalRacers: 8,
    currentLap: 1,
    totalLaps: 3,
    speedKmh: 0,
    nitroPercent: 100,
    driftLevel: 0,
    currentItem: null,
    raceTime: 0,
    bestLapTime: 0,
    countdownNumber: null,
    isWrongWay: false,
  },

  isMultiplayer: false,
  roomCode: null,
  isHost: false,
  roomPlayers: [],

  masterVolume: 0.8,
  musicVolume: 0.65,
  sfxVolume: 0.8,
  graphicsQuality: 'high',
  ...readPreferences(),

  setScreen: (screen) => set({ currentScreen: screen }),
  setRaceMode: (mode) => set({ raceMode: mode }),
  setRaceStatus: (status) => set({ raceStatus: status }),
  setSelectedKart: (kartId) => set({ selectedKart: kartId }),
  setKartColor: (color) => set({ kartColor: color }),
  setSelectedTrack: (trackId) => set({ selectedTrack: trackId }),
  setAIDifficulty: (diff) => set({ aiDifficulty: diff }),
  updateTelemetry: (partial) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...partial } })),
  setTelemetry: (partial) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...partial } })),
  setIsHost: (isHost) => set({ isHost }),
  setRoomCode: (code) => set({ roomCode: code, isMultiplayer: !!code }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setMusicVolume: (volume) => set({ musicVolume: volume }),
  setSfxVolume: (volume) => set({ sfxVolume: volume }),
  setGraphicsQuality: (quality) => set({ graphicsQuality: quality }),
  setProfile: (profile) => {
    AuthService.saveGuest(profile);
    set({ profile });
  },
  addXP: (xp) =>
    set((state) => {
      const newXP = state.profile.xp + xp;
      const newLevel = Math.floor(newXP / 1000) + 1;
      const updated = { ...state.profile, xp: newXP, level: newLevel };
      AuthService.saveGuest(updated);
      return { profile: updated };
    }),
  setMultiplayerRoom: (code, isHost, players = []) =>
    set({
      isMultiplayer: !!code,
      roomCode: code,
      isHost,
      roomPlayers: players,
    }),
  setRoomPlayers: (players) => set({ roomPlayers: players }),
  setSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));

if (typeof window !== 'undefined') {
  useGameStore.subscribe((state, previous) => {
    const next = preferencesOf(state);
    if (
      !Object.keys(next).some(
        (key: keyof Preferences) => next[key] !== previous[key],
      )
    )
      return;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify({ state: next }));
    } catch {
      // Preferences continue to work for the current session.
    }
  });

  (window as any).__gameStore = useGameStore;
  (window as any).__useGameStore = useGameStore;
}
