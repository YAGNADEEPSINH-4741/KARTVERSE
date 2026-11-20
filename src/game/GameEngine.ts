// ============================================================================
// KARTVERSE — Master 3D Game Engine (Showroom Stage & Live Race Simulator)
// Butter-smooth 60fps tracking, zero camera wobble, zero screen tearing
// ============================================================================

import * as THREE from 'three';
import { disposeObjects } from './disposeObjects';
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
import { touchControls, resetTouchControls } from '../input/TouchControls';

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
  private raceSun?: THREE.DirectionalLight;
  private sunOffset = new THREE.Vector3();

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
  private lastPad: THREE.Mesh | null = null;
  private inputs = new AbortController();
  private remoteProgress = new Set<string>();

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

    const quality = useGameStore.getState().graphicsQuality;
    const mobile = window.matchMedia('(pointer: coarse)').matches;
    const pixelLimit = {low: 1, medium: 1.25, high: 1.6, ultra: 2}[quality];
    this.renderer = new THREE.WebGLRenderer({
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelLimit, mobile ? 1.35 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = quality !== 'low' && (!mobile || quality === 'ultra');
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
    window.addEventListener('resize', this.onResize, {signal: this.inputs.signal});
    window.addEventListener('blur', () => {this.keys = {}; resetTouchControls();}, {signal: this.inputs.signal});

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

    disposeObjects(this.showroomGroup);
    this.showroomGroup.clear();
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

    const rimLeft = new THREE.DirectionalLight(0x76c4dc, 2.5);
    rimLeft.position.set(-6, 4, -4);
    this.showroomGroup.add(rimLeft);

    const rimRight = new THREE.DirectionalLight(0xff905f, 3.5);
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
    if (this.localKartVisual?.group.parent === this.showroomGroup) {
      disposeObjects(this.localKartVisual.group);
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
    console.log(`[INIT_RACE_SESSION] isMultiplayer=${isMultiplayer}, raceMode=${store.raceMode}, currentScreen=${store.currentScreen}`);

    this.clearRaceEntities();

    // 1. Build 3D Track
    this.trackManager = new TrackManager(this.scene, trackId);
    this.scene.fog = new THREE.FogExp2(this.trackManager.config.horizonColor, 0.00155); // Soft golden sunset horizon haze
    this.scene.background = null; // Let the 3D Sunset Sky Dome render!

    // 2. Set Up Dedicated Race Lighting
    disposeObjects(this.raceLightsGroup);
    this.raceLightsGroup.clear();
    this.scene.add(this.raceLightsGroup);

    // Warm Sunset Ambient Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(
      0xffe5cf, // Golden sunset sky bounce
      0x7b9baa, // Cool water bounce
      1.55      // Open-sky illumination
    );
    this.raceLightsGroup.add(hemiLight);

    // Ambient Sun Fill Light
    const ambientFill = new THREE.AmbientLight(0xf5e2cf, .46);
    this.raceLightsGroup.add(ambientFill);

    // Directional Sunset Sunlight
    const sunLight = new THREE.DirectionalLight(0xffd0a3, 2.05);
    sunLight.position.copy(this.trackManager.config.sunPosition);
    sunLight.castShadow = true;
    sunLight.shadow.bias = -0.0004;
    const mapSize = store.graphicsQuality === 'ultra' ? 2048 : 1024;
    sunLight.shadow.mapSize.set(mapSize, mapSize);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 240;
    sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -43;
    sunLight.shadow.camera.right = sunLight.shadow.camera.top = 43;
    sunLight.shadow.normalBias = .035;
    this.sunOffset.copy(sunLight.position).normalize().multiplyScalar(120);
    this.raceSun = sunLight;
    this.raceLightsGroup.add(sunLight, sunLight.target);

    // Camera-Mounted Kart Follow Key Light (Ensures kart body, spoiler & driver are brilliantly lit)
    const camKeyLight = new THREE.DirectionalLight(0xfff8f0, .85);
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
    const gridIds = [...store.roomPlayers].sort((a,b) =>
      Number(b.isHost) - Number(a.isHost) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    ).map(player => player.id);
    const localIndex = isMultiplayer ? Math.max(0, gridIds.indexOf(socketManager.getLocalPlayerId())) : 0;
    const localStart = grid[localIndex] || grid[0];
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
    if (!isMultiplayer && store.raceMode !== 'TIME_TRIAL') {
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
    } else if (isMultiplayer) {
      // Register all other multiplayer participants from room
      const localId = socketManager.getLocalPlayerId();
      const remoteRoomPlayers = store.roomPlayers.filter(p => p.id !== localId);

      remoteRoomPlayers.forEach((player, idx) => {
        const slot = grid[gridIds.indexOf(player.id)] || grid[1];
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
        this.remoteProgress.add(player.id);
      });

      socketManager.onRemoteTelemetry = (packet) => {
        if (!this.lapManager.hasRacer(packet.playerId)) {
          const pInfo = useGameStore.getState().roomPlayers.find(p => p.id === packet.playerId);
          if (!pInfo) return;
          this.networkSync.registerRemotePlayer(pInfo.id, pInfo.kartId, pInfo.kartColor, pInfo.username, pInfo.isHost);
          this.lapManager.registerRacer(packet.playerId, pInfo.username);
          this.remoteProgress.add(packet.playerId);
        }
        this.networkSync.handleTelemetry(packet);
        const progress = this.lapManager.getProgress(packet.playerId)!;
        const sync = packet.progress;
        if (sync && Number.isInteger(sync.lap) && sync.lap >= 1 && sync.lap <= this.lapManager.totalLaps &&
            Number.isInteger(sync.checkpoint) && sync.checkpoint >= -1 && sync.checkpoint < this.lapManager.checkpoints.length &&
            Number.isFinite(sync.time) && sync.time >= 0 && Number.isFinite(sync.best) && sync.best >= 0) {
          this.remoteProgress.add(packet.playerId);
          if (!progress.isFinished) {
            progress.lap = sync.lap;
            progress.lastPassedCheckpoint = sync.checkpoint;
            progress.bestLapTime = sync.best;
            progress.totalRaceTime = sync.time;
            progress.isFinished = sync.finished && sync.time > 0;
            progress.state = progress.isFinished ? 'RACE_FINISHED' : 'RACING';
          }
        }
      };

      socketManager.onPlayerLeft = (playerId: string, reason: string) => {
        this.handleRemotePlayerDeparture(playerId, reason);
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

    store.setTelemetry({currentLap: 1, totalLaps: this.trackManager.config.laps, totalRacers: this.lapManager.progressMap.size,
      position: localIndex + 1, bestLapTime: 0, raceTime: 0, currentItem: null, speedKmh: 0, isWrongWay: false,
      driftLevel: 0, nitroPercent: 100, miniTurboNotification: null, leaderboard: [], racerPositions: []});
    this.lastPad = null;
    // 6. Start Countdown
    this.raceManager.startCountdown();
  }

  public handleRemotePlayerDeparture(playerId: string, reason: string): void {
    console.log(`[MULTIPLAYER] Handling departure for ${playerId}, reason: ${reason}`);
    // 1. Remove 3D visual & nametag from scene
    const remote = this.networkSync.remotePlayers.get(playerId);
    if (!remote) return;
    disposeObjects(remote.visual.group);
    this.networkSync.removePlayer(playerId);
    this.remoteProgress.delete(playerId);

    // 2. Remove from lap manager
    const completed = this.lapManager.getProgress(playerId)?.isFinished;
    if (!completed) this.lapManager.removeRacer(playerId);

    // 3. Filter roomPlayers in store
    const store = useGameStore.getState();
    const updated = store.roomPlayers.filter(p => p.id !== playerId);
    store.setRoomPlayers(updated);

    // 4. Standings & Auto-Win Check
    if (this.mode === 'RACING') {
      const remainingCount = 1 + this.networkSync.remotePlayers.size;

      // Auto-Win: If only 1 player remains in multiplayer race, declare victory!
      if (store.raceMode === 'MULTIPLAYER' && (this.raceManager.state === 'RACING' || this.raceManager.state === 'COUNTDOWN')) {
        const hasFinisher = Array.from(this.lapManager.progressMap.values()).some(p => p.isFinished);
        if (!hasFinisher && reason !== 'TIMEOUT' && this.networkSync.remotePlayers.size === 0) {
          console.log('[AUTO-WIN] All opponents left! Local player automatically wins 1st place 🏆');
          this.raceManager.finishRace('local_player', 1);
          return;
        }
      }

      store.setTelemetry({
        totalRacers: remainingCount
      });
    }
  }

  private clearRaceEntities(): void {
    socketManager.onRemoteTelemetry = undefined;
    socketManager.onRemoteItemUse = undefined;
    socketManager.onPlayerLeft = undefined;
    this.remoteProgress.clear();
    while (this.camera.children.length > 0) {
      this.camera.remove(this.camera.children[0]);
    }
    if (this.trackManager?.trackGroup.parent) {
      disposeObjects(this.trackManager.trackGroup);
      this.scene.remove(this.trackManager.trackGroup);
    }
    if (this.localKartVisual?.group.parent) {
      disposeObjects(this.localKartVisual.group);
      this.localKartVisual.group.removeFromParent();
    }
    this.aiRacers.forEach(ai => {disposeObjects(ai.visual.group); ai.dispose(this.scene);});
    this.aiRacers = [];
    this.networkSync.remotePlayers.forEach(player => disposeObjects(player.visual.group));
    this.networkSync.clear();
    this.itemBoxManager.clear();
  }

  private bindInputs(): void {
    window.addEventListener('keydown', (e) => {
      if (this.mode === 'RACING' && ['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;

      if (this.mode === 'RACING') {
        if (e.code === 'KeyE' && !e.repeat) {
          this.useHeldPowerUp();
        }
        if (e.code === 'KeyR') {
          this.resetKartToNearestTrackPoint();
        }
      }
    }, {signal: this.inputs.signal});

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    }, {signal: this.inputs.signal});
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
    const near = this.trackManager.getTrackConstraint(this.localKartPhysics.position);
    this.localKartPhysics.position.copy(near.nearestCenter).addScaledVector(new THREE.Vector3(0, 1, 0), .2);
    this.localKartPhysics.rotationY = Math.atan2(near.tangent.x, near.tangent.z);
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

  private publishTelemetry(delta: number, immediate = false): void {
    this.telemetrySendTimer += delta;
    const finished = this.raceManager.state === 'FINISHED';
    if (!immediate && this.telemetrySendTimer < (finished ? .25 : .085)) return;
    this.telemetrySendTimer = 0;
    const kart = this.localKartPhysics;
    const p = this.lapManager.getProgress('local_player')!;
    socketManager.sendTelemetry({
      position: {x: kart.position.x, y: kart.position.y, z: kart.position.z},
      rotationY: kart.rotationY, speed: finished ? 0 : kart.speed,
      driftLevel: kart.drift.getLevel(), pitch: kart.pitch, roll: kart.roll,
      progress: {lap: p.lap, checkpoint: p.lastPassedCheckpoint, time: p.totalRaceTime, best: p.bestLapTime, finished: p.isFinished}
    }, immediate);
  }

  private updateRace(delta: number): void {
    const store = useGameStore.getState();

    if (this.raceManager.state === 'FINISHED') {
      if (store.raceMode === 'MULTIPLAYER') this.publishTelemetry(delta);
      return;
    }
    // 1. Read Inputs (Keyboard & On-Screen Mobile/Tablet Touch Controls)
    const steerLeft = this.keys['ArrowLeft'] || this.keys['KeyA'] || touchControls.steerLeft;
    const steerRight = this.keys['ArrowRight'] || this.keys['KeyD'] || touchControls.steerRight;
    // Left input turns left (positive yaw rate), Right input turns right (negative yaw rate)
    const steer = (steerLeft ? 1.0 : 0.0) - (steerRight ? 1.0 : 0.0);

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
    const wantsNitro = !!(this.keys['Space'] || touchControls.nitro);

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
    // Keep a finish in the standings after its owner leaves the room.
    for (const [id, progress] of this.lapManager.progressMap) {
      if (id !== 'local_player' && progress.isFinished && !racerPositions.some(racer => racer.id === id)) {
        racerPositions.push({id, position: this.trackManager.checkpoints[0].center, forward});
      }
    }

    // 4. Update Race Coordinator
    const raceControl = this.raceManager.update(delta, racerPositions, 'local_player', forward, this.remoteProgress);
    if (store.raceStatus !== 'FINISHED' && useGameStore.getState().raceStatus === 'FINISHED') {
      if (store.raceMode === 'MULTIPLAYER') this.publishTelemetry(0, true);
      audio.stopEngine();
      return;
    }

    this.trackManager.setStartingLights(this.raceManager.countdownValue);

    // 5. Local Kart Physics Update & Track Boundary Enforcement
    const activeThrottle = raceControl.canDrive ? throttle : 0;
    const isBrakeOnly = wantsBrake && !wantsReverse;
    this.localKartPhysics.update(delta, activeThrottle, steer, raceControl.canDrive && wantsDrift, raceControl.canDrive && wantsNitro, this.localKartVisual, isBrakeOnly);

    // Car must stay strictly inside the track boundaries at all times
    const constraint = this.trackManager.getTrackConstraint(this.localKartPhysics.position);
    this.localKartPhysics.applyTrackConstraint(constraint, delta, this.localKartVisual);

    // 6. Boost Pad Collisions
    const pad = this.trackManager.boostPads.find(p => p.position.distanceToSquared(this.localKartPhysics.position) < 16);
    if (pad && pad.mesh !== this.lastPad && raceControl.canDrive) {
      audio.playBoost();
      this.localKartPhysics.boost.trigger('PAD', 1.5, 1.8);
    }
    this.lastPad = pad?.mesh || null;

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
        ai.physics.applyTrackConstraint(aiConstraint, delta, ai.visual);
      }
    }

    // 8. Update Multiplayer Interpolation
    if (store.raceMode === 'MULTIPLAYER') {
      this.networkSync.update(delta);

      this.publishTelemetry(delta);
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
    if (this.raceSun) {
      this.raceSun.target.position.copy(this.localKartPhysics.position);
      this.raceSun.position.copy(this.localKartPhysics.position).add(this.sunOffset);
    }
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
    this.inputs.abort();
    this.clearRaceEntities();
    disposeObjects(this.raceLightsGroup);
    disposeObjects(this.showroomGroup);
    this.scene.clear();
    audio.stopEngine();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
