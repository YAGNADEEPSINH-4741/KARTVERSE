// ============================================================================
// KARTVERSE — Advanced Nitro & Boost Propulsion System
// State Machine: READY | ACTIVE | COOLDOWN | RECHARGING
// Increases Acceleration, Boosts Top Speed, Debounced & Anti-Exploit
// ============================================================================

import { audio } from '../audio/AudioManager';

export type NitroState = 'READY' | 'ACTIVE' | 'COOLDOWN' | 'RECHARGING';

export class BoostSystem {
  public nitroPercent = 100;
  public state: NitroState = 'READY';
  
  public isNitroActive = false;
  public cooldownTimer = 0;
  public boostTimeRemaining = 0;
  public currentBoostMultiplier = 1.0;
  public currentAccelMultiplier = 1.0;

  // Rate constants
  private readonly CONSUMPTION_RATE = 40.0; // % per second during active nitro (~2.5s duration)
  private readonly RECHARGE_RATE = 14.0;    // % per second passive recharge
  private readonly COOLDOWN_DURATION = 0.6; // Seconds cooldown before recharging starts

  public update(delta: number, wantsNitro: boolean, speed: number): { speedMult: number; accelMult: number } {
    let speedMult = 1.0;
    let accelMult = 1.0;

    // 1. Process active mini-turbo / external boost pad timer
    if (this.boostTimeRemaining > 0) {
      this.boostTimeRemaining -= delta;
      speedMult = Math.max(speedMult, this.currentBoostMultiplier);
      accelMult = Math.max(accelMult, 1.8);
      if (this.boostTimeRemaining <= 0) {
        this.currentBoostMultiplier = 1.0;
      }
    }

    // 2. Nitro State Machine
    const canActivate = (this.state === 'READY' || this.state === 'RECHARGING') && 
                        this.nitroPercent > 8.0 && 
                        Math.abs(speed) > 1.5;

    switch (this.state) {
      case 'READY':
      case 'RECHARGING':
        if (wantsNitro && canActivate) {
          this.state = 'ACTIVE';
          this.isNitroActive = true;
          audio.playBoost();
        } else {
          // Passive regeneration up to 100%
          if (this.nitroPercent < 100) {
            this.nitroPercent = Math.min(100, this.nitroPercent + this.RECHARGE_RATE * delta);
          }
          if (this.nitroPercent >= 100) {
            this.state = 'READY';
          }
        }
        break;

      case 'ACTIVE':
        if (wantsNitro && this.nitroPercent > 0) {
          // Consume nitro energy
          this.nitroPercent = Math.max(0, this.nitroPercent - this.CONSUMPTION_RATE * delta);
          this.isNitroActive = true;
          speedMult = Math.max(speedMult, 1.48);  // +48% top speed boost
          accelMult = Math.max(accelMult, 2.6);   // +160% acceleration thrust!

          if (this.nitroPercent <= 0) {
            this.state = 'COOLDOWN';
            this.isNitroActive = false;
            this.cooldownTimer = this.COOLDOWN_DURATION;
          }
        } else {
          // Player released nitro key
          this.state = 'COOLDOWN';
          this.isNitroActive = false;
          this.cooldownTimer = this.COOLDOWN_DURATION;
        }
        break;

      case 'COOLDOWN':
        this.isNitroActive = false;
        this.cooldownTimer -= delta;
        if (this.cooldownTimer <= 0) {
          this.state = 'RECHARGING';
        }
        break;
    }

    return { speedMult, accelMult };
  }

  public addBonusRecharge(amount: number): void {
    this.nitroPercent = Math.min(100, this.nitroPercent + amount);
    if (this.state === 'COOLDOWN' || this.state === 'RECHARGING') {
      if (this.nitroPercent > 20) {
        this.state = 'READY';
      }
    }
  }

  public applyBoost(duration: number, multiplier: number): void {
    this.boostTimeRemaining = Math.max(this.boostTimeRemaining, duration);
    this.currentBoostMultiplier = Math.max(this.currentBoostMultiplier, multiplier);
    audio.playBoost();
  }

  public trigger(type: string, multiplier: number, duration: number): void {
    this.applyBoost(duration, multiplier);
  }

  public getNitroPercent(): number {
    return this.nitroPercent;
  }

  public getState(): NitroState {
    return this.state;
  }
}
