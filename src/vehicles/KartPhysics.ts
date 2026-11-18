// ============================================================================
// KARTVERSE — Vehicle Physics Simulation
// Signed Longitudinal Velocity, Transmission Gears (Forward / Reverse),
// Nitro Acceleration Thrust, Dynamic Drift Kinematics & Strict Wall Boundaries
// ============================================================================

import * as THREE from 'three';
import { BoostSystem } from './BoostSystem';
import { DriftSystem } from './DriftSystem';
import { KartVisual } from './KartModels';
import { audio } from '../audio/AudioManager';
import { TrackConstraintResult } from '../tracks/TrackManager';

export interface KartSpecs {
  topSpeed: number;     // e.g. 36 m/s (~130 km/h)
  acceleration: number; // m/s^2
  handling: number;     // turn rate multiplier
  weight: number;       // kg
  driftGrip: number;    // grip friction during drift
}

export class KartPhysics {
  public position = new THREE.Vector3();
  public velocity = new THREE.Vector3();
  public rotationY = 0;
  public speed = 0; // Signed longitudinal velocity (+ = forward, - = reverse)
  public isReversing = false;
  private reverseEngageTimer = 0;

  public steeringAngle = 0;
  public pitch = 0;
  public roll = 0;
  public roadElevation = 0;

  public specs: KartSpecs;
  public boost = new BoostSystem();
  public drift = new DriftSystem();

  public isSpinningOut = false;
  public spinoutTimer = 0;
  public latestBoostName: string | null = null;

  constructor(specs?: Partial<KartSpecs>) {
    this.specs = {
      topSpeed: specs?.topSpeed || 36.0,
      acceleration: specs?.acceleration || 26.0,
      handling: specs?.handling || 2.5,
      weight: specs?.weight || 70,
      driftGrip: specs?.driftGrip || 0.85
    };
  }

  public update(
    delta: number,
    throttle: number,   // -1 (reverse/brake), 0, 1 (accelerate)
    steer: number,      // -1 (left), 0, 1 (right)
    wantsDrift: boolean,
    wantsNitro: boolean,
    visual?: KartVisual,
    isBrakeOnly = false
  ): void {
    // 1. Handle spinout recovery
    if (this.isSpinningOut) {
      this.spinoutTimer -= delta;
      this.rotationY += 16 * delta; // Rapid 360 spin
      this.speed *= 0.92;
      if (this.spinoutTimer <= 0) {
        this.isSpinningOut = false;
      }
      this.applyVelocity(delta, visual);
      return;
    }

    // 2. Process Boost & Drift Systems
    const boostOutput = this.boost.update(delta, wantsNitro, this.speed);
    const driftResult = this.drift.update(delta, wantsDrift, steer, this.speed);

    if (driftResult) {
      this.boost.applyBoost(driftResult.boostDuration, driftResult.boostMultiplier);
      this.boost.addBonusRecharge(driftResult.boostTier * 12.0); // Reward skilled drifting with nitro
      this.latestBoostName = driftResult.boostName;
    }

    const currentMaxSpeed = this.specs.topSpeed * boostOutput.speedMult;
    const effectiveAcceleration = this.specs.acceleration * boostOutput.accelMult;

    // 3. Proper Signed Longitudinal Velocity & Drive/Reverse Gears
    if (this.isReversing) {
      if (throttle < 0) {
        // Accelerating in reverse (ArrowDown / S)
        const maxReverseSpeed = -13.0; // ~47 km/h max reverse
        this.speed = Math.max(maxReverseSpeed, this.speed - this.specs.acceleration * 0.75 * delta);
      } else if (throttle > 0) {
        // Active braking while moving in reverse (ArrowUp / W)
        this.speed = Math.min(0, this.speed + 40.0 * delta);
        if (this.speed >= -0.05) {
          this.speed = 0;
          this.isReversing = false; // Disengage reverse gear when stopped
        }
      } else {
        // Rolling drag in reverse
        this.speed *= Math.pow(0.96, delta * 60);
        if (Math.abs(this.speed) < 0.1) {
          this.speed = 0;
          this.isReversing = false;
        }
      }
    } else {
      // Forward Gear
      if (throttle > 0) {
        this.speed = Math.min(currentMaxSpeed, this.speed + effectiveAcceleration * delta);
      } else if (throttle < 0) {
        if (this.speed > 0.05) {
          // Active Braking: firmly decelerate to zero, NEVER allow negative speed!
          this.speed = Math.max(0, this.speed - 42.0 * delta);
        } else {
          // If brake only (e.g. dedicated Brake button), stay firmly stopped at 0
          if (isBrakeOnly) {
            this.speed = 0;
            this.reverseEngageTimer = 0;
          } else {
            // Fully stopped and holding reverse input: engage Reverse Gear
            this.speed = 0;
            this.reverseEngageTimer += delta;
            if (this.reverseEngageTimer > 0.12) {
              this.isReversing = true;
              this.reverseEngageTimer = 0;
            }
          }
        }
      } else {
        // Coasting / natural rolling drag
        this.reverseEngageTimer = 0;
        this.speed *= Math.pow(0.985, delta * 60);
        if (this.speed < 0.05) this.speed = 0;
      }

      // If nitro is active, provide immediate forward propulsion kick
      if (this.boost.isNitroActive && this.speed < currentMaxSpeed) {
        this.speed = Math.min(currentMaxSpeed, this.speed + effectiveAcceleration * delta);
      }
    }

    // 4. Steering and Drifting Dynamics
    const targetSteer = steer * 0.55;
    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteer, 14 * delta);

