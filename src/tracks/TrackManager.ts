// ============================================================================
// KARTVERSE — 3D Track Extrusion, Checkpoints, Boost Pads & Guardrails Manager
// SUNSET PARADISE AAA Tropical Island Circuit with Waterfalls, Ocean Bridge,
// Mountain Tunnel, Lighthouse, Rotating Coins, Animated Skies & Dynamic Water
// ============================================================================

import * as THREE from 'three';
import { TrackConfig, TRACKS } from './TrackData';
import { audio } from '../audio/AudioManager';
import { TrackValidator } from './TrackValidator';

export interface CheckpointGate {
  index: number;
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
}

export interface BoostPad {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

export interface TrackSample {
  index: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  binormal: THREE.Vector3;
  t: number;
}

export interface CollectibleCoin {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  collected: boolean;
}

export interface TrackConstraintResult {
  nearestCenter: THREE.Vector3;
  tangent: THREE.Vector3;
  binormal: THREE.Vector3;
  lateralOffset: number; // Signed distance from centerline (- = left, + = right)
  roadHalfWidth: number;
  roadElevation: number;
  isOnRoad: boolean;
  isOnKerb: boolean;
  isHittingBarrier: boolean;
  isOutOfBounds: boolean;
  barrierNormal: THREE.Vector3; // Points inward to track center
  clampedPosition: THREE.Vector3; // Position clamped inside boundary walls
}

export class TrackManager {
  public scene: THREE.Scene;
  public config: TrackConfig;
  public curve: THREE.CatmullRomCurve3;

  public trackGroup: THREE.Group;
  public roadMesh!: THREE.Mesh;
  public oceanMesh!: THREE.Mesh;
  public skyDome!: THREE.Mesh;
  public sunGroup!: THREE.Group;
  public lighthouseBeacon!: THREE.Mesh;

  public checkpoints: CheckpointGate[] = [];
  public boostPads: BoostPad[] = [];
  public splineSamples: TrackSample[] = [];
  public coins: CollectibleCoin[] = [];
  public clouds: THREE.Group[] = [];

  constructor(scene: THREE.Scene, trackId = 'sunset_coast') {
    this.scene = scene;
    this.config = TRACKS[trackId] || TRACKS.sunset_coast;
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    // Create closed 3D Catmull-Rom spline
    this.curve = new THREE.CatmullRomCurve3(this.config.points, true, 'centripetal');

    // Precalculate dense spline samples for collision and clamping
    this.generateSplineSamples(400);

    // Build World & Atmosphere
    this.buildSkyDome();
    this.buildOcean();
    this.buildDistantIslands();
    this.buildClouds();

    // Build Circuit Geometry
    this.buildRoadMesh();
    this.buildGuardrails();
    this.buildCheckpoints();
    this.buildBoostPads();
    this.buildCollectibleCoins();
    this.buildStartFinishGantry();
    this.buildScenery();

    // Dev-time Track Clearance Corridor Validator (roadWidth/2 + 6.0m Envelope)
    const waterfallCenter = this.curve.getPointAt(0.35);
    const wfTan = this.curve.getTangentAt(0.35).normalize();
    const wfBin = new THREE.Vector3().crossVectors(wfTan, new THREE.Vector3(0, 1, 0)).normalize();
    
    const obstaclesToValidate = [
      { name: 'Waterfall Left Cliff', position: waterfallCenter.clone().addScaledVector(wfBin, -38.0), radius: 18.2 },
      { name: 'Waterfall Right Cliff', position: waterfallCenter.clone().addScaledVector(wfBin, 38.0), radius: 18.2 },
      { name: 'Mountain Tunnel Cavern', position: this.curve.getPointAt(0.52), radius: 25.0, isTunnel: true }
    ];

    const validation = TrackValidator.validateTrackCorridor(this.curve, this.config.roadWidth, obstaclesToValidate);
    console.log(`[TRACK CLEARANCE VALIDATOR] Status: ${validation.passed ? 'PASSED (0 violations)' : 'FAILED'}, Min Margin: ${validation.minClearanceFound.toFixed(2)}m`);
  }

  private generateSplineSamples(sampleCount: number): void {
    this.splineSamples = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleCount;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      this.splineSamples.push({
        index: i,
        point,
        tangent,
        binormal,
        t
      });
    }
  }

