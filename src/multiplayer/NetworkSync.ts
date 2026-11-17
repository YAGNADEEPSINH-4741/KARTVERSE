// ============================================================================
// KARTVERSE — Remote Players Interpolation & Visual Synchronization
// ============================================================================

import * as THREE from 'three';
import { KartVisual, KartModelFactory } from '../vehicles/KartModels';
import { RemoteTelemetryPacket } from './SocketManager';

export interface RemotePlayerEntity {
  id: string;
  visual: KartVisual;
  targetPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  targetRotationY: number;
  currentRotationY: number;
  targetSpeed: number;
  driftLevel: number;
  lastUpdate: number;
}

export class NetworkSync {
  public scene: THREE.Scene;
  public remotePlayers = new Map<string, RemotePlayerEntity>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public registerRemotePlayer(id: string, kartId: string, kartColor: string): RemotePlayerEntity {
    // If already exists, return it
    if (this.remotePlayers.has(id)) {
      return this.remotePlayers.get(id)!;
    }

    const visual = KartModelFactory.createKart(kartId, kartColor);
    this.scene.add(visual.group);

    const entity: RemotePlayerEntity = {
      id,
      visual,
      targetPosition: new THREE.Vector3(),
      currentPosition: new THREE.Vector3(),
      targetRotationY: 0,
      currentRotationY: 0,
      targetSpeed: 0,
      driftLevel: 0,
      lastUpdate: performance.now()
    };

    this.remotePlayers.set(id, entity);
    return entity;
  }

  public handleTelemetry(packet: RemoteTelemetryPacket): void {
    let entity = this.remotePlayers.get(packet.playerId);
    if (!entity) {
      // Default fallback kart if not pre-registered
      entity = this.registerRemotePlayer(packet.playerId, 'speed_demon', '#00f0ff');
    }

    entity.targetPosition.set(packet.position.x, packet.position.y, packet.position.z);
    entity.targetRotationY = packet.rotationY;
    entity.targetSpeed = packet.speed;
    entity.driftLevel = packet.driftLevel;
    entity.lastUpdate = performance.now();
  }

  public update(delta: number): void {
    const lerpRate = Math.min(1.0, delta * 14.0); // Smooth interpolation at 60fps

    for (const [id, entity] of this.remotePlayers.entries()) {
      // Position lerp
      entity.currentPosition.lerp(entity.targetPosition, lerpRate);
      entity.visual.group.position.copy(entity.currentPosition);

      // Rotation lerp with angle wrap handling
      let diff = entity.targetRotationY - entity.currentRotationY;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      entity.currentRotationY += diff * lerpRate;
      entity.visual.group.rotation.y = entity.currentRotationY;

      // Wheel spin animation based on speed
      const wheelSpin = (entity.targetSpeed * delta * 5) % (Math.PI * 2);
      entity.visual.wheels.forEach(w => {
        w.rotation.x += wheelSpin;
      });

      // Drift sparks visualization
      if (entity.driftLevel > 0) {
        entity.visual.driftSparks.forEach(s => (s.visible = true));
      } else {
        entity.visual.driftSparks.forEach(s => (s.visible = false));
      }
    }
  }

  public removePlayer(id: string): void {
    const entity = this.remotePlayers.get(id);
    if (entity) {
      this.scene.remove(entity.visual.group);
      this.remotePlayers.delete(id);
    }
  }

  public clear(): void {
    for (const [_, entity] of this.remotePlayers.entries()) {
      this.scene.remove(entity.visual.group);
    }
    this.remotePlayers.clear();
  }
}

