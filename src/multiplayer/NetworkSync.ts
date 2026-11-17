// ============================================================================
// KARTVERSE — Remote Players Interpolation & Visual Synchronization
// 3D Billboard Floating Nametags, Real-Time Lerp & Wheel/Sparks Animations
// ============================================================================

import * as THREE from 'three';
import { KartVisual, KartModelFactory } from '../vehicles/KartModels';
import { RemoteTelemetryPacket } from './SocketManager';

export interface RemotePlayerEntity {
  id: string;
  name: string;
  isHost: boolean;
  visual: KartVisual;
  nametagSprite?: THREE.Sprite;
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

  public registerRemotePlayer(
    id: string,
    kartId: string,
    kartColor: string,
    username: string = 'Racer',
    isHost: boolean = false
  ): RemotePlayerEntity {
    // If already exists, return it
    if (this.remotePlayers.has(id)) {
      const existing = this.remotePlayers.get(id)!;
      existing.name = username;
      existing.isHost = isHost;
      return existing;
    }

    const visual = KartModelFactory.createKart(kartId, kartColor);
    this.scene.add(visual.group);

    // Create 3D floating billboard nametag
    const nametagSprite = this.createNametagSprite(username, isHost, kartColor);
    visual.group.add(nametagSprite);

    const entity: RemotePlayerEntity = {
      id,
      name: username,
      isHost,
      visual,
      nametagSprite,
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

  private createNametagSprite(name: string, isHost: boolean, color: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Background pill badge
    ctx.fillStyle = 'rgba(10, 15, 26, 0.88)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 96, 48);
    ctx.fill();

    // Border glow
    ctx.strokeStyle = isHost ? '#f59e0b' : (color || '#00f0ff');
    ctx.lineWidth = 8;
    ctx.stroke();

    // Text label
    ctx.font = '900 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    const displayName = (isHost ? '👑 ' : '🏎️ ') + (name.length > 14 ? name.substring(0, 14) + '…' : name);
    ctx.fillText(displayName, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.8, 0.95, 1.0);
    sprite.position.set(0, 1.9, 0); // Floats directly above kart roof
    return sprite;
  }

  public handleTelemetry(packet: RemoteTelemetryPacket): void {
    let entity = this.remotePlayers.get(packet.playerId);
    if (!entity) {
      // Fallback kart if not pre-registered
      entity = this.registerRemotePlayer(packet.playerId, 'velocity_gt', '#00f0ff', 'Remote Racer', false);
    }

    entity.targetPosition.set(packet.position.x, packet.position.y, packet.position.z);
    entity.targetRotationY = packet.rotationY;
    entity.targetSpeed = packet.speed;
    entity.driftLevel = packet.driftLevel;
    entity.lastUpdate = performance.now();
  }

  public update(delta: number): void {
    const lerpRate = Math.min(1.0, delta * 15.0); // Smooth interpolation at 60fps

    for (const [_, entity] of this.remotePlayers.entries()) {
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
