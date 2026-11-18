// ============================================================================
// KARTVERSE — Real-Time Race Position Ranking & Leaderboard System
// Continuous Spline Arc-Length Distance Projection: Dynamic Instant Overtakes,
// Real-Time Standings Reordering & Millimeter-Accurate Track Progression
// ============================================================================

import * as THREE from 'three';
import { LapManager } from './LapManager';
import { CheckpointGate } from '../tracks/TrackManager';

export interface RacerRank {
  id: string;
  name: string;
  rank: number;
  score: number;
  lap: number;
  checkpoint: number;
  isFinished: boolean;
  totalRaceTime: number;
  trackDistance: number;
}

export class PositionManager {
  public lapManager: LapManager;
  public checkpoints: CheckpointGate[];
  public curve?: THREE.CatmullRomCurve3;

  private splineSamples: { position: THREE.Vector3; distance: number; t: number }[] = [];
  public trackLength = 1000;

  constructor(lapManager: LapManager, checkpoints: CheckpointGate[], curve?: THREE.CatmullRomCurve3) {
    this.lapManager = lapManager;
    this.checkpoints = checkpoints;
    this.curve = curve;

    this.initSplineSamples();
  }

  public setCurve(curve: THREE.CatmullRomCurve3): void {
    this.curve = curve;
    this.initSplineSamples();
  }

  private initSplineSamples(): void {
    if (!this.curve) return;

    this.trackLength = this.curve.getLength();
    const count = 300; // 300 waypoint samples along the circuit for high-resolution projection
    this.splineSamples = [];

    let accum = 0;
    let prevPoint = this.curve.getPointAt(0);

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const pt = this.curve.getPointAt(t % 1.0);
      if (i > 0) {
        accum += pt.distanceTo(prevPoint);
      }
      this.splineSamples.push({ position: pt, distance: accum, t });
      prevPoint = pt;
    }
  }

  /**
   * Project a 3D world position onto the track curve to calculate continuous arc distance from start line
   */
  public getTrackDistance(position: THREE.Vector3): number {
    if (this.splineSamples.length === 0) {
      return 0;
    }

    let bestDistSq = Infinity;
    let bestIdx = 0;

    for (let i = 0; i < this.splineSamples.length; i++) {
      const dSq = position.distanceToSquared(this.splineSamples[i].position);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    // Sub-segment linear projection for continuous millimeter precision
    const currentSample = this.splineSamples[bestIdx];
    const nextIdx = (bestIdx + 1) % this.splineSamples.length;
    const nextSample = this.splineSamples[nextIdx];

    const segVec = nextSample.position.clone().sub(currentSample.position);
    const segLenSq = segVec.lengthSq();
    let subFraction = 0;
    if (segLenSq > 0.0001) {
      const toPos = position.clone().sub(currentSample.position);
      subFraction = Math.max(0, Math.min(1, toPos.dot(segVec) / segLenSq));
    }

    const segDist = nextSample.distance >= currentSample.distance 
      ? (nextSample.distance - currentSample.distance)
      : (this.trackLength - currentSample.distance);

    return currentSample.distance + subFraction * segDist;
  }

  public calculateRanks(racerPositions: { id: string; position: THREE.Vector3 }[]): RacerRank[] {
    const list: RacerRank[] = [];

    for (const item of racerPositions) {
      const prog = this.lapManager.getProgress(item.id);
      if (!prog) continue;

      const trackDist = this.getTrackDistance(item.position);
      let score = 0;

      if (prog.isFinished) {
        // Finished racers receive priority tier, ordered by lowest finish time
        score = 100_000_000 - prog.totalRaceTime * 1000;
      } else if (prog.state === 'WAITING_FOR_START' || prog.lastPassedCheckpoint === -1) {
        // On starting grid before finish line (s > 0.8 * trackLength)
        // Distance is negative relative to start line (e.g. -15m for Pole, -45m for Slot 7)
        if (trackDist > 0.5 * this.trackLength) {
          score = trackDist - this.trackLength;
        } else {
          score = trackDist;
        }
      } else {
        // Active race: score = (completed laps * trackLength) + current lap distance
        const completedLaps = Math.max(0, prog.lap - 1);
        score = completedLaps * this.trackLength + trackDist;
      }

      list.push({
        id: item.id,
        name: prog.name,
        rank: 1,
        score,
        lap: prog.lap,
        checkpoint: Math.max(0, prog.lastPassedCheckpoint),
        isFinished: prog.isFinished,
        totalRaceTime: prog.totalRaceTime,
        trackDistance: trackDist
      });
    }

    // Sort descending by score (highest race distance / fastest finish = Rank 1)
    list.sort((a, b) => b.score - a.score);

    // Assign 1-based ranks
    list.forEach((racer, index) => {
      racer.rank = index + 1;
    });

    return list;
  }
}