    if (Math.abs(this.speed) > 0.4) {
      const turnFactor = this.speed >= 0 ? 1 : -1;
      let turnRate = this.specs.handling * this.steeringAngle * turnFactor * delta;

      // In drift mode, turn rate increases and is directed along drift heading
      if (this.drift.isDrifting) {
        const driftDirectionSign = this.drift.driftDirection === 'RIGHT' ? 1 : -1;
        turnRate += driftDirectionSign * 1.35 * delta;
      }

      this.rotationY += turnRate;
    }

    // 5. Update Position and Visual Kinematics
    this.applyVelocity(delta, visual);
  }

  private applyVelocity(delta: number, visual?: KartVisual): void {
    // Heading with drift angle compensation
    const effectiveYaw = this.rotationY + (this.drift.isDrifting ? this.drift.driftAngle : 0);

    const forwardX = Math.sin(this.rotationY);
    const forwardZ = Math.cos(this.rotationY);

    // Lateral slide axis (perpendicular to forward)
    const binormalX = Math.cos(this.rotationY);
    const binormalZ = -Math.sin(this.rotationY);

    // Apply forward and lateral drift slip velocity
    this.position.x += (forwardX * this.speed + binormalX * this.drift.lateralSlipVelocity) * delta;
    this.position.z += (forwardZ * this.speed + binormalZ * this.drift.lateralSlipVelocity) * delta;
    this.position.y = THREE.MathUtils.lerp(this.position.y, this.roadElevation + 0.2, Math.min(1.0, delta * 15.0));

    if (visual) {
      visual.root.position.copy(this.position);
      // Include dynamic body roll into turns
      visual.root.rotation.set(this.pitch, effectiveYaw, this.roll + this.drift.bodyRoll);

      // Animate wheels
      const wheelRoll = (this.speed * delta) / 0.34;
      visual.wheels.forEach((wGroup, idx) => {
        const tire = wGroup.children[0] as THREE.Mesh;
        if (tire) tire.rotation.x += wheelRoll;

        // Front wheels turn with steering
        if (idx < 2) {
          wGroup.rotation.y = this.steeringAngle;
        }
      });

      // Animate Dual Boost Rocket Exhaust Flames
      const isBoosting = this.boost.isNitroActive || this.boost.boostTimeRemaining > 0;
      if (visual.boostFlames) {
        visual.boostFlames.forEach(flame => {
          flame.visible = isBoosting;
          if (isBoosting) {
            const flicker = 0.85 + Math.random() * 0.35;
            flame.scale.set(flicker, flicker * (this.boost.isNitroActive ? 1.6 : 1.25), flicker);
          }
        });
      }

      // Animate Drift Sparks (Level 1: Blue, Level 2: Purple, Level 3: Gold)
      const driftLvl = this.drift.getLevel();
      if (visual.driftSparks) {
        visual.driftSparks.forEach((spark) => {
          spark.visible = this.drift.isDrifting && driftLvl > 0;
          if (spark.visible) {
            spark.rotation.x += delta * 15;
            spark.rotation.y += delta * 18;
            const color = driftLvl === 1 ? 0x00f0ff : driftLvl === 2 ? 0xd946ef : 0xfacc15;
            (spark.material as THREE.MeshBasicMaterial).color.setHex(color);
          }
        });
      }
    }

    // Audio update for engine pitch
    audio.updateKartEngine(Math.abs(this.speed) / this.specs.topSpeed, this.speed >= 0 ? 1 : 0);
  }

  public triggerSpinout(): void {
    if (this.isSpinningOut) return;
    this.isSpinningOut = true;
    this.spinoutTimer = 1.2;
    this.drift.cancelDrift();
    audio.playCollision();
  }

  public bounceWall(wallNormal: THREE.Vector3): void {
    this.speed = Math.max(0, this.speed * 0.65);
    this.position.addScaledVector(wallNormal, 0.4);
    audio.playCollision();
  }

  // --------------------------------------------------------------------------
  // TRACK BOUNDARY ENFORCEMENT & CLAMPING
  // --------------------------------------------------------------------------
  public applyTrackConstraint(constraint: TrackConstraintResult, delta: number, visual?: KartVisual): void {
    this.roadElevation = constraint.roadElevation;

    // 1. Off-track / Rescue check: if somehow ejected or way below road
    if (constraint.isOutOfBounds) {
      this.position.copy(constraint.nearestCenter).add(new THREE.Vector3(0, 0.35, 0));
      this.rotationY = Math.atan2(constraint.tangent.x, constraint.tangent.z);
      this.speed = Math.max(0, this.speed * 0.25);
      this.velocity.set(0, 0, 0);
      if (visual) {
        visual.root.position.copy(this.position);
      }
      return;
    }

    // 2. Wall barrier collision & hard clamping
    if (constraint.isHittingBarrier) {
      // Hard clamp position strictly within barrier boundary
      this.position.copy(constraint.clampedPosition);
      if (visual) {
        visual.root.position.copy(this.position);
      }

      // Wall bounce physics: damp forward speed, never allow negative forward speed
      this.speed = Math.max(0, this.speed * 0.72);
      this.drift.cancelDrift();

      // Realign kart gently with track tangent so it bounces smoothly along the barrier
      const trackYaw = Math.atan2(constraint.tangent.x, constraint.tangent.z);
      this.rotationY = THREE.MathUtils.lerp(this.rotationY, trackYaw, Math.min(1.0, delta * 6.0));

      audio.playCollision();
      return;
    }

    // 3. Kerb rumble / off-road drag penalty
    if (constraint.isOnKerb) {
      const maxKerbSpeed = this.specs.topSpeed * 0.68;
      if (this.speed > maxKerbSpeed) {
        this.speed = THREE.MathUtils.lerp(this.speed, maxKerbSpeed, delta * 5.0);
      }
    }
  }
}
