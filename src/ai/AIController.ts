// ============================================================================
// KARTVERSE — Intelligent AI Racers System (Physics, Pathfinding, Rubberbanding)
// ============================================================================

import * as THREE from 'three';
import { KartPhysics } from '../vehicles/KartPhysics';
import { KartVisual, KartModelFactory } from '../vehicles/KartModels';
import { RacingPath } from './RacingPath';
import { PowerUpType } from '../items/PowerUpSystem';
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

  private itemCheckTimer = 0;

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
    this.lateralLane = (Math.random() - 0.5) * 6.0; // Lane offset between -3.0 and +3.0m

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

  public update(
    delta: number,
    leaderPos: THREE.Vector3,
    playerDistanceAhead: number, // positive if player is ahead of this AI
    onUseItem?: (type: PowerUpType, pos: THREE.Vector3, dir: THREE.Vector3) => void
  ): void {
    // 1. Determine target navigation waypoint
    const currentPos = this.physics.position;
    this.currentWaypointIndex = this.path.getClosestWaypointIndex(currentPos);
    this.progress = (this.lap - 1) * this.path.waypoints.length + this.currentWaypointIndex;

    const lookAheadUnits = this.difficulty === 'HARD' ? 6 : 4;
    const targetPoint = this.path.getTargetPosition(currentPos, lookAheadUnits, this.lateralLane);

    // 2. Compute steering angle towards target
    const toTarget = targetPoint.clone().sub(currentPos);
    const targetHeading = Math.atan2(toTarget.x, toTarget.z);

    let angleDiff = targetHeading - this.physics.rotationY;
    // Normalize angleDiff to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const steerInput = THREE.MathUtils.clamp(angleDiff * 2.5, -1, 1);

    // 3. Throttle & dynamic rubberband adjustment
    let throttle = 1.0;
    const curvature = this.path.waypoints[this.currentWaypointIndex].curvature;

    // Brake / drift if approaching a sharp hairpin turn
    let wantsDrift = false;
    if (Math.abs(angleDiff) > 0.55 && curvature > 0.25) {
      if (this.difficulty !== 'EASY') {
        wantsDrift = true;
      } else {
        throttle = 0.65;
      }
    }

    // Dynamic Rubberband: keep race compact and exciting!
    if (this.difficulty === 'HARD') {
      if (playerDistanceAhead > 30) {
        // Player is way ahead: AI catches up!
        this.physics.boost.trigger('PAD', 1.25, 2.0);
      }
    } else if (this.difficulty === 'EASY') {
      if (playerDistanceAhead < -25) {
        // AI is too far ahead of player: ease up
        throttle = 0.6;
      }
    }

    // Wants Nitro trigger
    const wantsNitro = Math.random() < (this.difficulty === 'HARD' ? 0.05 : 0.01);

    // 4. Update Physics
    this.physics.update(delta, throttle, steerInput, wantsDrift, wantsNitro, this.visual);

    // 5. Intelligent item deployment
    this.itemCheckTimer += delta;
    if (this.itemCheckTimer > 1.5 && this.heldPowerUp && onUseItem) {
      this.itemCheckTimer = 0;
      const fwd = new THREE.Vector3(Math.sin(this.physics.rotationY), 0, Math.cos(this.physics.rotationY));

      if (this.heldPowerUp === 'ROCKET_BOOST' || this.heldPowerUp === 'TURBO_CHARGE') {
        // Use immediately on straightaways
        if (curvature < 0.2) {
          this.physics.boost.trigger('PAD', 1.4, 2.5);
          this.heldPowerUp = null;
        }
      } else if (this.heldPowerUp === 'OIL_TRAP') {
        // Drop behind if anyone is close behind
        if (playerDistanceAhead < 0 && playerDistanceAhead > -30) {
          onUseItem('OIL_TRAP', this.physics.position, fwd);
          this.heldPowerUp = null;
        }
      } else if (this.heldPowerUp === 'HOMING_ORB') {
        // Fire forward at leader/player ahead
        if (playerDistanceAhead > 10) {
          onUseItem('HOMING_ORB', this.physics.position, fwd);
          this.heldPowerUp = null;
        }
      } else if (this.heldPowerUp === 'SHIELD') {
        this.heldPowerUp = null;
      }
    }
  }

  public hitByHazard(): void {
    this.physics.triggerSpinout();
  }

  public dispose(scene: THREE.Scene): void {
    scene.remove(this.visual.group);
  }
}

