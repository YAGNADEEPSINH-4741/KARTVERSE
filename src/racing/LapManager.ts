// ============================================================================
// KARTVERSE — Robust Checkpoint Sequence & Anti-Cheat Lap Manager
// State-Machine Driven: Strict In-Order Checkpoint Progression,
// Anti-Skip Validation, Direction Enforcement & Cooldown Debounce
// ============================================================================

import * as THREE from 'three';
import { CheckpointGate } from '../tracks/TrackManager';
import { audio } from '../audio/AudioManager';

export type RacerLapState = 
  | 'WAITING_FOR_START'
  | 'RACING'
  | 'LAP_COMPLETED'
  | 'RACE_FINISHED';

export interface RacerProgress {
  id: string;
  name: string;
  lap: number;                 // Current lap (1, 2, 3...)
  totalLaps: number;           // Total race laps (e.g. 3)
  state: RacerLapState;
  
  // Checkpoint validation
  lastPassedCheckpoint: number; // Last verified checkpoint index (-1 = on starting grid before gate 0)
  nextExpectedCheckpoint: number; // Next checkpoint in sequence (0 = start line)
  checkpointsPassedThisLap: Set<number>; // Tracks all checkpoints visited in current lap
  
  // Timing & stats
  lapStartTime: number;
  lapTimes: number[];
  bestLapTime: number;
  totalRaceTime: number;
  isFinished: boolean;
  isWrongWay: boolean;
  
  // Anti-glitch debounce
  lastFinishCrossTime: number;
  prevPosition: THREE.Vector3 | null;
}

export class LapManager {
  public checkpoints: CheckpointGate[];
  public totalLaps: number;
  public progressMap = new Map<string, RacerProgress>();

  constructor(checkpoints: CheckpointGate[], totalLaps = 3) {
    this.checkpoints = checkpoints;
    this.totalLaps = totalLaps;
  }

  public registerRacer(id: string, name: string): RacerProgress {
    const progress: RacerProgress = {
      id,
      name,
      lap: 1,
      totalLaps: this.totalLaps,
      state: 'WAITING_FOR_START',
      lastPassedCheckpoint: -1,
      nextExpectedCheckpoint: 0,
      checkpointsPassedThisLap: new Set<number>(),
      lapStartTime: performance.now() / 1000,
      lapTimes: [],
      bestLapTime: 0,
      totalRaceTime: 0,
      isFinished: false,
      isWrongWay: false,
      lastFinishCrossTime: 0,
      prevPosition: null
    };
    this.progressMap.set(id, progress);
    return progress;
  }

  public onRaceStart(): void {
    const now = performance.now() / 1000;
    this.progressMap.forEach(prog => {
      prog.state = 'RACING';
      prog.lapStartTime = now;
      prog.checkpointsPassedThisLap.clear();
      // Racers start on the grid before gate 0 (the start/finish gantry)
      prog.lastPassedCheckpoint = -1;
      prog.nextExpectedCheckpoint = 0;
      prog.lastFinishCrossTime = now;
    });
  }

  public updateRacer(
    id: string,
    position: THREE.Vector3,
    forward: THREE.Vector3,
    currentTime: number,
    isLocalPlayer = false
  ): { lapCompleted: boolean; raceCompleted: boolean; isWrongWay: boolean } {
    const prog = this.progressMap.get(id);
    if (!prog || prog.isFinished) {
      return { lapCompleted: false, raceCompleted: false, isWrongWay: false };
    }

    if (this.checkpoints.length === 0) {
      return { lapCompleted: false, raceCompleted: false, isWrongWay: false };
    }

    if (prog.state !== 'RACING') return { lapCompleted: false, raceCompleted: false, isWrongWay: false };
    const gate = this.checkpoints[prog.nextExpectedCheckpoint];
    const direction = forward.dot(gate.tangent);
    // Heading guidance uses the nearer gate, so an approaching hairpin can reverse compass direction.
    if (isLocalPlayer) {
      let closest = gate;
      for (const candidate of this.checkpoints) {
        if (position.distanceToSquared(candidate.center) < position.distanceToSquared(closest.center)) closest = candidate;
      }
      prog.isWrongWay = forward.dot(closest.tangent) < -.5;
    }

    let lapCompleted = false, raceCompleted = false;
    const prev = prog.prevPosition;
    if (prev) {
      const prevAlong = prev.clone().sub(gate.center).dot(gate.tangent);
      const along = position.clone().sub(gate.center).dot(gate.tangent);
      if (prevAlong < 0 && along >= 0 && direction > 0) {
        const crossing = prev.clone().lerp(position, -prevAlong / (along - prevAlong)).sub(gate.center);
        if (Math.abs(crossing.dot(gate.normal)) <= gate.width / 2 && Math.abs(crossing.y) <= 3) {
          const firstCrossing = prog.lastPassedCheckpoint === -1;
          prog.lastPassedCheckpoint = gate.index;
          prog.nextExpectedCheckpoint = (gate.index + 1) % this.checkpoints.length;
          if (gate.index !== 0) {
            prog.checkpointsPassedThisLap.add(gate.index);
          } else {
            if (!firstCrossing) {
              const duration = currentTime - prog.lapStartTime;
              prog.lapTimes.push(duration);
              prog.bestLapTime = Math.min(prog.bestLapTime || Infinity, duration);
              prog.totalRaceTime += duration;
              prog.lapStartTime = currentTime;
              lapCompleted = true;
              if (isLocalPlayer) audio.playCheckpoint();
              if (prog.lap >= this.totalLaps) {
                prog.isFinished = raceCompleted = true;
                prog.state = 'RACE_FINISHED';
              } else prog.lap++;
            }
            prog.lastFinishCrossTime = currentTime;
            prog.checkpointsPassedThisLap.clear();
          }
        }
      }
      prev.copy(position);
    } else prog.prevPosition = position.clone();
    return { lapCompleted, raceCompleted, isWrongWay: prog.isWrongWay };
  }

  public getRacerLap(id: string): number {
    return this.progressMap.get(id)?.lap || 1;
  }

  public getRacerProgress(id: string): RacerProgress | undefined {
    return this.progressMap.get(id);
  }

  public getProgress(id: string): RacerProgress | undefined {
    return this.progressMap.get(id);
  }

  public hasRacer(id: string): boolean {
    return this.progressMap.has(id);
  }

  public removeRacer(id: string): void {
    this.progressMap.delete(id);
  }
}
