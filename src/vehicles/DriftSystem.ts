// ============================================================================
// KARTVERSE — Advanced Arcade Drift & Mini-Turbo Charging System
// Level 1: Blue Sparks -> Level 2: Purple Sparks -> Level 3: Gold Sparks
// Lateral Slip, Dynamic Kart Tilt, Camera Roll & Multi-Tier Boost Release
// ============================================================================

import * as THREE from 'three';
import { audio } from '../audio/AudioManager';

export interface DriftOutput {
  boostDuration: number;
  boostMultiplier: number;
  boostTier: number; // 1, 2, or 3
  boostName: string; // 'MINI-TURBO!', 'SUPER MINI-TURBO!', 'ULTRA MINI-TURBO!'
}

export class DriftSystem {
  public isDrifting = false;
  public driftDirection: 'LEFT' | 'RIGHT' | 'NONE' = 'NONE';
  public driftTimer = 0;
  public driftTier = 0; // 0=None, 1=Blue, 2=Purple, 3=Gold
  
  // Dynamic kinematics for visual feedback
  public driftAngle = 0;      // Yaw offset angle (radians)
  public bodyRoll = 0;        // Body lean into drift
  public lateralSlipVelocity = 0; // Lateral slide across track
  public cameraTilt = 0;      // Dynamic roll for third person camera

  // Thresholds (Seconds of sustained drift to charge tiers)
  private readonly TIER_1_TIME = 1.1; // Blue Mini-Turbo
  private readonly TIER_2_TIME = 2.4; // Purple Super Mini-Turbo
  private readonly TIER_3_TIME = 3.8; // Gold Ultra Mini-Turbo

  public update(
    delta: number,
    wantsDrift: boolean,
    steerInput: number,
    speed: number
  ): DriftOutput | null {
    // Can only initiate or sustain drift if moving forward with adequate velocity
    if (speed < 11.0) {
      if (this.isDrifting) this.cancelDrift();
      return null;
    }

    if (wantsDrift) {
      // 1. Initiate drift if steering into a turn
      if (!this.isDrifting && Math.abs(steerInput) > 0.15) {
        this.isDrifting = true;
        this.driftDirection = steerInput > 0 ? 'RIGHT' : 'LEFT';
        this.driftTimer = 0;
        this.driftTier = 0;
      }

      if (this.isDrifting) {
        this.driftTimer += delta;

        // Steering influence on drift tightness
        // Steering into drift tightens the arc; counter-steering widens the arc
        const dirSign = this.driftDirection === 'RIGHT' ? 1 : -1;
        const steerBonus = steerInput * dirSign; // positive if steering into drift
        const targetAngle = dirSign * (0.42 + steerBonus * 0.18);
        this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetAngle, 12 * delta);

        // Body roll into the turn
        const targetRoll = -dirSign * (0.08 + Math.abs(steerInput) * 0.06);
        this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, targetRoll, 10 * delta);

        // Camera tilt
        const targetCamTilt = dirSign * 0.05;
        this.cameraTilt = THREE.MathUtils.lerp(this.cameraTilt, targetCamTilt, 8 * delta);

        // Lateral slip (centrifugal drift slide)
        this.lateralSlipVelocity = dirSign * (2.8 + (speed / 35.0) * 2.2);

        // --------------------------------------------------------------------
        // Drift Tier Upgrades (Blue -> Purple -> Gold)
        // --------------------------------------------------------------------
        if (this.driftTimer >= this.TIER_3_TIME && this.driftTier < 3) {
          this.driftTier = 3;
          audio.playDriftSparks(3);
        } else if (this.driftTimer >= this.TIER_2_TIME && this.driftTier < 2) {
          this.driftTier = 2;
          audio.playDriftSparks(2);
        } else if (this.driftTimer >= this.TIER_1_TIME && this.driftTier < 1) {
          this.driftTier = 1;
          audio.playDriftSparks(1);
        }
      }
    } else {
      // 2. Released drift key -> Unleash Mini-Turbo Boost!
      if (this.isDrifting) {
        const releasedTier = this.driftTier;
        this.cancelDrift();

        if (releasedTier === 1) {
          audio.playBoost();
          return {
            boostDuration: 1.3,
            boostMultiplier: 1.28,
            boostTier: 1,
            boostName: 'MINI-TURBO!'
          };
        } else if (releasedTier === 2) {
          audio.playBoost();
          return {
            boostDuration: 2.3,
            boostMultiplier: 1.50,
            boostTier: 2,
            boostName: 'SUPER MINI-TURBO!'
          };
        } else if (releasedTier === 3) {
          audio.playBoost();
          return {
            boostDuration: 3.4,
            boostMultiplier: 1.78,
            boostTier: 3,
            boostName: 'ULTRA MINI-TURBO!'
          };
        }
      }
    }

    // Decay visual angles when not drifting
    if (!this.isDrifting) {
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, 0, 14 * delta);
      this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, 0, 12 * delta);
      this.cameraTilt = THREE.MathUtils.lerp(this.cameraTilt, 0, 10 * delta);
      this.lateralSlipVelocity = THREE.MathUtils.lerp(this.lateralSlipVelocity, 0, 12 * delta);
    }

    return null;
  }

  public cancelDrift(): void {
    this.isDrifting = false;
    this.driftDirection = 'NONE';
    this.driftTimer = 0;
    this.driftTier = 0;
  }

  public getLevel(): number {
    return this.driftTier;
  }

  public getDirection(): number {
    return this.driftDirection === 'RIGHT' ? 1 : this.driftDirection === 'LEFT' ? -1 : 0;
  }
}
