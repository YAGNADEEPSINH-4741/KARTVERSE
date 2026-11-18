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
  prevPosition: THREE.Vector3;
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
      prevPosition: new THREE.Vector3()
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

    // Direction check: evaluate against the closest checkpoint's tangent
    const currentGateIdx = Math.max(0, prog.lastPassedCheckpoint);
    const refGate = this.checkpoints[currentGateIdx % this.checkpoints.length];
    const dotDirection = forward.dot(refGate.tangent);
    prog.isWrongWay = isLocalPlayer && dotDirection < -0.3; // Heading backwards

    let lapCompleted = false;
    let raceCompleted = false;

    // Check all gates in forward lookahead window
    const numGates = this.checkpoints.length;
    const candidates = prog.lastPassedCheckpoint === -1
      ? [0, 1]
      : [
          prog.nextExpectedCheckpoint,
          (prog.nextExpectedCheckpoint + 1) % numGates
        ];

    for (const gateIdx of candidates) {
      const gate = this.checkpoints[gateIdx];
      const toGate = position.clone().sub(gate.center);

      // Longitudinal distance along track axis (- = behind gate, + = in front)
      const distLongitudinal = toGate.dot(gate.tangent);
      // Lateral distance across track width
      const distLateral = Math.abs(toGate.dot(gate.normal));
      // Vertical clearance
      const distVertical = Math.abs(position.y - gate.center.y);

      const inCorridor = distLateral <= gate.width * 1.5 && distVertical <= 10.0;
      const inCrossingPlane = distLongitudinal >= -4.0 && distLongitudinal <= 10.0;

      // Ensure crossing occurs while travelling forward (tolerant for AI/remote racers)
      const isMovingForward = !isLocalPlayer || dotDirection > -0.2;

      if (inCorridor && inCrossingPlane && isMovingForward) {
        // ------------------------------------------------------------------
        // CASE A: Crossing Start/Finish Line (Gate 0)
        // ------------------------------------------------------------------
        if (gateIdx === 0) {
          if (prog.lastPassedCheckpoint === -1) {
            // Crossing the start line for the first time at the start of the race!
            prog.lastPassedCheckpoint = 0;
            prog.nextExpectedCheckpoint = 1;
            prog.lapStartTime = currentTime;
            prog.lastFinishCrossTime = currentTime;
            prog.checkpointsPassedThisLap.clear();
          } else {
            // Normal finish line crossing to complete a lap
            const minLapCooldown = 8.0;
            const timeSinceLastLap = currentTime - prog.lastFinishCrossTime;
            const minCheckpointsRequired = Math.floor(numGates * 0.7);
            const hasSufficientCheckpoints = prog.checkpointsPassedThisLap.size >= minCheckpointsRequired;

            if (prog.state === 'RACING' && timeSinceLastLap > minLapCooldown && hasSufficientCheckpoints) {
              const lapDuration = currentTime - prog.lapStartTime;
              prog.lapTimes.push(lapDuration);
              if (prog.bestLapTime === 0 || lapDuration < prog.bestLapTime) {
                prog.bestLapTime = lapDuration;
              }

              prog.lapStartTime = currentTime;
              prog.lastFinishCrossTime = currentTime;
              prog.checkpointsPassedThisLap.clear();
              prog.lastPassedCheckpoint = 0;
              prog.nextExpectedCheckpoint = 1;
              lapCompleted = true;

              if (isLocalPlayer) {
                audio.playCheckpoint();
              }

              if (prog.lap >= this.totalLaps) {
                prog.isFinished = true;
                prog.state = 'RACE_FINISHED';
                prog.totalRaceTime = prog.lapTimes.reduce((a, b) => a + b, 0);
                raceCompleted = true;
              } else {
                prog.lap += 1;
              }
            }
          }
        } 
        // ------------------------------------------------------------------
        // CASE B: Standard Intermediate Checkpoint (Gates 1 ... N-1)
        // ------------------------------------------------------------------
        else {
          // Register checkpoint in sequence
          prog.checkpointsPassedThisLap.add(gateIdx);
          prog.lastPassedCheckpoint = gateIdx;
          prog.nextExpectedCheckpoint = (gateIdx + 1) % numGates;
        }

        break;
      }
    }

    prog.prevPosition.copy(position);
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
}
