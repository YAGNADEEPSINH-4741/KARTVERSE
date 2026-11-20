// ============================================================================
// KARTVERSE — Dynamic 3D Item Box Pickups & Active Projectiles Manager
// ============================================================================

import * as THREE from 'three';
import { disposeObjects } from '../game/disposeObjects';
import { PowerUpType, ItemManager, POWER_UPS } from './PowerUpSystem';
import { audio } from '../audio/AudioManager';

export interface ItemBox {
  group: THREE.Group;
  outerCube: THREE.Mesh;
  innerGem: THREE.Mesh;
  position: THREE.Vector3;
  active: boolean;
  respawnTimer: number;
}

export interface ActiveHazard {
  id: string;
  type: 'OIL_TRAP';
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  ownerId: string;
  lifetime: number;
}

export interface ActiveProjectile {
  id: string;
  type: 'HOMING_ORB' | 'ROCKET';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Group;
  ownerId: string;
  targetPosition?: THREE.Vector3;
  targetRacerId?: string;
  lifetime: number;
}

export class ItemBoxManager {
  public scene: THREE.Scene;
  public itemBoxes: ItemBox[] = [];
  public hazards: ActiveHazard[] = [];
  public projectiles: ActiveProjectile[] = [];
  public container: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.container = new THREE.Group();
    this.scene.add(this.container);
  }

  // Populate item clusters across the track curve
  public populateTrack(curve: THREE.CatmullRomCurve3, clusterIndices: number[], roadWidth: number): void {
    // Clear existing
    this.clear();

    const up = new THREE.Vector3(0, 1, 0);

    for (const clusterIdx of clusterIndices) {
      // Calculate normalized curve t from index
      const t = clusterIdx / curve.points.length;
      const center = curve.getPoint(t);
      const tangent = curve.getTangent(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Place 3 item boxes across the road width (-roadWidth/3, 0, roadWidth/3)
      const offsets = [-roadWidth * 0.3, 0, roadWidth * 0.3];

      for (const off of offsets) {
        const pos = center.clone().addScaledVector(binormal, off);
        pos.y += 1.4; // Hover above road
        this.createItemBox(pos);
      }
    }
  }

  private createItemBox(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Outer translucent iridescent cube
    const outerGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0099ff,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      metalness: 0.8
    });
    const outerCube = new THREE.Mesh(outerGeo, outerMat);

    // Inner glowing question mark / crystalline octahedron
    const innerGeo = new THREE.OctahedronGeometry(0.7);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      wireframe: false
    });
    const innerGem = new THREE.Mesh(innerGeo, innerMat);

    group.add(outerCube);
    group.add(innerGem);

    this.container.add(group);

    this.itemBoxes.push({
      group,
      outerCube,
      innerGem,
      position: pos.clone(),
      active: true,
      respawnTimer: 0
    });
  }

  public update(
    delta: number,
    kartPositions: { id: string; position: THREE.Vector3; onHit?: () => void; isLocalPlayer?: boolean; canCollect?: boolean; rank?: number; onCollect?: (item: PowerUpType) => void }[]
  ): { collectedByLocal: PowerUpType | null; localHitHazard: boolean } {
    let collectedByLocal: PowerUpType | null = null;
    let localHitHazard = false;

    const time = performance.now() * 0.003;

    // 1. Update and animate Item Boxes
    for (const box of this.itemBoxes) {
      if (box.active) {
        // Floating bob and rotation
        box.group.position.y = box.position.y + Math.sin(time + box.position.x) * 0.25;
        box.outerCube.rotation.x += delta * 1.5;
        box.outerCube.rotation.y += delta * 2.0;
        box.innerGem.rotation.y -= delta * 3.0;

        // Check pickup collisions with all karts
        for (const kart of kartPositions) {
          if (kart.canCollect === false) continue;
          const distSq = box.position.distanceToSquared(kart.position);
          if (distSq < 3.8 * 3.8) {
            // Picked up!
            box.active = false;
            box.respawnTimer = 6.0; // 6 second respawn
            box.group.visible = false;

            const item = ItemManager.getRandomItem(kart.rank ?? 3, kartPositions.length);
            kart.onCollect?.(item);
            if (kart.isLocalPlayer) {
              audio.playItemCollect();
              collectedByLocal = item;
            }
            break;
          }
        }
      } else {
        // Respawn countdown
        box.respawnTimer -= delta;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.group.visible = true;
          box.group.scale.set(0.01, 0.01, 0.01);
        }
      }

      // Smooth scale up when respawned
      if (box.active && box.group.scale.x < 1.0) {
        const nextScale = Math.min(1.0, box.group.scale.x + delta * 3);
        box.group.scale.set(nextScale, nextScale, nextScale);
      }
    }

    // 2. Update Hazards (Oil traps)
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i];
      hazard.lifetime -= delta;

      // Check collision with karts
      for (const kart of kartPositions) {
        if (kart.id === hazard.ownerId && hazard.lifetime > 9.5) {
          // Grace period for the dropper
          continue;
        }

        const distSq = hazard.position.distanceToSquared(kart.position);
        if (distSq < 2.5 * 2.5) {
          audio.playSpinout();
          if (kart.onHit) kart.onHit();
          if (kart.isLocalPlayer) localHitHazard = true;

          // Remove consumed oil slick
          disposeObjects(hazard.mesh);
          this.container.remove(hazard.mesh);
          this.hazards.splice(i, 1);
          break;
        }
      }

      // Expire old hazards
      if (hazard.lifetime <= 0 && this.hazards[i] === hazard) {
        disposeObjects(hazard.mesh);
          this.container.remove(hazard.mesh);
        this.hazards.splice(i, 1);
      }
    }

    // 3. Update Projectiles (Homing orbs, Rockets)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.lifetime -= delta;

      if (proj.type === 'HOMING_ORB' && proj.targetPosition) {
        // Steer towards target position
        const toTarget = proj.targetPosition.clone().sub(proj.position).normalize();
        proj.velocity.lerp(toTarget.multiplyScalar(45), delta * 4);
      }

      proj.position.addScaledVector(proj.velocity, delta);
      proj.mesh.position.copy(proj.position);
      proj.mesh.rotation.y += delta * 10;

      // Check collision with targets
      for (const kart of kartPositions) {
        if (kart.id === proj.ownerId && proj.lifetime > 4.5) continue;

        const distSq = proj.position.distanceToSquared(kart.position);
        if (distSq < 3.2 * 3.2) {
          audio.playCollision();
          audio.playSpinout();
          if (kart.onHit) kart.onHit();
          if (kart.isLocalPlayer) localHitHazard = true;

          // Destroy projectile on impact
          disposeObjects(proj.mesh);
          this.container.remove(proj.mesh);
          this.projectiles.splice(i, 1);
          break;
        }
      }

      if (proj.lifetime <= 0 && this.projectiles[i] === proj) {
        disposeObjects(proj.mesh);
          this.container.remove(proj.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    return { collectedByLocal, localHitHazard };
  }

  // Deploy an Oil Slick behind a kart
  public spawnOilTrap(position: THREE.Vector3, direction: THREE.Vector3, ownerId: string): void {
    const dropPos = position.clone().addScaledVector(direction, -3.0);
    dropPos.y = position.y - .14;

    const geo = new THREE.CircleGeometry(2.0, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x1a0933,
      emissiveIntensity: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(dropPos);

    this.container.add(mesh);
    this.hazards.push({
      id: Math.random().toString(36).substring(2, 9),
      type: 'OIL_TRAP',
      position: dropPos,
      mesh,
      ownerId,
      lifetime: 15.0 // lasts 15 seconds
    });
  }

  // Launch a Homing Orb or Rocket
  public spawnProjectile(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    type: 'HOMING_ORB' | 'ROCKET',
    ownerId: string,
    targetPosition?: THREE.Vector3
  ): void {
    const launchPos = position.clone().addScaledVector(direction, 3.0);
    launchPos.y += 0.8;

    const group = new THREE.Group();
    group.position.copy(launchPos);

    if (type === 'HOMING_ORB') {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0xaf52de,
          emissive: 0x9400d3,
          emissiveIntensity: 1.2
        })
      );
      group.add(orb);
    } else {
      const rocket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.4, 1.8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xff3b30,
          emissive: 0xff0000,
          emissiveIntensity: 0.8
        })
      );
      rocket.rotation.x = Math.PI / 2;
      group.add(rocket);
    }

    this.container.add(group);

    const speed = type === 'HOMING_ORB' ? 42 : 55;
    const velocity = direction.clone().multiplyScalar(speed);

    this.projectiles.push({
      id: Math.random().toString(36).substring(2, 9),
      type,
      position: launchPos,
      velocity,
      mesh: group,
      ownerId,
      targetPosition,
      lifetime: 5.0
    });
  }

  public clear(): void {
    disposeObjects(this.container);
    while (this.container.children.length > 0) {
      this.container.remove(this.container.children[0]);
    }
    this.itemBoxes = [];
    this.hazards = [];
    this.projectiles = [];
  }
}

