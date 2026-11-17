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
  private countdownTimer = 3.0;
  private raceStartTime = 0;
  public totalRaceTime = 0;
  public ranks: RacerRank[] = [];

  constructor(lapManager: LapManager, positionManager: PositionManager) {
    this.lapManager = lapManager;
    this.positionManager = positionManager;
  }

  public startCountdown(): void {
    this.state = 'COUNTDOWN';
    this.countdownTimer = 3.99;
    this.countdownValue = 3;
    audio.playCountdown(3);
  }

  public update(
    delta: number,
    racerPositions: { id: string; position: THREE.Vector3 }[],
    localPlayerId: string,
    forward: THREE.Vector3
  ): { canDrive: boolean; isCountdown: boolean; localRank: number; totalRacers: number } {
    // 1. Handle Countdown phase
    if (this.state === 'COUNTDOWN') {
      const prevInt = Math.floor(this.countdownTimer);
      this.countdownTimer -= delta;
      const nextInt = Math.floor(this.countdownTimer);

      if (nextInt !== prevInt) {
        if (nextInt === 2) {
          this.countdownValue = 2;
          audio.playCountdown(2);
        } else if (nextInt === 1) {
          this.countdownValue = 1;
          audio.playCountdown(1);
        } else if (nextInt === 0) {
          this.countdownValue = 0; // GO!
          audio.playCountdown(0);
          this.state = 'RACING';
          this.raceStartTime = performance.now() / 1000;
          this.lapManager.onRaceStart();
        }
      }

      useGameStore.getState().setTelemetry({
        countdownNumber: this.countdownValue
      });

      return {
        canDrive: false,
        isCountdown: true,
        localRank: 1,
        totalRacers: racerPositions.length
      };
    }

    // Clear countdown UI after "GO!" displays for 1.2 seconds into the race
    if (this.countdownValue !== null) {
      this.countdownTimer -= delta;
      if (this.countdownTimer < -1.2) {
        this.countdownValue = null;
        useGameStore.getState().setTelemetry({ countdownNumber: null });
      }
    }

    const currentTime = performance.now() / 1000;
    this.totalRaceTime = currentTime - this.raceStartTime;

    // 2. Update Lap Manager for all racers (Local Player, AI Opponents & Remote)
    let isWrongWay = false;

    for (const r of racerPositions) {
      const isLocal = r.id === localPlayerId;
      const rFwd = isLocal ? forward : new THREE.Vector3(0, 0, 1);
      const res = this.lapManager.updateRacer(r.id, r.position, rFwd, currentTime, isLocal);

      if (isLocal) {
        isWrongWay = res.isWrongWay;
        if (res.raceCompleted && this.state !== 'FINISHED') {
          this.finishRace(localPlayerId);
        }
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
      isPlayer: r.id === localPlayerId
    }));

    // Update telemetry in Zustand
    useGameStore.getState().setTelemetry({
      position: localRank,
      totalRacers: racerPositions.length,
      currentLap: Math.min(currentLap, 3),
      totalLaps: 3,
      raceTime: this.totalRaceTime,
      bestLapTime,
      isWrongWay,
      leaderboard
    });

    return {
      canDrive: this.state === 'RACING',
      isCountdown: false,
      localRank,
      totalRacers: racerPositions.length
    };
  }

  private finishRace(localPlayerId: string): void {
    this.state = 'FINISHED';
    useGameStore.getState().setRaceStatus('FINISHED');

    const localProg = this.lapManager.getProgress(localPlayerId);
    const finalRank = this.ranks.find(r => r.id === localPlayerId)?.rank || 1;
    const finalTime = localProg ? localProg.totalRaceTime : this.totalRaceTime;
    const bestLap = localProg ? localProg.bestLapTime : 0;

    // Record results to Supabase
    const { profile, selectedTrack, selectedKart, raceMode } = useGameStore.getState();

    LeaderboardService.recordRaceResult({
      userId: profile.id,
      username: profile.username,
      trackId: selectedTrack,
      kartId: selectedKart,
      mode: raceMode,
      finishTime: finalTime,
      bestLapTime: bestLap,
      position: finalRank,
      totalRacers: this.ranks.length
    }).catch(err => {
      console.warn('Failed to upload race result to Supabase:', err);
    });
  }
}

