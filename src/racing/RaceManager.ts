// ============================================================================
// KARTVERSE — Master Race Coordinator & Countdown System
// ============================================================================

import * as THREE from 'three';
import { LapManager } from './LapManager';
import { PositionManager, RacerRank } from './PositionManager';
import { audio } from '../audio/AudioManager';
import { useGameStore } from '../store/gameStore';
import { LeaderboardService } from '../supabase/leaderboard';

export class RaceManager {
  public lapManager: LapManager;
  public positionManager: PositionManager;
  public state: 'COUNTDOWN' | 'RACING' | 'FINISHED' = 'COUNTDOWN';

  public countdownValue: number | null = 3;
  private countdownEndsAt = 0;
  private raceStartTime = 0;
  public totalRaceTime = 0;
  public ranks: RacerRank[] = [];

  constructor(lapManager: LapManager, positionManager: PositionManager) {
    this.lapManager = lapManager;
    this.positionManager = positionManager;
  }

  public startCountdown(): void {
    this.state = 'COUNTDOWN';
    this.countdownEndsAt = performance.now() / 1000 + 3;
    this.countdownValue = 3;
    useGameStore.getState().setTelemetry({ countdownNumber: 3 });
    audio.playCountdown(3);
    useGameStore.getState().setRaceStatus('COUNTDOWN');
  }

  public update(
    _delta: number,
    racerPositions: { id: string; position: THREE.Vector3; forward?: THREE.Vector3 }[],
    localPlayerId: string,
    forward: THREE.Vector3,
    synchronized: ReadonlySet<string> = new Set()
  ): { canDrive: boolean; isCountdown: boolean; localRank: number; totalRacers: number } {
    if (this.state === 'FINISHED') {
      const result = useGameStore.getState().telemetry;
      return {canDrive: false, isCountdown: false, localRank: result.position, totalRacers: result.totalRacers};
    }
    const currentTime = performance.now() / 1000;
    if (this.state === 'COUNTDOWN') {
      const remaining = Math.max(0, Math.ceil(this.countdownEndsAt - currentTime));
      if (remaining !== this.countdownValue) {
        this.countdownValue = remaining;
        audio.playCountdown(remaining);
        useGameStore.getState().setTelemetry({ countdownNumber: remaining });
      }

      if (remaining > 0) {
        return {
          canDrive: false,
          isCountdown: true,
          localRank: useGameStore.getState().telemetry.position,
          totalRacers: racerPositions.length
        };
      }
      this.state = 'RACING';
      this.raceStartTime = currentTime;
      this.lapManager.onRaceStart();
      useGameStore.getState().setRaceStatus('RACING');
    }

    if (this.countdownValue === 0 && currentTime - this.raceStartTime >= 1) {
      this.countdownValue = null;
      useGameStore.getState().setTelemetry({ countdownNumber: null });
    }

    this.totalRaceTime = currentTime - this.raceStartTime;

    // 2. Update Lap Manager for all racers (Local Player, AI Opponents & Remote)
    let isWrongWay = false, localFinished = false;

    for (const r of racerPositions) {
      if (synchronized.has(r.id)) continue;
      const isLocal = r.id === localPlayerId;
      const rFwd = r.forward || (isLocal ? forward : new THREE.Vector3(0, 0, 1));
      const res = this.lapManager.updateRacer(r.id, r.position, rFwd, currentTime, isLocal);

      if (isLocal) {
        isWrongWay = res.isWrongWay;
        localFinished = res.raceCompleted;
      }
    }

    // 3. Calculate ranks
    this.ranks = this.positionManager.calculateRanks(racerPositions);
    const localRankInfo = this.ranks.find(r => r.id === localPlayerId);
    const localRank = localRankInfo ? localRankInfo.rank : 1;

    const localProg = this.lapManager.getProgress(localPlayerId);
    const currentLap = localProg ? localProg.lap : 1;
    const bestLapTime = localProg ? localProg.bestLapTime : 0;

    // Build real-time leaderboard list for HUD standings
    const leaderboard = this.ranks.map(r => ({
      id: r.id,
      name: r.name,
      rank: r.rank,
      lap: r.lap,
      isFinished: r.isFinished,
      isPlayer: r.id === localPlayerId
    }));

    // Update telemetry in Zustand
    useGameStore.getState().setTelemetry({
      position: localRank,
      totalRacers: racerPositions.length,
      currentLap,
      totalLaps: this.lapManager.totalLaps,
      raceTime: this.totalRaceTime,
      bestLapTime,
      isWrongWay,
      leaderboard
    });

    if (localFinished) this.finishRace(localPlayerId);
    return {
      canDrive: this.state === 'RACING',
      isCountdown: false,
      localRank,
      totalRacers: racerPositions.length
    };
  }

  public finishRace(localPlayerId: string, forceRank?: number): void {
    if (this.state === 'FINISHED') return;
    this.state = 'FINISHED';

    const localProg = this.lapManager.getProgress(localPlayerId);
    const finalRank = forceRank !== undefined ? forceRank : (this.ranks.find(r => r.id === localPlayerId)?.rank || 1);
    const finalTime = localProg?.isFinished ? localProg.totalRaceTime : this.totalRaceTime;
    const bestLap = localProg ? localProg.bestLapTime : 0;
    const totalRacersCount = forceRank !== undefined ? 1 : this.ranks.length;

    // Immediately update store state and telemetry
    useGameStore.getState().setTelemetry({
      position: finalRank,
      totalRacers: totalRacersCount,
      raceTime: finalTime,
      bestLapTime: bestLap,
      speedKmh: 0,
      countdownNumber: null,
      ...(forceRank === undefined ? {} : { leaderboard: [{id: localPlayerId, name: localProg?.name || 'You', rank: 1, lap: localProg?.lap || 1, isPlayer: true}] })
    });

    useGameStore.getState().setRaceStatus('FINISHED');

    if (forceRank !== undefined || !localProg?.isFinished) return;
    // Record completed course results to Supabase
    const { profile, selectedTrack, selectedKart, raceMode } = useGameStore.getState();

    useGameStore.getState().addXP(Math.max(50, Math.round(500 / finalRank)));
    LeaderboardService.recordRaceResult({
      userId: profile.id,
      username: profile.username,
      trackId: selectedTrack,
      kartId: selectedKart,
      mode: raceMode,
      finishTime: finalTime,
      bestLapTime: bestLap,
      position: finalRank,
      totalRacers: totalRacersCount
    }).catch(err => {
      console.warn('Failed to upload race result to Supabase:', err);
    });
  }
}

