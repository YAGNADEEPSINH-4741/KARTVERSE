// ============================================================================
// KARTVERSE — Intelligent AI Racers System (Physics, Pathfinding, Rubberbanding)
// ============================================================================

import * as THREE from 'three';
import { KartPhysics } from '../vehicles/KartPhysics';
import { KartVisual, KartModelFactory } from '../vehicles/KartModels';
import { RacingPath } from './RacingPath';
import { PowerUpType } from '../items/PowerUpSystem';
import type { CheckpointGate } from '../tracks/TrackManager';
import { AIDifficulty } from '../store/gameStore';

export interface AIRacerProfile {
  id: string;
  name: string;
  kartId: string;
  color: string;
  aggression: number; // 0.0 - 1.0
  skill: number;      // 0.0 - 1.0
}

export const AI_ROSTER: AIRacerProfile[] = [
  { id: 'ai_1', name: 'Blaze Nitro', kartId: 'speed_demon', color: '#0284c7', aggression: 0.9, skill: 0.95 },
  { id: 'ai_2', name: 'Cyber Phantom', kartId: 'cyber_glider', color: '#00f0ff', aggression: 0.8, skill: 0.88 },
  { id: 'ai_3', name: 'Titan Rex', kartId: 'vortex_striker', color: '#f59e0b', aggression: 0.85, skill: 0.82 },
  { id: 'ai_4', name: 'Luna Swift', kartId: 'quantum_leap', color: '#06b6d4', aggression: 0.75, skill: 0.85 },
  { id: 'ai_5', name: 'Solar Apex', kartId: 'hyper_drift', color: '#eab308', aggression: 0.7, skill: 0.78 },
  { id: 'ai_6', name: 'Viper Drift', kartId: 'shadow_phantom', color: '#10b981', aggression: 0.8, skill: 0.80 },
  { id: 'ai_7', name: 'Frost Bite', kartId: 'speed_demon', color: '#38bdf8', aggression: 0.65, skill: 0.75 }
];

export interface Opponent {
  id: string;
  position: THREE.Vector3;
}

export class AIRacer {
  public profile: AIRacerProfile;
  public physics: KartPhysics;
  public visual: KartVisual;
  public path: RacingPath;
  public currentWaypointIndex = 0;
  public lap = 1;
  public progress = 0; // lap * 1000 + wpIndex
  public heldPowerUp: PowerUpType | null = null;
  public lateralLane: number;
  public difficulty: AIDifficulty;

  private itemHoldTime = 0;
  private nitroTime = 0;
  private nitroRecovery: number;
  private preferredLane: number;
  private lastCheckpoint = -1;
  private secondsWithoutCheckpoint = 0;

  public recoverIfStuck(delta: number, checkpoint: number, gates: readonly CheckpointGate[]): boolean {
    if (checkpoint !== this.lastCheckpoint) {
      this.lastCheckpoint = checkpoint;
      this.secondsWithoutCheckpoint = 0;
    }
    this.secondsWithoutCheckpoint += delta;
    if (this.secondsWithoutCheckpoint < 25) return false;

    const gate = gates[Math.max(checkpoint, 0)];
    this.physics.position.copy(gate.center).addScaledVector(gate.tangent, checkpoint < 0 ? -6 : 6);
    this.physics.position.y += 0.3;
    this.physics.rotationY = Math.atan2(gate.tangent.x, gate.tangent.z);
    this.physics.speed = 0;
    this.physics.velocity.set(0, 0, 0);
    this.nitroTime = 0;
    this.nitroRecovery = 2;
    this.secondsWithoutCheckpoint = 0;
    return true;
  }

  constructor(
    scene: THREE.Scene,
    profile: AIRacerProfile,
    path: RacingPath,
    difficulty: AIDifficulty = 'MEDIUM',
    startPos: THREE.Vector3,
    startRotY: number
  ) {
    this.profile = profile;
    this.path = path;
    this.difficulty = difficulty;
    this.preferredLane = (Math.random() - 0.5) * 6;
    this.lateralLane = this.preferredLane;
    this.nitroRecovery = 0.8 + Math.random() * 2;

    // Speed spec tuned by difficulty
    const topSpeedMod = difficulty === 'HARD' ? 38.0 : difficulty === 'MEDIUM' ? 34.0 : 29.0;
    this.physics = new KartPhysics({
      topSpeed: topSpeedMod * (0.95 + profile.skill * 0.1),
      acceleration: 24.0 * (0.95 + profile.skill * 0.1),
      handling: 2.8,
      driftGrip: 0.88
    });

    this.physics.position.copy(startPos);
    this.physics.rotationY = startRotY;

    // Visual model
    this.visual = KartModelFactory.createKart(profile.kartId, profile.color);
    scene.add(this.visual.group);
  }

