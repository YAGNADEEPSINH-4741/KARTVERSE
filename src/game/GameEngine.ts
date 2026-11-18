// ============================================================================
// KARTVERSE — Master 3D Game Engine (Showroom Stage & Live Race Simulator)
// Butter-smooth 60fps tracking, zero camera wobble, zero screen tearing
// ============================================================================

import * as THREE from 'three';
import { TrackManager } from '../tracks/TrackManager';
import { KartPhysics } from '../vehicles/KartPhysics';
import { KartVisual, KartModelFactory } from '../vehicles/KartModels';
import { ItemBoxManager } from '../items/ItemBoxManager';
import { RacingPath } from '../ai/RacingPath';
import { AIRacer, AI_ROSTER } from '../ai/AIController';
import { LapManager } from '../racing/LapManager';
import { PositionManager } from '../racing/PositionManager';
import { RaceManager } from '../racing/RaceManager';
import { audio } from '../audio/AudioManager';
import { useGameStore } from '../store/gameStore';
import { socketManager } from '../multiplayer/SocketManager';
import { NetworkSync } from '../multiplayer/NetworkSync';
import { PowerUpType } from '../items/PowerUpSystem';
import { touchControls } from '../input/TouchControls';

export class GameEngine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  // Mode: 'SHOWROOM' (Menu, Garage, Lobby) or 'RACING'
  public mode: 'SHOWROOM' | 'RACING' = 'SHOWROOM';

  // Subsystems
  public trackManager!: TrackManager;
  public itemBoxManager!: ItemBoxManager;
  public lapManager!: LapManager;
  public positionManager!: PositionManager;
  public raceManager!: RaceManager;
  public networkSync!: NetworkSync;

  // Local Player Kart
  public localKartPhysics!: KartPhysics;
  public localKartVisual!: KartVisual;

  // Showroom Stage elements
  private showroomGroup = new THREE.Group();
  private showroomTurntable!: THREE.Mesh;
  private showroomParticles!: THREE.Points;
  private showroomOrbitAngle = 0;

  // Race Lighting Group
  private raceLightsGroup = new THREE.Group();

  // AI Opponents
  public aiRacers: AIRacer[] = [];

  // Input states
  private keys: Record<string, boolean> = {};

  // Camera & Chase State (Smooth follow)
  private cameraPos = new THREE.Vector3(0, 4, 8);
  private cameraLookTarget = new THREE.Vector3();
  private isCameraInitialized = false;

  // Animation Frame
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private isDestroyed = false;

  // Telemetry send throttle (multiplayer 20Hz)
  private telemetrySendTimer = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Prevent duplicate canvas instances
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // 2. Setup Three.js Scene & Renderer
    this.scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Near plane 0.2 prevents any road geometry from slicing into camera
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 1000);
    this.camera.position.set(0, 3, 7);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Explicit absolute positioning prevents layout overflow / splitting
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0';
    this.renderer.domElement.style.left = '0';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    container.appendChild(this.renderer.domElement);

    // 3. Setup Subsystems
    this.networkSync = new NetworkSync(this.scene);
    this.itemBoxManager = new ItemBoxManager(this.scene);

    // 4. Register Event Listeners
    this.bindInputs();
    window.addEventListener('resize', this.onResize);

    // 5. Build Showroom Stage as initial view
    this.initShowroomSession();

    // 6. Start Render Loop
    this.lastTime = performance.now();
    this.animate();
  }

  // --------------------------------------------------------------------------
  // SHOWROOM MODE (Menu, Garage, Lobby)
  // --------------------------------------------------------------------------
  public initShowroomSession(): void {
    this.mode = 'SHOWROOM';
    this.isCameraInitialized = false;

    // Clear race lights and track
    this.scene.remove(this.raceLightsGroup);
    this.clearRaceEntities();

    while (this.showroomGroup.children.length > 0) {
      this.showroomGroup.remove(this.showroomGroup.children[0]);
    }
    this.scene.add(this.showroomGroup);

    this.scene.fog = new THREE.FogExp2(0x060814, 0.025);
    this.scene.background = new THREE.Color(0x060814);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0x334466, 1.4);
    this.showroomGroup.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xffffff, 80);
    mainSpot.position.set(0, 10, 3);
    mainSpot.angle = Math.PI / 4;
    mainSpot.penumbra = 0.6;
    mainSpot.castShadow = true;
    this.showroomGroup.add(mainSpot);

    const rimLeft = new THREE.DirectionalLight(0x00f0ff, 3.5);
    rimLeft.position.set(-6, 4, -4);
    this.showroomGroup.add(rimLeft);

    const rimRight = new THREE.DirectionalLight(0xff007f, 3.5);
    rimRight.position.set(6, 4, -4);
    this.showroomGroup.add(rimRight);

    // Turntable Floor
    const floorGeo = new THREE.CircleGeometry(4.5, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c0f1d,
      roughness: 0.15,
      metalness: 0.9
    });
    this.showroomTurntable = new THREE.Mesh(floorGeo, floorMat);
    this.showroomTurntable.rotation.x = -Math.PI / 2;
    this.showroomTurntable.position.y = 0;
    this.showroomTurntable.receiveShadow = true;
    this.showroomGroup.add(this.showroomTurntable);

    // Glowing Neon Edge Ring
    const ringGeo = new THREE.RingGeometry(4.45, 4.55, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.showroomGroup.add(ring);

    // Outer Room Floor
    const outerFloorGeo = new THREE.PlaneGeometry(80, 80);
    const outerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x04060c,
      roughness: 0.5,
      metalness: 0.6
    });
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.05;
    this.showroomGroup.add(outerFloor);

    // Cyber Dust Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 16;
      positions[i + 1] = Math.random() * 5 + 0.2;
      positions[i + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.08,
      transparent: true,
      opacity: 0.7
    });
    this.showroomParticles = new THREE.Points(particleGeo, particleMat);
    this.showroomGroup.add(this.showroomParticles);

    // Mount Current Selected Kart on Turntable
    this.updateShowroomKart();
  }

  public updateShowroomKart(): void {
    const store = useGameStore.getState();
    if (this.localKartVisual) {
      this.showroomGroup.remove(this.localKartVisual.group);
    }

    this.localKartVisual = KartModelFactory.createKart(store.selectedKart, store.kartColor);
    this.localKartVisual.group.position.set(0, 0, 0);
    this.showroomGroup.add(this.localKartVisual.group);
  }

  // --------------------------------------------------------------------------
  // LIVE RACING MODE
  // --------------------------------------------------------------------------
  public initRaceSession(): void {
    this.mode = 'RACING';
    this.isCameraInitialized = false;

    // Remove Showroom Group
    this.scene.remove(this.showroomGroup);

    const store = useGameStore.getState();
    const trackId = store.selectedTrack;
    const kartId = store.selectedKart;
    const kartColor = store.kartColor;
    const isMultiplayer = store.raceMode === 'MULTIPLAYER';

    this.clearRaceEntities();

    // 1. Build 3D Track
    this.trackManager = new TrackManager(this.scene, trackId);
    this.scene.fog = new THREE.FogExp2(0xf59e0b, 0.0007); // Soft golden sunset horizon haze
    this.scene.background = null; // Let the 3D Sunset Sky Dome render!

    // 2. Set Up Dedicated Race Lighting
    while (this.raceLightsGroup.children.length > 0) {
      this.raceLightsGroup.remove(this.raceLightsGroup.children[0]);
    }
    this.scene.add(this.raceLightsGroup);

    // Warm Sunset Ambient Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(
      0xffedd5, // Golden sunset sky bounce
      0x0284c7, // Turquoise ocean reflection bounce
      1.8       // Rich ambient illumination
    );
    this.raceLightsGroup.add(hemiLight);

    // Ambient Sun Fill Light
    const ambientFill = new THREE.AmbientLight(0xffedd5, 1.4);
    this.raceLightsGroup.add(ambientFill);

    // Directional Sunset Sunlight
    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.5);
    sunLight.position.copy(this.trackManager.config.sunPosition);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 800;
    sunLight.shadow.camera.left = -160;
    sunLight.shadow.camera.right = 160;
    sunLight.shadow.camera.top = 160;
    sunLight.shadow.camera.bottom = -160;
    this.raceLightsGroup.add(sunLight);

    // Camera-Mounted Kart Follow Key Light (Ensures kart body, spoiler & driver are brilliantly lit)
    const camKeyLight = new THREE.DirectionalLight(0xfff8f0, 2.8);
    camKeyLight.position.set(0, 2.0, 3.0);
    this.camera.add(camKeyLight);
    this.scene.add(this.camera);

    // Populate Item Box clusters
    this.itemBoxManager.populateTrack(
      this.trackManager.curve,
      this.trackManager.config.itemBoxClusters,
      this.trackManager.config.roadWidth
    );

    // 3. Setup Lap & Position Managers
    this.lapManager = new LapManager(this.trackManager.checkpoints, this.trackManager.config.laps);
    this.positionManager = new PositionManager(this.lapManager, this.trackManager.checkpoints, this.trackManager.curve);
    this.raceManager = new RaceManager(this.lapManager, this.positionManager);

    // 4. Starting Grid Setup
    const grid = this.trackManager.getStartingGrid();

    // Local Player (Pole Position Slot 0)
    const localStart = grid[0];
    this.localKartPhysics = new KartPhysics();
    this.localKartPhysics.position.copy(localStart.position);
    this.localKartPhysics.rotationY = localStart.rotationY;
    this.localKartPhysics.roadElevation = this.trackManager.getRoadHeightAt(localStart.position);
    this.localKartPhysics.position.y = this.localKartPhysics.roadElevation + 0.25;

    this.localKartVisual = KartModelFactory.createKart(kartId, kartColor);
    this.scene.add(this.localKartVisual.group);

    // Position camera right behind starting kart immediately
    const dist = 7.0;
    this.cameraPos.set(
      localStart.position.x - Math.sin(localStart.rotationY) * dist,
      localStart.position.y + 2.8,
      localStart.position.z - Math.cos(localStart.rotationY) * dist
    );
    this.camera.position.copy(this.cameraPos);
    this.cameraLookTarget.set(
      localStart.position.x + Math.sin(localStart.rotationY) * 5.0,
      localStart.position.y + 0.9,
      localStart.position.z + Math.cos(localStart.rotationY) * 5.0
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.cameraLookTarget);
    this.isCameraInitialized = true;

    const localPlayerId = 'local_player';
    this.lapManager.registerRacer(localPlayerId, store.profile.username || 'You');

    // 5. Populate Grid: Opponents (AI and/or Remote Players)
    if (!isMultiplayer) {
      const racingPath = new RacingPath(this.trackManager.curve, this.trackManager.config.roadWidth);

      for (let i = 1; i < 8; i++) {
        const slot = grid[i];
        const profile = AI_ROSTER[i - 1];
        const ai = new AIRacer(
          this.scene,
          profile,
          racingPath,
          store.aiDifficulty,
          slot.position,
          slot.rotationY
        );
        ai.physics.roadElevation = this.trackManager.getRoadHeightAt(slot.position);
        ai.physics.position.y = ai.physics.roadElevation + 0.25;

        this.lapManager.registerRacer(ai.profile.id, ai.profile.name);
        this.aiRacers.push(ai);
      }
    } else {
      // Register all other multiplayer participants from room
      const localId = socketManager.getLocalPlayerId();
      const remoteRoomPlayers = store.roomPlayers.filter(p => p.id !== localId);

      remoteRoomPlayers.forEach((player, idx) => {
        const slot = grid[idx + 1] || grid[1];
        const entity = this.networkSync.registerRemotePlayer(
          player.id,
          player.kartId || 'velocity_gt',
          player.kartColor || '#00f0ff',
          player.username,
          player.isHost
        );
        entity.currentPosition.copy(slot.position);
        entity.targetPosition.copy(slot.position);
        entity.currentRotationY = slot.rotationY;
        entity.targetRotationY = slot.rotationY;
        entity.visual.group.position.copy(slot.position);
        entity.visual.group.rotation.y = slot.rotationY;

        this.lapManager.registerRacer(player.id, player.username || `Racer ${idx + 2}`);
      });

      socketManager.onRemoteTelemetry = (packet) => {
        this.networkSync.handleTelemetry(packet);
      };

      socketManager.onRemoteItemUse = (data) => {
        const pos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z);
        if (data.itemType === 'OIL_TRAP') {
          this.itemBoxManager.spawnOilTrap(pos, dir, data.playerId);
        } else if (data.itemType === 'HOMING_ORB' || data.itemType === 'ROCKET_BOOST') {
          this.itemBoxManager.spawnProjectile(pos, dir, data.itemType === 'HOMING_ORB' ? 'HOMING_ORB' : 'ROCKET', data.playerId);
        }
      };
    }

    // 6. Start Countdown
    this.raceManager.startCountdown();
  }

  private clearRaceEntities(): void {
    while (this.camera.children.length > 0) {
      this.camera.remove(this.camera.children[0]);
    }
    if (this.trackManager) {
      this.scene.remove(this.trackManager.trackGroup);
    }
    if (this.localKartVisual) {
      this.scene.remove(this.localKartVisual.group);
    }
    this.aiRacers.forEach(ai => ai.dispose(this.scene));
    this.aiRacers = [];
    this.networkSync.clear();
    this.itemBoxManager.clear();
  }

  private bindInputs(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (this.mode === 'RACING') {
        if (e.code === 'Space' || e.code === 'KeyE') {
          this.useHeldPowerUp();
        }
        if (e.code === 'KeyR') {
          this.resetKartToNearestTrackPoint();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private useHeldPowerUp(): void {
    const store = useGameStore.getState();
    const item = store.telemetry.currentItem as PowerUpType | null;
    if (!item) return;

    const fwd = new THREE.Vector3(
      Math.sin(this.localKartPhysics.rotationY),
      0,
      Math.cos(this.localKartPhysics.rotationY)
    );

    store.setTelemetry({ currentItem: null });

    if (item === 'ROCKET_BOOST' || item === 'TURBO_CHARGE') {
      audio.playBoost();
      this.localKartPhysics.boost.trigger('NITRO', 1.6, 2.5);
    } else if (item === 'SHIELD') {
      audio.playItemCollect();
      this.localKartPhysics.boost.trigger('PAD', 1.1, 8.0);
    } else if (item === 'OIL_TRAP') {
      audio.playItemCollect();
      this.itemBoxManager.spawnOilTrap(this.localKartPhysics.position, fwd, 'local_player');
      if (store.raceMode === 'MULTIPLAYER') {
        socketManager.sendItemUse('OIL_TRAP', this.localKartPhysics.position, fwd);
      }
    } else if (item === 'HOMING_ORB') {
      audio.playItemCollect();
      const leadPos = this.aiRacers.length > 0 ? this.aiRacers[0].physics.position : undefined;
      this.itemBoxManager.spawnProjectile(this.localKartPhysics.position, fwd, 'HOMING_ORB', 'local_player', leadPos);
      if (store.raceMode === 'MULTIPLAYER') {
        socketManager.sendItemUse('HOMING_ORB', this.localKartPhysics.position, fwd);
      }
    } else if (item === 'LIGHTNING_PULSE') {
      audio.playSpinout();
      this.aiRacers.forEach(ai => ai.hitByHazard());
    } else if (item === 'SPEED_MAGNET') {
      audio.playBoost();
      this.localKartPhysics.boost.trigger('MINI_TURBO', 1.8, 3.0);
    } else {
      this.localKartPhysics.boost.trigger('NITRO', 1.4, 2.0);
    }
  }

  private resetKartToNearestTrackPoint(): void {
    const t = 0.05;
    const pt = this.trackManager.curve.getPointAt(t);
    this.localKartPhysics.position.copy(pt).add(new THREE.Vector3(0, 0.4, 0));
    this.localKartPhysics.velocity.set(0, 0, 0);
    this.localKartPhysics.speed = 0;
  }

  private animate = (): void => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.05); // Cap delta to prevent large time step jumps
    this.lastTime = now;

    if (this.mode === 'SHOWROOM') {
      this.updateShowroom(delta);
    } else {
      this.updateRace(delta);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateShowroom(delta: number): void {
    // Gentle camera orbit around the kart
    this.showroomOrbitAngle += delta * 0.35;
    const dist = 5.2;
    const height = 1.9;

    this.camera.position.x = Math.sin(this.showroomOrbitAngle) * dist;
    this.camera.position.z = Math.cos(this.showroomOrbitAngle) * dist;
    this.camera.position.y = height;
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0.5, 0);

    // Gently rotate kart
    if (this.localKartVisual) {
      this.localKartVisual.group.rotation.y += delta * 0.45;
    }

    // Slowly drift particles
    if (this.showroomParticles) {
      this.showroomParticles.rotation.y += delta * 0.05;
    }
  }

  private updateRace(delta: number): void {
    const store = useGameStore.getState();

    // 1. Read Inputs (Keyboard & On-Screen Mobile/Tablet Touch Controls)
    const steerLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || touchControls.steerLeft;
    const steerRight = this.keys['ArrowRight'] || this.keys['KeyD'] || touchControls.steerRight;
    const steer = (steerRight ? 1.0 : 0.0) - (steerLeft ? 1.0 : 0.0);

    const wantsAccel = this.keys['ArrowUp'] || this.keys['KeyW'] || touchControls.accelerate;
    const wantsBrake = touchControls.brake;
    const wantsReverse = this.keys['ArrowDown'] || this.keys['KeyS'] || touchControls.reverse;

    let throttle = 0.0;
    if (wantsAccel) {
      throttle = 1.0;
    } else if (wantsReverse) {
      throttle = -0.8;
    } else if (wantsBrake) {
      throttle = -0.6;
    }

    const wantsDrift = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight'] || touchControls.drift);
    const wantsNitro = !!(this.keys['KeyN'] || this.keys['KeyF'] || touchControls.nitro);

    if (touchControls.useItem) {
      touchControls.useItem = false;
      this.useHeldPowerUp();
    }

    // 2. Road Surface Elevation Clamping (Prevents ground clipping & screen slicing)
    const roadY = this.trackManager.getRoadHeightAt(this.localKartPhysics.position);
    this.localKartPhysics.roadElevation = roadY;

    // 3. Gather All Racer Positions & Forward Headings
    const forward = new THREE.Vector3(
      Math.sin(this.localKartPhysics.rotationY),
      0,
      Math.cos(this.localKartPhysics.rotationY)
    );

    const racerPositions: { id: string; position: THREE.Vector3; forward: THREE.Vector3 }[] = [
      { id: 'local_player', position: this.localKartPhysics.position, forward }
    ];

    for (const ai of this.aiRacers) {
      ai.physics.roadElevation = this.trackManager.getRoadHeightAt(ai.physics.position);
      const aiFwd = new THREE.Vector3(
        Math.sin(ai.physics.rotationY),
        0,
        Math.cos(ai.physics.rotationY)
      );
      racerPositions.push({ id: ai.profile.id, position: ai.physics.position, forward: aiFwd });
    }

    for (const [id, remote] of this.networkSync.remotePlayers.entries()) {
      const remoteFwd = new THREE.Vector3(
        Math.sin(remote.currentRotationY || 0),
        0,
        Math.cos(remote.currentRotationY || 0)
      );
      racerPositions.push({ id, position: remote.currentPosition, forward: remoteFwd });
    }

    // 4. Update Race Coordinator
    const raceControl = this.raceManager.update(delta, racerPositions, 'local_player', forward);

    // 5. Local Kart Physics Update & Track Boundary Enforcement
    const activeThrottle = raceControl.canDrive ? throttle : 0;
    const isBrakeOnly = wantsBrake && !wantsReverse;
    this.localKartPhysics.update(delta, activeThrottle, steer, wantsDrift, wantsNitro, this.localKartVisual, isBrakeOnly);

    // Car must stay strictly inside the track boundaries at all times
    const constraint = this.trackManager.getTrackConstraint(this.localKartPhysics.position);
    this.localKartPhysics.applyTrackConstraint(constraint, delta, this.localKartVisual);

    // 6. Boost Pad Collisions
    for (const pad of this.trackManager.boostPads) {
      if (this.localKartPhysics.position.distanceToSquared(pad.position) < 4.0 * 4.0) {
        audio.playBoost();
        this.localKartPhysics.boost.trigger('PAD', 1.5, 1.8);
      }
    }

    // 6.1 Update Animated Track Environment (Clouds, Lighthouse Beacon, Collectible Coins)
    this.trackManager.update(delta, this.localKartPhysics.position);

    // 7. Update AI Racers
    for (const ai of this.aiRacers) {
      if (raceControl.canDrive) {
        const signedDist = this.localKartPhysics.position.z - ai.physics.position.z;
        ai.update(delta, this.localKartPhysics.position, signedDist, (itemType, pos, dir) => {
          if (itemType === 'OIL_TRAP') {
            this.itemBoxManager.spawnOilTrap(pos, dir, ai.profile.id);
          } else if (itemType === 'HOMING_ORB') {
            this.itemBoxManager.spawnProjectile(pos, dir, 'HOMING_ORB', ai.profile.id, this.localKartPhysics.position);
          }
        });

        const aiConstraint = this.trackManager.getTrackConstraint(ai.physics.position);
        ai.physics.applyTrackConstraint(aiConstraint, delta);
      }
    }

    // 8. Update Multiplayer Interpolation
    if (store.raceMode === 'MULTIPLAYER') {
      this.networkSync.update(delta);

      this.telemetrySendTimer += delta;
      if (this.telemetrySendTimer >= 0.033) {
        this.telemetrySendTimer = 0;
        socketManager.sendTelemetry({
          position: {
            x: this.localKartPhysics.position.x,
            y: this.localKartPhysics.position.y,
            z: this.localKartPhysics.position.z
          },
          rotationY: this.localKartPhysics.rotationY,
          speed: this.localKartPhysics.speed,
          driftLevel: this.localKartPhysics.drift.getLevel(),
          pitch: this.localKartPhysics.pitch,
          roll: this.localKartPhysics.roll
        });
      }
    }

    // 9. Update Item Boxes, Hazards & Pickups
    const hitCheckTargets = [
      {
        id: 'local_player',
        position: this.localKartPhysics.position,
        onHit: () => {
          this.localKartPhysics.triggerSpinout();
        },
        isLocalPlayer: true
      },
      ...this.aiRacers.map(ai => ({
        id: ai.profile.id,
        position: ai.physics.position,
        onHit: () => ai.hitByHazard(),
        isLocalPlayer: false
      }))
    ];

    const itemResult = this.itemBoxManager.update(delta, hitCheckTargets);
    if (itemResult.collectedByLocal) {
      store.setTelemetry({ currentItem: itemResult.collectedByLocal });
    }

    // 10. Audio Engine RPM Pitch
    audio.setEngineSpeed(this.localKartPhysics.speed, this.localKartPhysics.specs.topSpeed);

    // 11. Update HUD Speedometer & Minimap Coordinates
    const mapRacers = racerPositions.map(r => ({
      id: r.id,
      name: this.lapManager.getProgress(r.id)?.name || (r.id === 'local_player' ? (store.profile.username || 'You') : 'Racer'),
      x: r.position.x,
      z: r.position.z,
      isPlayer: r.id === 'local_player'
    }));

    const speedMagnitude = Math.round(Math.abs(this.localKartPhysics.speed * 3.6));
    const isReversing = this.localKartPhysics.isReversing && this.localKartPhysics.speed < -0.1;
    const isNitroActive = this.localKartPhysics.boost.isNitroActive;
    const miniTurboNotification = this.localKartPhysics.latestBoostName;
    if (miniTurboNotification) {
      this.localKartPhysics.latestBoostName = null;
    }

    store.setTelemetry({
      speedKmh: speedMagnitude,
      isReversing,
      isNitroActive,
      miniTurboNotification,
      nitroPercent: Math.round(this.localKartPhysics.boost.getNitroPercent()),
      driftLevel: this.localKartPhysics.drift.getLevel(),
      racerPositions: mapRacers
    });

    // 12. Rock-Solid Third-Person Chase Camera (Zero shake, zero Euler wobble)
    this.updateCamera(delta);
  }

  private updateCamera(delta: number): void {
    const kartPos = this.localKartPhysics.position;
    const kartRotY = this.localKartPhysics.rotationY;
    const speed = this.localKartPhysics.speed;

    // Follow distance expands slightly with speed
    const distance = 6.8 + Math.min(2.0, (speed / 35.0) * 1.5);
    const height = 2.8;

    // Ideal camera position behind the kart
    const targetCamX = kartPos.x - Math.sin(kartRotY) * distance;
    const targetCamZ = kartPos.z - Math.cos(kartRotY) * distance;
    const roadY = this.localKartPhysics.roadElevation || 0;
    const targetCamY = Math.max(roadY + 1.8, kartPos.y + height);

    const targetPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);

    if (!this.isCameraInitialized) {
      this.cameraPos.copy(targetPos);
      this.isCameraInitialized = true;
    } else {
      // Smooth position lerp
      this.cameraPos.lerp(targetPos, Math.min(1.0, delta * 10.0));
    }
    this.camera.position.copy(this.cameraPos);

    // Dynamic Look Target ahead of kart hood
    const lookAheadDist = 5.0;
    const targetLook = new THREE.Vector3(
      kartPos.x + Math.sin(kartRotY) * lookAheadDist,
      kartPos.y + 0.9,
      kartPos.z + Math.cos(kartRotY) * lookAheadDist
    );

    this.cameraLookTarget.lerp(targetLook, Math.min(1.0, delta * 14.0));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.cameraLookTarget);

    // Dynamic FOV Warp (Only update projection matrix when delta > 0.1)
    const nitroFovKick = this.localKartPhysics.boost.isNitroActive ? 8.0 : 0.0;
    const targetFov = 62.0 + Math.min(14.0, (speed / 35.0) * 12.0) + nitroFovKick;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, delta * 6.0);
      this.camera.updateProjectionMatrix();
    }
  }

  private onResize = (): void => {
    if (!this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    audio.stopEngine();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