  // --------------------------------------------------------------------------
  // 1. DYNAMIC SUNSET SKY DOME & SUN (No flat backgrounds)
  // --------------------------------------------------------------------------
  private createSkyTexture(): THREE.Texture {
    if (typeof document === 'undefined') {
      return new THREE.Texture();
    }
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    // Horizon is at equator (Y = 256, V = 0.5):
    // Above horizon (V = 0.0 to 0.5): Zenith Navy -> Velvet Purple -> Sunset Rose -> Coral -> Golden Sunburst
    grad.addColorStop(0.0, '#0a0e27');   // Zenith: Deep space twilight navy
    grad.addColorStop(0.18, '#261047');  // Upper sky: Deep cosmic violet
    grad.addColorStop(0.32, '#831843');  // Mid-upper sky: Royal fuchsia
    grad.addColorStop(0.40, '#be123c');  // Mid sky: Radiant sunset crimson
    grad.addColorStop(0.45, '#ea580c');  // Lower sky: Warm sunset amber
    grad.addColorStop(0.485, '#f59e0b'); // Near horizon: Glowing golden orange
    grad.addColorStop(0.50, '#fef08a');  // Horizon line: Brilliant sunburst yellow
    // Below horizon (V = 0.50 to 1.0): Ocean reflection to deep sea
    grad.addColorStop(0.51, '#f59e0b');  // Water horizon shimmer
    grad.addColorStop(0.55, '#0284c7');  // Tropical turquoise ocean surface
    grad.addColorStop(0.72, '#0369a1');  // Deeper ocean blue
    grad.addColorStop(1.0, '#075985');   // Abyss

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  private buildSkyDome(): void {
    const skyGeom = new THREE.SphereGeometry(950, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.createSkyTexture(),
      side: THREE.BackSide,
      fog: false
    });
    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.trackGroup.add(this.skyDome);

    // Glowing Sun Disc + Multi-tier Coronal Flare
    this.sunGroup = new THREE.Group();
    this.sunGroup.position.copy(this.config.sunPosition);

    const sunCoreGeom = new THREE.SphereGeometry(28, 24, 24);
    const sunCoreMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, fog: false });
    const sunCore = new THREE.Mesh(sunCoreGeom, sunCoreMat);
    this.sunGroup.add(sunCore);

    // Inner flare ring
    const flareGeom1 = new THREE.RingGeometry(30, 80, 32);
    const flareMat1 = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      fog: false
    });
    const flare1 = new THREE.Mesh(flareGeom1, flareMat1);
    flare1.lookAt(new THREE.Vector3(0, 40, 0));
    this.sunGroup.add(flare1);

    // Outer coronal aura
    const flareGeom2 = new THREE.RingGeometry(80, 160, 32);
    const flareMat2 = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      fog: false
    });
    const flare2 = new THREE.Mesh(flareGeom2, flareMat2);
    flare2.lookAt(new THREE.Vector3(0, 40, 0));
    this.sunGroup.add(flare2);

    this.trackGroup.add(this.sunGroup);
  }

  // --------------------------------------------------------------------------
  // 2. TURQUOISE OCEAN SURFACE WITH DYNAMIC WATER WAVES & SUNSET SPECULAR SHIMMER
  // --------------------------------------------------------------------------
  private oceanBaseVertices: Float32Array | null = null;
  private oceanTime = 0;

  private createWaterTexture(): THREE.Texture {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep turquoise base
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle gentle wave caustics
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 45; i++) {
      ctx.beginPath();
      const y = Math.random() * 512;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        128, y + (Math.random() - 0.5) * 40,
        384, y + (Math.random() - 0.5) * 40,
        512, y
      );
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    return tex;
  }

  private buildOcean(): void {
    const oceanGeom = new THREE.PlaneGeometry(3200, 3200, 72, 72);
    oceanGeom.rotateX(-Math.PI / 2);

    // Save initial vertex positions for dynamic wave undulation
    const posAttr = oceanGeom.attributes.position;
    this.oceanBaseVertices = new Float32Array(posAttr.array);

    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Bright tropical cyan/turquoise
      map: this.createWaterTexture(),
      roughness: 0.15,
      metalness: 0.4,
      transparent: true,
      opacity: 0.94
    });

    this.oceanMesh = new THREE.Mesh(oceanGeom, oceanMat);
    this.oceanMesh.position.y = -1.1;
    this.oceanMesh.receiveShadow = true;
    this.trackGroup.add(this.oceanMesh);

    // Sandy Shoreline Seabed
    const sandGeom = new THREE.PlaneGeometry(2600, 2600, 20, 20);
    sandGeom.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Warm golden sand
      roughness: 0.95,
      metalness: 0.05
    });
    const sand = new THREE.Mesh(sandGeom, sandMat);
    sand.position.y = -1.6;
    sand.receiveShadow = true;
    this.trackGroup.add(sand);
  }

  // --------------------------------------------------------------------------
  // 3. HORIZON VOLCANIC ISLANDS & LUSH ARCHIPELAGO (Natural Mountain Ridges)
  // --------------------------------------------------------------------------
  private buildDistantIslands(): void {
    const islandGroup = new THREE.Group();

    // Natural mountain materials catching warm sunset illumination
    const mountainRockMat = new THREE.MeshStandardMaterial({
      color: 0x574838, // Warm earthy rock
      roughness: 0.92,
      metalness: 0.08
    });

    const mountainJungleMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Deep tropical rainforest canopy
      roughness: 0.88,
      metalness: 0.02
    });

    const coastalCliffMat = new THREE.MeshStandardMaterial({
      color: 0x78716c, // Layered limestone/sandstone coastal cliff
      roughness: 0.85
    });

    const goldenBeachMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Amber golden beach coastline
      roughness: 0.92
    });

    const numIslands = 18;
    for (let i = 0; i < numIslands; i++) {
      const angle = (i / numIslands) * Math.PI * 2;
      const dist = 540 + Math.sin(i * 3.7) * 120;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = 110 + (i % 6) * 32;
      const radius = 95 + (i % 5) * 28;

      const singleIsland = new THREE.Group();
      singleIsland.position.set(x, 0, z);

      // Coastal beach base
      const beach = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.15, radius * 1.35, 4.0, 14),
        goldenBeachMat
      );
      beach.position.y = -0.5;
      singleIsland.add(beach);

      // Coastal Cliff Tier
      const cliffTier = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.85, radius * 1.12, height * 0.35, 14),
        coastalCliffMat
      );
      cliffTier.position.y = height * 0.175;
      cliffTier.scale.set(1.0, 1.0, 0.85 + (i % 3) * 0.15);
      singleIsland.add(cliffTier);

      // Lush Jungle Mid-Slope
      const jungleSlope = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.55, radius * 0.9, height * 0.45, 12),
        mountainJungleMat
      );
      jungleSlope.position.y = height * 0.48;
      jungleSlope.rotation.y = (i * 0.5);
      singleIsland.add(jungleSlope);

      // Natural Sculpted Mountain Peaks (2-3 jagged volcanic peaks per island)
      const numPeaks = 2 + (i % 2);
      for (let p = 0; p < numPeaks; p++) {
        const peakH = height * (0.65 + p * 0.22);
        const peakR = radius * (0.35 - p * 0.08);
        const peakMesh = new THREE.Mesh(
          new THREE.ConeGeometry(peakR, peakH, 8),
          mountainRockMat
        );
        const pOffsetAngle = (p / numPeaks) * Math.PI * 2;
        const pOffsetDist = p === 0 ? 0 : radius * 0.25;
        peakMesh.position.set(
          Math.cos(pOffsetAngle) * pOffsetDist,
          height * 0.5 + peakH * 0.45,
          Math.sin(pOffsetAngle) * pOffsetDist
        );
        peakMesh.rotation.y = p * 0.8;
        peakMesh.scale.set(1.1, 1.0, 0.9);
        singleIsland.add(peakMesh);
      }

      islandGroup.add(singleIsland);
    }

    this.trackGroup.add(islandGroup);
  }

  // --------------------------------------------------------------------------
  // 4. FLOATING SUNSET CLOUDS
  // --------------------------------------------------------------------------
  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5, // Soft sunset peach/amber glow
      roughness: 0.65,
      metalness: 0.05
    });

    const numClouds = 22;
    for (let i = 0; i < numClouds; i++) {
      const cloud = new THREE.Group();
      const x = (Math.random() - 0.5) * 1100;
      const y = 110 + Math.random() * 90;
      const z = (Math.random() - 0.5) * 1100;
      cloud.position.set(x, y, z);

      // 4-6 clustered spheres per cumulus cloud
      const puffs = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const r = 18 + Math.random() * 16;
        const puffGeom = new THREE.DodecahedronGeometry(r);
        const puff = new THREE.Mesh(puffGeom, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 35,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 28
        );
        cloud.add(puff);
      }
      this.clouds.push(cloud);
      this.trackGroup.add(cloud);
    }
  }

  // --------------------------------------------------------------------------
  // 5. ROAD SURFACE (PBR Asphalt, Red/White Kerbs, Markings & Wooden Ocean Bridge)
  // Perfectly Closed Seamless Circuit Loop with Upward Vertex Normals
  // --------------------------------------------------------------------------
  private buildRoadMesh(): void {
    const segments = 360;
    const halfWidth = this.config.roadWidth / 2;
    const up = new THREE.Vector3(0, 1, 0);

    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const whiteColor = new THREE.Color(0xf8fafc);
    const asphaltColor = new THREE.Color(0x282f3d);   // Modern high-grip charcoal racetrack asphalt
    const woodPlankColor = new THREE.Color(0x7c4a22); // Boardwalk timber planks
    const woodLineColor = new THREE.Color(0xb45309);  // Golden timber boundary

    const kerbRed = new THREE.Color(0xef4444);
    const kerbWhite = new THREE.Color(0xffffff);

    // 1. Generate 360 slices (0 to 359)
    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Ocean Bridge section (t between ~0.65 and 0.82)
      const isOceanBridge = t >= 0.65 && t <= 0.82;

      // Alternating kerb blocks (Vibrant Red and Crisp White)
      const isAltKerb = Math.floor(t * 140) % 2 === 0;
      const kerbCol = isOceanBridge
        ? (isAltKerb ? woodLineColor : woodPlankColor)
        : (isAltKerb ? kerbRed : kerbWhite);

      // Alternating dashed centerline
      const isCenterDash = Math.floor(t * 180) % 2 === 0;
      const currentRoadColor = isOceanBridge ? woodPlankColor : asphaltColor;
      const centerLineCol = isCenterDash ? (isOceanBridge ? woodLineColor : whiteColor) : currentRoadColor;

      // 14 cross-section vertices:
      const p0 = point.clone().addScaledVector(binormal, -halfWidth - 1.2).add(new THREE.Vector3(0, 0.12, 0));
      const p1 = point.clone().addScaledVector(binormal, -halfWidth).add(new THREE.Vector3(0, 0.04, 0));
      const p2 = point.clone().addScaledVector(binormal, -halfWidth).add(new THREE.Vector3(0, 0.02, 0));
      const p3 = point.clone().addScaledVector(binormal, -halfWidth + 0.35).add(new THREE.Vector3(0, 0.02, 0));
      const p4 = point.clone().addScaledVector(binormal, -halfWidth + 0.36).add(new THREE.Vector3(0, 0.01, 0));
      const p5 = point.clone().addScaledVector(binormal, -0.22).add(new THREE.Vector3(0, 0.01, 0));
      const p6 = point.clone().addScaledVector(binormal, -0.20).add(new THREE.Vector3(0, 0.02, 0));
      const p7 = point.clone().addScaledVector(binormal, 0.20).add(new THREE.Vector3(0, 0.02, 0));
      const p8 = point.clone().addScaledVector(binormal, 0.22).add(new THREE.Vector3(0, 0.01, 0));
      const p9 = point.clone().addScaledVector(binormal, halfWidth - 0.36).add(new THREE.Vector3(0, 0.01, 0));
      const p10 = point.clone().addScaledVector(binormal, halfWidth - 0.35).add(new THREE.Vector3(0, 0.02, 0));
      const p11 = point.clone().addScaledVector(binormal, halfWidth).add(new THREE.Vector3(0, 0.02, 0));
      const p12 = point.clone().addScaledVector(binormal, halfWidth).add(new THREE.Vector3(0, 0.04, 0));
      const p13 = point.clone().addScaledVector(binormal, halfWidth + 1.2).add(new THREE.Vector3(0, 0.12, 0));

      const slicePoints = [p0, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13];
      const sliceColors = [
        kerbCol,           // 0: Left kerb outer
        kerbCol,           // 1: Left kerb inner
        whiteColor,        // 2: Left border line outer
        whiteColor,        // 3: Left border line inner
        currentRoadColor,  // 4: Left lane tarmac outer
        currentRoadColor,  // 5: Left lane tarmac inner
        centerLineCol,     // 6: Center dashed line left
        centerLineCol,     // 7: Center dashed line right
        currentRoadColor,  // 8: Right lane tarmac inner
        currentRoadColor,  // 9: Right lane tarmac outer
        whiteColor,        // 10: Right border line inner
        whiteColor,        // 11: Right border line outer
        kerbCol,           // 12: Right kerb inner
        kerbCol            // 13: Right kerb outer
      ];

      slicePoints.forEach(p => vertices.push(p.x, p.y, p.z));
      sliceColors.forEach(c => colors.push(c.r, c.g, c.b));

      // Add Bridge Pillars into the ocean during the ocean bridge section
      if (isOceanBridge && i % 6 === 0) {
        const pillarGeom = new THREE.CylinderGeometry(0.65, 0.75, point.y + 5.0, 10);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3f2516, roughness: 0.95 });
        [-halfWidth - 0.6, halfWidth + 0.6].forEach(sideOffset => {
          const pillar = new THREE.Mesh(pillarGeom, pillarMat);
          const pillarPos = point.clone().addScaledVector(binormal, sideOffset);
          pillar.position.set(pillarPos.x, (point.y - 1.5) / 2, pillarPos.z);
          pillar.castShadow = true;
          this.trackGroup.add(pillar);
        });
      }
    }

    // 2. Connect 360 segments in a closed loop (slice i connects to (i+1) % segments)
    for (let i = 0; i < segments; i++) {
      const baseIdx = i * 14;
      const nextBase = ((i + 1) % segments) * 14;

      // 13 quads per segment with upward normals (a, c, b) and (b, c, d)
      for (let q = 0; q < 13; q++) {
        const a = baseIdx + q;
        const b = baseIdx + q + 1;
        const c = nextBase + q;
        const d = nextBase + q + 1;

        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.22,
      side: THREE.DoubleSide
    });

    this.roadMesh = new THREE.Mesh(geom, mat);
    this.roadMesh.receiveShadow = true;
    this.trackGroup.add(this.roadMesh);
  }

  // --------------------------------------------------------------------------
  // 6. 3D SOLID CRASH BARRIERS & NEON SAFETY RAILS & CHEVRON ARROW SIGNS
  // --------------------------------------------------------------------------
  private buildGuardrails(): void {
    const segments = 360;
    const halfWidth = this.config.roadWidth / 2;
    const up = new THREE.Vector3(0, 1, 0);

    const barrierGroup = new THREE.Group();
    const leftVertices: number[] = [];
    const rightVertices: number[] = [];
    const barrierIndices: number[] = [];

    const barrierHeight = 1.35; // 1.35 meters high

    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const leftBase = point.clone().addScaledVector(binormal, -halfWidth - 1.25).add(new THREE.Vector3(0, 0.1, 0));
      const leftTop = leftBase.clone().add(new THREE.Vector3(0, barrierHeight, 0));
      leftVertices.push(leftBase.x, leftBase.y, leftBase.z);
      leftVertices.push(leftTop.x, leftTop.y, leftTop.z);

      const rightBase = point.clone().addScaledVector(binormal, halfWidth + 1.25).add(new THREE.Vector3(0, 0.1, 0));
      const rightTop = rightBase.clone().add(new THREE.Vector3(0, barrierHeight, 0));
      rightVertices.push(rightBase.x, rightBase.y, rightBase.z);
      rightVertices.push(rightTop.x, rightTop.y, rightTop.z);
    }

    // Connect segments in a seamless closed circuit
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const nextI = (i + 1) % segments;
      const c = nextI * 2;
      const d = c + 1;

      barrierIndices.push(a, c, b);
      barrierIndices.push(b, c, d);
    }

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1e2433,
      metalness: 0.85,
      roughness: 0.35,
      side: THREE.DoubleSide
    });

    const leftGeom = new THREE.BufferGeometry();
    leftGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftVertices, 3));
    leftGeom.setIndex(barrierIndices);
    leftGeom.computeVertexNormals();
    const leftBarrier = new THREE.Mesh(leftGeom, barrierMat);
    leftBarrier.castShadow = true;
    leftBarrier.receiveShadow = true;
    barrierGroup.add(leftBarrier);

    const rightGeom = new THREE.BufferGeometry();
    rightGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightVertices, 3));
    rightGeom.setIndex(barrierIndices);
    rightGeom.computeVertexNormals();
    const rightBarrier = new THREE.Mesh(rightGeom, barrierMat);
    rightBarrier.castShadow = true;
    rightBarrier.receiveShadow = true;
    barrierGroup.add(rightBarrier);

    // Glowing Neon Top Cap Strip (Electric Magenta Safety Rail)
    const topStripMat = new THREE.MeshBasicMaterial({
      color: 0xff007f, // Glowing electric magenta top rail
      side: THREE.DoubleSide
    });

    const leftTopStripGeom = new THREE.BufferGeometry();
    const rightTopStripGeom = new THREE.BufferGeometry();
    const leftTopVertices: number[] = [];
    const rightTopVertices: number[] = [];
    const stripIndices: number[] = [];

    for (let i = 0; i < segments; i++) {
      const t = i / segments;
      const point = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Left top cap ribbon (0.24m wide)
      const l1 = point.clone().addScaledVector(binormal, -halfWidth - 1.37).add(new THREE.Vector3(0, barrierHeight + 0.1, 0));
      const l2 = point.clone().addScaledVector(binormal, -halfWidth - 1.13).add(new THREE.Vector3(0, barrierHeight + 0.1, 0));
      leftTopVertices.push(l1.x, l1.y, l1.z);
      leftTopVertices.push(l2.x, l2.y, l2.z);

      // Right top cap ribbon
      const r1 = point.clone().addScaledVector(binormal, halfWidth + 1.13).add(new THREE.Vector3(0, barrierHeight + 0.1, 0));
      const r2 = point.clone().addScaledVector(binormal, halfWidth + 1.37).add(new THREE.Vector3(0, barrierHeight + 0.1, 0));
      rightTopVertices.push(r1.x, r1.y, r1.z);
      rightTopVertices.push(r2.x, r2.y, r2.z);
    }

    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const nextI = (i + 1) % segments;
      const c = nextI * 2;
      const d = c + 1;

      stripIndices.push(a, c, b);
      stripIndices.push(b, c, d);
    }

    leftTopStripGeom.setAttribute('position', new THREE.Float32BufferAttribute(leftTopVertices, 3));
    leftTopStripGeom.setIndex(stripIndices);
    const leftTopMesh = new THREE.Mesh(leftTopStripGeom, topStripMat);
    barrierGroup.add(leftTopMesh);

    rightTopStripGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightTopVertices, 3));
    rightTopStripGeom.setIndex(stripIndices);
    const rightTopMesh = new THREE.Mesh(rightTopStripGeom, topStripMat);
    barrierGroup.add(rightTopMesh);

    // Glowing Neon Yellow Turn Chevron Signs (>> and << along major curves)
    const chevronMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    const chevronBackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const arrowCurvePoints = [0.08, 0.10, 0.12, 0.38, 0.40, 0.42, 0.86, 0.88, 0.90];

    arrowCurvePoints.forEach(t => {
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      [-1, 1].forEach(side => {
        const signGroup = new THREE.Group();
        const signPos = pt.clone().addScaledVector(binormal, side * (halfWidth + 1.6)).add(new THREE.Vector3(0, 1.8, 0));
        signGroup.position.copy(signPos);
        signGroup.rotation.y = Math.atan2(tangent.x, tangent.z);

        // Sign backing board
        const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.1), chevronBackMat);
        signGroup.add(board);

        // Glowing chevron arrows
        const chevron = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), chevronMat);
        chevron.position.z = side > 0 ? -0.06 : 0.06;
        if (side > 0) chevron.rotation.y = Math.PI;
        signGroup.add(chevron);

        barrierGroup.add(signGroup);
      });
    });

    this.trackGroup.add(barrierGroup);
  }

  // --------------------------------------------------------------------------
  // 7. ROTATING COLLECTIBLE GOLDEN COINS
  // --------------------------------------------------------------------------
  private buildCollectibleCoins(): void {
    const coinGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 18);
    coinGeom.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15, // Golden yellow
      metalness: 0.92,
      roughness: 0.15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.4
    });

    // Place clusters of 3 coins along scenic apexes
    const coinSections = [0.10, 0.26, 0.46, 0.70, 0.86];
    coinSections.forEach(sectionT => {
      for (let c = -1; c <= 1; c++) {
        const t = (sectionT + c * 0.008 + 1.0) % 1.0;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        const coin = new THREE.Mesh(coinGeom, coinMat);
        const pos = pt.clone().addScaledVector(binormal, c * 2.2).add(new THREE.Vector3(0, 0.8, 0));
        coin.position.copy(pos);
        coin.castShadow = true;
        this.trackGroup.add(coin);
        this.coins.push({ mesh: coin, position: pos, collected: false });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 8. CHECKPOINTS & NEON BOOST PADS
  // --------------------------------------------------------------------------
  private buildCheckpoints(): void {
    const numCheckpoints = 16;
    for (let i = 0; i < numCheckpoints; i++) {
      const t = i / numCheckpoints;
      const center = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      this.checkpoints.push({
        index: i,
        center,
        tangent,
        normal,
        width: this.config.roadWidth + 3.0
      });
    }
  }

  private buildBoostPads(): void {
    const padGeom = new THREE.PlaneGeometry(7.5, 4.5);
    padGeom.rotateX(-Math.PI / 2);

    const padMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide
    });

    this.config.boostPads.forEach(ptIdx => {
      const t = ptIdx / this.config.points.length;
      const pos = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();

      const pad = new THREE.Mesh(padGeom, padMat);
      pad.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
      pad.rotation.y = Math.atan2(tangent.x, tangent.z);

      // Glowing pad chevron border
      const borderGeom = new THREE.RingGeometry(2.4, 2.6, 4);
      borderGeom.rotateX(-Math.PI / 2);
      borderGeom.rotateY(Math.PI / 4);
      const border = new THREE.Mesh(borderGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      border.position.copy(pos).add(new THREE.Vector3(0, 0.08, 0));
      this.trackGroup.add(border);

      this.trackGroup.add(pad);
      this.boostPads.push({
        mesh: pad,
        position: pad.position,
        direction: tangent
      });
    });
  }

  // --------------------------------------------------------------------------
  // 9. START / FINISH GANTRY ARCH & CHECKERED BANNER
  // --------------------------------------------------------------------------
  private buildStartFinishGantry(): void {
    const startPoint = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0).normalize();
    const gantry = new THREE.Group();
    gantry.position.copy(startPoint);
    gantry.rotation.y = Math.atan2(tangent.x, tangent.z);

    const halfW = this.config.roadWidth / 2 + 1.8;
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });

    // Left and Right Truss Towers
    const postGeom = new THREE.BoxGeometry(0.9, 8.0, 0.9);
    const leftPost = new THREE.Mesh(postGeom, postMat);
    leftPost.position.set(-halfW, 4.0, 0);
    gantry.add(leftPost);

    const rightPost = new THREE.Mesh(postGeom, postMat);
    rightPost.position.set(halfW, 4.0, 0);
    gantry.add(rightPost);

    // Overhead Banner with Checkered Finish Board & "KARTVERSE" Title
    let bannerMat: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    if (typeof document !== 'undefined') {
      const bannerCanvas = document.createElement('canvas');
      bannerCanvas.width = 1024;
      bannerCanvas.height = 256;
      const bCtx = bannerCanvas.getContext('2d')!;

      bCtx.fillStyle = '#0f172a';
      bCtx.fillRect(0, 0, 1024, 256);

      // Checkerboard top and bottom bars
      for (let c = 0; c < 32; c++) {
        bCtx.fillStyle = c % 2 === 0 ? '#ffffff' : '#000000';
        bCtx.fillRect(c * 32, 0, 32, 28);
        bCtx.fillRect(c * 32, 228, 32, 28);
      }

      // Bold title text
      bCtx.fillStyle = '#00f0ff';
      bCtx.font = 'bold 88px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText('K A R T V E R S E', 512, 110);

      bCtx.fillStyle = '#facc15';
      bCtx.font = 'bold 36px sans-serif';
      bCtx.fillText('SUNSET PARADISE GRAND PRIX', 512, 175);

      const bannerTex = new THREE.CanvasTexture(bannerCanvas);
      bannerMat = new THREE.MeshStandardMaterial({
        map: bannerTex,
        metalness: 0.4,
        roughness: 0.4
      });
    }
    const bannerGeom = new THREE.BoxGeometry(halfW * 2 + 1.2, 2.4, 0.6);
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(0, 6.8, 0);
    gantry.add(banner);

    // Start Lights (5 pods)
    for (let p = -2; p <= 2; p++) {
      const lightPod = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 14),
        new THREE.MeshBasicMaterial({ color: 0xff0033 })
      );
      lightPod.position.set(p * 2.2, 5.0, 0.35);
      gantry.add(lightPod);
    }

    this.trackGroup.add(gantry);
  }

  // --------------------------------------------------------------------------
  // 10. SCENERY: WATERFALL, LIGHTHOUSE, PALM GROVES & SPECTATOR HUTS
  // --------------------------------------------------------------------------
  private buildScenery(): void {
    const up = new THREE.Vector3(0, 1, 0);

    // A. WATERFALL JUMP SECTION (at t ~ 0.35)
    // Strictly adheres to (roadWidth/2 + 6m) Clearance Envelope — ZERO Road Intersection
    const waterfallT = 0.35;
    const wfCenter = this.curve.getPointAt(waterfallT);
    const wfTangent = this.curve.getTangentAt(waterfallT).normalize();
    const wfBinormal = new THREE.Vector3().crossVectors(wfTangent, up).normalize();

    // Cascading Rock Gorge Flanking Track safely outside 14m corridor (placed at 38m offset)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.92 });
    [-1, 1].forEach(side => {
      const cliff = new THREE.Mesh(new THREE.DodecahedronGeometry(14), rockMat);
      cliff.position.copy(wfCenter).addScaledVector(wfBinormal, side * 38.0).setY(10);
      cliff.scale.set(1.3, 2.2, 1.3);
      this.trackGroup.add(cliff);
    });

    // Cascading Crystal Waterfall Plane
    const wfGeom = new THREE.PlaneGeometry(16, 26);
    const wfMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    const waterfall = new THREE.Mesh(wfGeom, wfMat);
    waterfall.position.copy(wfCenter).addScaledVector(wfBinormal, -26).setY(7);
    waterfall.rotation.y = Math.PI / 2;
    this.trackGroup.add(waterfall);

    // B. MOUNTAIN TUNNEL CAVERN (at t ~ 0.52)
    // Grand Arched Stone Mountain Tunnel (Width: 25m, Height: 12m)
    const tunnelT = 0.52;
    const tunnelCenter = this.curve.getPointAt(tunnelT);
    const tunnelTangent = this.curve.getTangentAt(tunnelT).normalize();
    const tunnelBinormal = new THREE.Vector3().crossVectors(tunnelTangent, up).normalize();

    const archMat = new THREE.MeshStandardMaterial({ color: 0x241e1a, roughness: 0.95 });
    const stoneColMat = new THREE.MeshStandardMaterial({ color: 0x38302a, roughness: 0.9 });

    // Outer Mountain Mass spanning above tunnel
    const mountainMass = new THREE.Mesh(
      new THREE.DodecahedronGeometry(36),
      new THREE.MeshStandardMaterial({ color: 0x1f1915, roughness: 0.98 })
    );
    mountainMass.position.copy(tunnelCenter).add(new THREE.Vector3(0, 32, 0));
    mountainMass.scale.set(1.4, 0.9, 1.8);
    this.trackGroup.add(mountainMass);

    for (let arch = -4; arch <= 4; arch++) {
      const archGroup = new THREE.Group();
      const archPos = tunnelCenter.clone().addScaledVector(tunnelTangent, arch * 7.5);
      archGroup.position.copy(archPos);
      archGroup.rotation.y = Math.atan2(tunnelTangent.x, tunnelTangent.z);

      // Vaulted Ceiling Arch (Radius 12.5m ensures 25m total span, way above 16m roadWidth)
      const archTop = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 12.5, 4.0, 16, 1, true, 0, Math.PI), archMat);
      archTop.position.set(0, 4.5, 0);
      archTop.rotation.z = Math.PI / 2;
      archGroup.add(archTop);

      // Side Masonry Buttresses (Placed at x = +/- 11.5m, safely outside 8m road half-width)
      [-11.5, 11.5].forEach(sideX => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 8.0, 4.0), stoneColMat);
        pillar.position.set(sideX, 4.0, 0);
        archGroup.add(pillar);
      });

      // Glowing Neon Guide Lanterns inside tunnel
      const neonLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.3, 3.5),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      neonLight.position.set(0, 12.0, 0);
      archGroup.add(neonLight);

      this.trackGroup.add(archGroup);
    }

    // C. NAUTICAL LIGHTHOUSE ON COASTAL BLUFF
    const lhPos = new THREE.Vector3(70, 0, -320);
    const lhGroup = new THREE.Group();
    lhGroup.position.copy(lhPos);

    // Tower base & striped bands
    const towerGeom = new THREE.CylinderGeometry(3.5, 5.5, 42, 16);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const tower = new THREE.Mesh(towerGeom, towerMat);
    tower.position.y = 21;
    lhGroup.add(tower);

    // Red accent stripes
    for (let s = 0; s < 3; s++) {
      const stripeGeom = new THREE.CylinderGeometry(3.8 - s * 0.4, 4.3 - s * 0.4, 4, 16);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.y = 10 + s * 10;
      lhGroup.add(stripe);
    }

    // Lantern Room & Rotating Spotlight Beacon
    const lanternGeom = new THREE.CylinderGeometry(3.8, 3.8, 6, 12);
    const lanternMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    const lantern = new THREE.Mesh(lanternGeom, lanternMat);
    lantern.position.y = 44;
    lhGroup.add(lantern);

    // Spotlight beam
    const beamGeom = new THREE.ConeGeometry(14, 160, 16, 1, true);
    beamGeom.rotateX(-Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    this.lighthouseBeacon = new THREE.Mesh(beamGeom, beamMat);
    this.lighthouseBeacon.position.set(0, 44, 80);
    lhGroup.add(this.lighthouseBeacon);

    this.trackGroup.add(lhGroup);

    // D. FLOATING SKY ISLAND (As seen in concept artwork)
    const skyIsland = new THREE.Group();
    skyIsland.position.set(110, 140, 50);

    const islandRock = new THREE.Mesh(
      new THREE.ConeGeometry(38, 55, 7),
      new THREE.MeshStandardMaterial({ color: 0x473c33, roughness: 0.95 })
    );
    islandRock.rotation.x = Math.PI; // Inverted cone hanging down
    skyIsland.add(islandRock);

    const islandGrass = new THREE.Mesh(
      new THREE.CylinderGeometry(38, 38, 4, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 })
    );
    islandGrass.position.y = 2;
    skyIsland.add(islandGrass);

    // Tiny temple on floating island
    const temple = new THREE.Mesh(
      new THREE.BoxGeometry(12, 10, 12),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9 })
    );
    temple.position.set(0, 8, 0);
    skyIsland.add(temple);

    this.trackGroup.add(skyIsland);

    // E. STRIPED HOT AIR BALLOON (Drifting in Sunset Sky)
    const balloonGroup = new THREE.Group();
    balloonGroup.position.set(220, 165, -90);

    const balloonGeom = new THREE.SphereGeometry(18, 16, 16);
    balloonGeom.scale(1, 1.4, 1);
    const balloonMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.3 });
    const balloon = new THREE.Mesh(balloonGeom, balloonMat);
    balloonGroup.add(balloon);

    const basketGeom = new THREE.BoxGeometry(4, 3, 4);
    const basketMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const basket = new THREE.Mesh(basketGeom, basketMat);
    basket.position.y = -22;
    balloonGroup.add(basket);

    this.trackGroup.add(balloonGroup);

    // F. DENSE TROPICAL PALM GROVES & SPECTATOR HUTS
    const palmCount = 65;
    for (let i = 0; i < palmCount; i++) {
      const t = i / palmCount;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      const dist = this.config.roadWidth / 2 + 5.5 + Math.random() * 24.0;
      const propPos = pt.clone().addScaledVector(binormal, side * dist);

      // High-Fidelity Curving Tropical Palm Tree
      const palmGroup = new THREE.Group();
      palmGroup.position.copy(propPos);
      const curveDir = (Math.random() - 0.5) * 0.35;
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x784f2d, roughness: 0.85 });

      // Multi-segment curved trunk (3 curved nodes)
      const segH = 3.6;
      for (let s = 0; s < 3; s++) {
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32 - s * 0.06, 0.45 - s * 0.06, segH, 8),
          trunkMat
        );
        seg.position.set(s * curveDir * 1.5, segH * (s + 0.5), 0);
        seg.rotation.z = s * curveDir * 0.3;
        seg.castShadow = true;
        palmGroup.add(seg);
      }

      const totalH = segH * 3;
      const crownTop = new THREE.Vector3(2 * curveDir * 1.5, totalH, 0);

      // Coconuts cluster under crown
      const coconutMat = new THREE.MeshStandardMaterial({ color: 0x45220a, roughness: 0.8 });
      for (let c = 0; c < 4; c++) {
        const nut = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), coconutMat);
        const cAngle = (c / 4) * Math.PI * 2;
        nut.position.set(
          crownTop.x + Math.cos(cAngle) * 0.45,
          crownTop.y - 0.25,
          crownTop.z + Math.sin(cAngle) * 0.45
        );
        palmGroup.add(nut);
      }

      // 10 Arched Drooping Palm Fronds with Tropical Emerald Foliage
      const frondMat = new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        roughness: 0.55,
        side: THREE.DoubleSide
      });
      for (let leaf = 0; leaf < 10; leaf++) {
        const leafAngle = (leaf / 10) * Math.PI * 2;
        const leafGroup = new THREE.Group();
        leafGroup.position.copy(crownTop);
        leafGroup.rotation.y = leafAngle;

        // Arched leaf ribbon
        const frondGeom = new THREE.BoxGeometry(1.6, 0.06, 6.2);
        const frond = new THREE.Mesh(frondGeom, frondMat);
        frond.position.set(0, -0.6, 2.8);
        frond.rotation.x = -0.38; // Droop down
        frond.castShadow = true;
        leafGroup.add(frond);

        palmGroup.add(leafGroup);
      }

      this.trackGroup.add(palmGroup);

      // Beach Thatched Huts & Parasols (Every ~7 palms)
      if (i % 7 === 0) {
        const hutGroup = new THREE.Group();
        hutGroup.position.copy(propPos).addScaledVector(binormal, side * 7.0);
        hutGroup.rotation.y = Math.atan2(tangent.x, tangent.z);

        const hutBody = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.8, 5.5), new THREE.MeshStandardMaterial({ color: 0xa16207 }));
        hutBody.position.y = 1.9;
        hutGroup.add(hutBody);

        const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(5.0, 3.2, 4), new THREE.MeshStandardMaterial({ color: 0xca8a04 }));
        hutRoof.position.y = 5.2;
        hutRoof.rotation.y = Math.PI / 4;
        hutGroup.add(hutRoof);

        // Striped Beach Parasol
        const umbrellaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        umbrellaPole.position.set(4.5, 1.75, 0);
        hutGroup.add(umbrellaPole);

        const umbrellaCanopy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        umbrellaCanopy.position.set(4.5, 3.5, 0);
        hutGroup.add(umbrellaCanopy);

        this.trackGroup.add(hutGroup);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 11. ANIMATION LOOP (Lighthouse Beacon, Clouds, Ocean Waves & Coins)
  // --------------------------------------------------------------------------
  public update(delta: number, playerPos: THREE.Vector3): void {
    // 1. Dynamic Ocean Waves Undulation
    this.oceanTime += delta * 1.5;
    if (this.oceanMesh && this.oceanBaseVertices) {
      const posAttr = this.oceanMesh.geometry.attributes.position;
      const arr = posAttr.array as Float32Array;
      const base = this.oceanBaseVertices;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        const idx = i * 3;
        const x = base[idx];
        const z = base[idx + 2];
        arr[idx + 1] = base[idx + 1] + 
          Math.sin(x * 0.018 + this.oceanTime) * 0.45 + 
          Math.cos(z * 0.015 + this.oceanTime * 0.8) * 0.35;
      }
      posAttr.needsUpdate = true;
    }

    // 2. Rotate Lighthouse Beacon Beam
    if (this.lighthouseBeacon) {
      this.lighthouseBeacon.rotation.z += delta * 1.2;
    }

    // 3. Drift Sunset Clouds slowly across the sky
    this.clouds.forEach(c => {
      c.position.x += delta * 3.5;
      if (c.position.x > 650) {
        c.position.x = -650;
      }
    });

    // 4. Rotate Collectible Golden Coins & Check Player Collection
    this.coins.forEach(coin => {
      if (!coin.collected) {
        coin.mesh.rotation.y += delta * 4.0;

        // Player coin pickup check
        if (playerPos.distanceTo(coin.position) < 2.4) {
          coin.collected = true;
          coin.mesh.visible = false;
          audio.playItemCollect();
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 12. TRACK CONSTRAINT & BOUNDARY ENFORCEMENT (PHYSICS & CLAMPING)
  // --------------------------------------------------------------------------
  public getTrackConstraint(kartPos: THREE.Vector3): TrackConstraintResult {
    let closestSample = this.splineSamples[0];
    let minDistanceSq = Infinity;

    for (let i = 0; i < this.splineSamples.length; i++) {
      const s = this.splineSamples[i];
      const dx = s.point.x - kartPos.x;
      const dz = s.point.z - kartPos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistanceSq) {
        minDistanceSq = dSq;
        closestSample = s;
      }
    }

    const tangent = closestSample.tangent;
    const binormal = closestSample.binormal;
    const toKart = new THREE.Vector3().subVectors(kartPos, closestSample.point);

    const forwardProjection = toKart.dot(tangent);
    const fineCenter = closestSample.point.clone().addScaledVector(tangent, forwardProjection);

    const toFineKart = new THREE.Vector3().subVectors(kartPos, fineCenter);
    const lateralOffset = toFineKart.dot(binormal);

    const roadHalfWidth = this.config.roadWidth / 2;
    const maxBoundary = roadHalfWidth + 0.6; // Keep kart firmly inside barrier walls at all times

    const absOffset = Math.abs(lateralOffset);
    const isOnRoad = absOffset <= roadHalfWidth;
    const isOnKerb = absOffset > roadHalfWidth && absOffset <= maxBoundary;
    const isHittingBarrier = absOffset >= maxBoundary;
    const isOutOfBounds = absOffset > roadHalfWidth + 14.0 || Math.abs(kartPos.y - fineCenter.y) > 10.0;

    const sideSign = lateralOffset >= 0 ? 1 : -1;
    const barrierNormal = binormal.clone().multiplyScalar(-sideSign);

    const clampedPos = kartPos.clone();
    if (absOffset > maxBoundary) {
      clampedPos.copy(fineCenter).addScaledVector(binormal, sideSign * maxBoundary);
    }
    clampedPos.y = fineCenter.y + 0.2;

    return {
      nearestCenter: fineCenter,
      tangent,
      binormal,
      lateralOffset,
      roadHalfWidth,
      roadElevation: fineCenter.y,
      isOnRoad,
      isOnKerb,
      isHittingBarrier,
      isOutOfBounds,
      barrierNormal,
      clampedPosition: clampedPos
    };
  }

  public getRoadHeightAt(pos: THREE.Vector3): number {
    return this.getTrackConstraint(pos).roadElevation;
  }

  // --------------------------------------------------------------------------
  // 13. STARTING GRID SLOTS (Strictly In-Lane Staggered Grid)
  // --------------------------------------------------------------------------
  public getStartingGrid(): { position: THREE.Vector3; rotationY: number }[] {
    const slots: { position: THREE.Vector3; rotationY: number }[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    // 8 racers arranged in 4 rows of 2 (staggered pole position)
    for (let i = 0; i < 8; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      // Staggered grid on the straightaway approaching the finish gantry
      const t = (1.0 - 0.02 - row * 0.012) % 1.0;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const rotY = Math.atan2(tangent.x, tangent.z);

      // Center racers in their respective lanes (col * 2.5m)
      const pos = pt.clone().addScaledVector(binormal, col * 2.5);
      pos.y = pt.y + 0.25;
      slots.push({ position: pos, rotationY: rotY });
    }

    return slots;
  }
}