  public collectItem(item: PowerUpType): void {
    this.heldPowerUp = item;
    this.itemHoldTime = 0;
  }

  public update(
    delta: number,
    opponents: readonly Opponent[],
    onUseItem?: (type: PowerUpType, target?: Opponent) => void
  ): void {
    const { position, rotationY, speed, boost } = this.physics;
    this.currentWaypointIndex = this.path.getClosestWaypointIndex(position);
    const waypoints = this.path.waypoints;
    const waypoint = waypoints[this.currentWaypointIndex];
    const side = new THREE.Vector3().crossVectors(waypoint.tangent, new THREE.Vector3(0, 1, 0)).normalize();

    let ahead: Opponent | undefined;
    let aheadDistance = 42;
    let trailing = false;
    let blockingSide: number | undefined;
    for (const opponent of opponents) {
      if (opponent.id === this.profile.id) continue;
      const offset = opponent.position.clone().sub(position);
      const distance = offset.length();
      const longitudinal = offset.dot(waypoint.tangent);
      const lateral = offset.dot(side);
      if (distance < aheadDistance && longitudinal > 3 && Math.abs(lateral) < 12) {
        ahead = opponent;
        aheadDistance = distance;
        blockingSide = Math.abs(lateral) < 4 ? lateral : undefined;
      }
      if (distance < 26 && longitudinal < -2 && Math.abs(lateral) < 5) trailing = true;
    }

    const passing = aheadDistance < 14 && blockingSide !== undefined;
    const passingSide = blockingSide === 0 ? Math.sign(this.preferredLane) || 1 : -(Math.sign(blockingSide ?? 0));
    const upcoming = waypoints[(this.currentWaypointIndex + 2) % waypoints.length];
    const curvature = Math.max(waypoint.curvature, upcoming.curvature);
    const lane = passing && curvature < 0.3 ? passingSide * Math.min(4, waypoint.roadWidth * 0.28)
      : this.preferredLane * (1 - Math.min(0.9, curvature * 1.7));
    this.lateralLane = THREE.MathUtils.lerp(this.lateralLane, lane, Math.min(1, delta * 2));
    const lookAhead = curvature > 0.27 ? 2 : speed > 28 ? 4 : 3;
    const target = this.path.getTargetPosition(position, lookAhead, this.lateralLane, this.currentWaypointIndex);
    const heading = Math.atan2(target.x - position.x, target.z - position.z);
    const angle = Math.atan2(Math.sin(heading - rotationY), Math.cos(heading - rotationY));
    const turn = Math.max(curvature, Math.abs(angle) * 0.6);
    const steer = THREE.MathUtils.clamp(angle * 2.5, -1, 1);
    const drift = this.difficulty !== 'EASY' && turn > 0.25 && Math.abs(angle) > 0.22 && speed > 15;
    const cornerSpeed = THREE.MathUtils.lerp(this.physics.specs.topSpeed, 13 + this.profile.skill * 8, Math.min(1, turn * 1.55));
    const throttle = speed > cornerSpeed + 5 ? -0.4 : speed > cornerSpeed ? 0.35 : 1;

    const clearStraight = turn < 0.17 && aheadDistance > 11;
    this.nitroRecovery = Math.max(0, this.nitroRecovery - delta);
    if (this.nitroTime > 0) {
      this.nitroTime = clearStraight ? Math.max(0, this.nitroTime - delta) : 0;
    } else if (clearStraight && speed > 10 && boost.nitroPercent > 35 &&
               boost.boostTimeRemaining <= 0 && this.nitroRecovery === 0) {
      this.nitroTime = 0.75 + this.profile.aggression * 0.85;
      this.nitroRecovery = this.nitroTime + (this.difficulty === 'EASY' ? 6 : this.difficulty === 'HARD' ? 2 : 3.5);
    }
    this.physics.update(delta, throttle, steer, drift, this.nitroTime > 0, this.visual, throttle < 0);

    const item = this.heldPowerUp;
    if (!item || !onUseItem) return;
    this.itemHoldTime += delta;
    if (this.itemHoldTime < 0.5 + (1 - this.profile.aggression)) return;
    const heldLong = this.itemHoldTime > 7;
    const ready = item === 'OIL_TRAP' ? trailing || heldLong
      : item === 'HOMING_ORB' ? !!ahead || heldLong
      : item === 'SHIELD' ? trailing || aheadDistance < 18 || heldLong
      : item === 'LIGHTNING_PULSE' ? !!ahead || trailing || heldLong
      : (clearStraight || (heldLong && turn < 0.3)) && !boost.isNitroActive;
    if (ready) {
      this.heldPowerUp = null;
      onUseItem(item, ahead);
    }
  }

  public hitByHazard(): void {
    this.physics.triggerSpinout();
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.visual.group);
  }
}

