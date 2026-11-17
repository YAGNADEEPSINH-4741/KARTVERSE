// ============================================================================
// KARTVERSE — Power-Up & Item Weapons System
// 8 Balanced Arcade Items: Rocket, Shield, Oil Trap, Homing Orb, etc.
// ============================================================================

import * as THREE from 'three';
import { audio } from '../audio/AudioManager';

export type PowerUpType = 
  | 'ROCKET_BOOST'
  | 'SHIELD'
  | 'OIL_TRAP'
  | 'HOMING_ORB'
  | 'LIGHTNING_PULSE'
  | 'TURBO_CHARGE'
  | 'MYSTERY_BOX'
  | 'SPEED_MAGNET';

export interface PowerUpDefinition {
  type: PowerUpType;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const POWER_UPS: Record<PowerUpType, PowerUpDefinition> = {
  ROCKET_BOOST: {
    type: 'ROCKET_BOOST',
    name: 'Rocket Boost',
    icon: '🚀',
    color: '#ff3b30',
    description: 'High-speed thruster surge forward.'
  },
  SHIELD: {
    type: 'SHIELD',
    name: 'Energy Shield',
    icon: '🛡️',
    color: '#00f0ff',
    description: 'Absorbs the next projectile or obstacle impact.'
  },
  OIL_TRAP: {
    type: 'OIL_TRAP',
    name: 'Oil Slick',
    icon: '🛢️',
    color: '#343a40',
    description: 'Drops a slippery puddle behind your kart.'
  },
  HOMING_ORB: {
    type: 'HOMING_ORB',
    name: 'Homing Orb',
    icon: '🔮',
    color: '#af52de',
    description: 'Chases the opponent ahead and spins them out.'
  },
  LIGHTNING_PULSE: {
    type: 'LIGHTNING_PULSE',
    name: 'Lightning Pulse',
    icon: '⚡',
    color: '#ffcc00',
    description: 'Temporarily shocks and slows all opponents.'
  },
  TURBO_CHARGE: {
    type: 'TURBO_CHARGE',
    name: 'Turbo Charge',
    icon: '🔥',
    color: '#ff9500',
    description: 'Triple explosive acceleration bursts.'
  },
  MYSTERY_BOX: {
    type: 'MYSTERY_BOX',
    name: 'Mystery Box',
    icon: '❓',
    color: '#34c759',
    description: 'Grants an unpredictable surprise power-up.'
  },
  SPEED_MAGNET: {
    type: 'SPEED_MAGNET',
    name: 'Speed Magnet',
    icon: '🧲',
    color: '#5856d6',
    description: 'Slingshots your kart toward the leader.'
  }
};

export class ItemManager {
  private static pool: PowerUpType[] = [
    'ROCKET_BOOST',
    'SHIELD',
    'OIL_TRAP',
    'HOMING_ORB',
    'LIGHTNING_PULSE',
    'TURBO_CHARGE',
    'MYSTERY_BOX',
    'SPEED_MAGNET'
  ];

  // Dynamic balance: racers further back get stronger catch-up items!
  public static getRandomItem(position: number, totalRacers = 8): PowerUpType {
    if (position >= totalRacers - 1) {
      // 7th or 8th place: high chance of Lightning, Homing Orb or Turbo
      const strong: PowerUpType[] = ['LIGHTNING_PULSE', 'HOMING_ORB', 'TURBO_CHARGE', 'SPEED_MAGNET'];
      return strong[Math.floor(Math.random() * strong.length)];
    } else if (position === 1) {
      // 1st place: Defensive items (Shield, Oil Trap)
      const defense: PowerUpType[] = ['SHIELD', 'OIL_TRAP', 'ROCKET_BOOST'];
      return defense[Math.floor(Math.random() * defense.length)];
    }

    return this.pool[Math.floor(Math.random() * this.pool.length)];
  }
}

