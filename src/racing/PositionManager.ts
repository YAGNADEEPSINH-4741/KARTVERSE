// ============================================================================
// KARTVERSE — Real-Time Race Position Ranking & Leaderboard System
// ============================================================================

import * as THREE from 'three';
import { LapManager, RacerProgress } from './LapManager';
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
}

export class PositionManager {
  public lapManager: LapManager;
  public checkpoints: CheckpointGate[];

  constructor(lapManager: LapManager, checkpoints: CheckpointGate[]) {
    this.lapManager = lapManager;
    this.checkpoints = checkpoints;
  }

  public calculateRanks(racerPositions: { id: string; position: THREE.Vector3 }[]): RacerRank[] {
    const list: RacerRank[] = [];

    for (const item of racerPositions) {
      const prog = this.lapManager.getProgress(item.id);
      if (!prog) continue;

      let score = 0;
      if (prog.isFinished) {
        // Finished racers get maximum score, sorted by lowest finish time
        score = 100000000 - prog.totalRaceTime * 1000;
      } else {
        const nextIdx = (prog.lastPassedCheckpoint + 1) % this.checkpoints.length;
        const gate = this.checkpoints[nextIdx];
        const distToGate = item.position.distanceTo(gate.center);

        // Score formula: (lap * 100,000) + (checkpoint * 1,000) + (1,000 - distToGate)
        score = (prog.lap * 100000) + (prog.lastPassedCheckpoint * 1000) + Math.max(0, 1000 - distToGate);
      }

      list.push({
        id: item.id,
        name: prog.name,
        rank: 1,
        score,
        lap: prog.lap,
        checkpoint: prog.lastPassedCheckpoint,
        isFinished: prog.isFinished,
        totalRaceTime: prog.totalRaceTime
      });
    }

    // Sort descending by score
    list.sort((a, b) => b.score - a.score);

    // Assign 1-based ranks
    list.forEach((racer, index) => {
      racer.rank = index + 1;
    });

    return list;
  }
}

