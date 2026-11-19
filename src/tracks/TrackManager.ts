// ============================================================================
// KARTVERSE — 3D Track Extrusion, Checkpoints, Boost Pads & Guardrails Manager
// Features 5 Truly Unique Track Environments:
//   1. SUNSET PARADISE (BEACH) — Tropical island, waterfall, bridge & lighthouse
//   2. NEON CITY (CYBER) — Futuristic skyscrapers, holographic billboards & laser arches
//   3. MYSTIC FOREST (FOREST) — Ancient redwoods, bioluminescent mushrooms & fireflies
//   4. VOLCANO RUSH (LAVA) — Molten magma seas, obsidian spires & lava arches
//   5. FROST PEAK (ICE) — Glacial icebergs, snow-covered pines & crystalline caverns
// Strict Corridor Clearance: ZERO Mountain or Terrain Intersections with the Road
// ============================================================================

import * as THREE from 'three';
import { buildSunsetIsland } from './SunsetIsland';
import { createTrackCurve, TrackConfig, TRACKS } from './TrackData';
import { audio } from '../audio/AudioManager';

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
  lateralOffset: number;
  roadHalfWidth: number;
  roadElevation: number;
  isOnRoad: boolean;
  isOnKerb: boolean;
  isHittingBarrier: boolean;
  isOutOfBounds: boolean;
  barrierNormal: THREE.Vector3;
  clampedPosition: THREE.Vector3;
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
  public lighthouseBeacon?: THREE.Mesh;

  public checkpoints: CheckpointGate[] = [];
  public boostPads: BoostPad[] = [];
  public splineSamples: TrackSample[] = [];
  public coins: CollectibleCoin[] = [];
  private startLights: THREE.MeshBasicMaterial[] = [];
  public clouds: THREE.Group[] = [];
  public animatedProps: { mesh: THREE.Object3D; update: (delta: number) => void }[] = [];

  private oceanBaseVertices: Float32Array | null = null;
  private oceanTime = 0;
  private island?: ReturnType<typeof buildSunsetIsland>;

  constructor(scene: THREE.Scene, trackId = 'sunset_coast') {
    this.scene = scene;
    this.config = TRACKS[trackId] || TRACKS.sunset_coast;
    this.trackGroup = new THREE.Group();
    this.scene.add(this.trackGroup);

    // Create closed 3D Catmull-Rom spline
    this.curve = createTrackCurve(this.config);

    // Precalculate dense spline samples for collision and clamping
    this.generateSplineSamples(512);

    // 1. Build Atmosphere & World Sky
    if (this.config.theme === 'BEACH') {
      this.island = buildSunsetIsland(this.trackGroup, this.curve, this.config);
      this.skyDome = this.island.sky;
      this.oceanMesh = this.island.ocean;
    } else {
      this.buildSkyDome();
      this.buildGroundSurface();
      this.buildDistantHorizon();
      this.buildClouds();
      this.buildThemedScenery();
    }

    // 2. Build Circuit Geometry
    this.buildRoadMesh();
    this.buildGuardrails();
    this.buildCheckpoints();
    this.buildBoostPads();
    this.buildCollectibleCoins();
    this.buildStartFinishGantry();


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
  // 1. DYNAMIC SKY DOME & ATMOSPHERE (Unique per track theme)
  // --------------------------------------------------------------------------
  private createSkyTexture(): THREE.Texture {
    if (typeof document === 'undefined') return new THREE.Texture();
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    switch (this.config.theme) {
      case 'CYBER':
        grad.addColorStop(0.0, '#020617');   // Midnight Navy
        grad.addColorStop(0.25, '#07152b');  // Deep Royal Blue
        grad.addColorStop(0.44, '#0c274e');  // Vibrant Night Sky
        grad.addColorStop(0.50, '#00f0ff');  // Horizon: Electric Cyan Glow
        grad.addColorStop(0.53, '#0284c7');
        grad.addColorStop(1.0, '#020617');
        break;

      case 'FOREST':
        grad.addColorStop(0.0, '#022c22');   // Deep Forest Pine
        grad.addColorStop(0.25, '#064e3b');  // Rich Emerald Canopy
        grad.addColorStop(0.42, '#059669');  // Sunlit Forest Green
        grad.addColorStop(0.50, '#6ee7b7');  // Horizon: Golden Meadow Glow
        grad.addColorStop(0.53, '#047857');
        grad.addColorStop(1.0, '#022c22');
        break;

      case 'LAVA':
        grad.addColorStop(0.0, '#0c0a09');   // Dark Obsidian Zenith
        grad.addColorStop(0.25, '#1c1917');  // Deep Basalt
        grad.addColorStop(0.42, '#78350f');  // Warm Copper Atmosphere
        grad.addColorStop(0.50, '#f59e0b');  // Horizon: Golden Molten Amber Glow
        grad.addColorStop(0.53, '#b45309');
        grad.addColorStop(1.0, '#0c0a09');
        break;

      case 'ICE':
        grad.addColorStop(0.0, '#0369a1');   // Crisp Alpine Sky
        grad.addColorStop(0.25, '#0284c7');  // Glacier Azure
        grad.addColorStop(0.42, '#38bdf8');  // Polar Daylight
        grad.addColorStop(0.50, '#e0f2fe');  // Horizon: Pure Snow Peak Glow
        grad.addColorStop(0.53, '#7dd3fc');
        grad.addColorStop(1.0, '#0369a1');
        break;

      case 'BEACH':
      default:
        grad.addColorStop(0.0, '#0369a1');   // Zenith: Crisp Mediterranean Azure
        grad.addColorStop(0.24, '#0284c7');  // Clear Cerulean Sky
        grad.addColorStop(0.40, '#38bdf8');  // Sunny Daytime Blue
        grad.addColorStop(0.47, '#7dd3fc');  // Soft Coastal Atmosphere
        grad.addColorStop(0.50, '#fef08a');  // Horizon: Warm Golden Sunburst
        grad.addColorStop(0.53, '#0891b2');  // Tropical Turquoise Waterline
        grad.addColorStop(1.0, '#0e7490');
        break;
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  private buildSkyDome(): void {
    const skyGeom = new THREE.SphereGeometry(980, 48, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.createSkyTexture(),
      side: THREE.BackSide,
      fog: false
    });
    this.skyDome = new THREE.Mesh(skyGeom, skyMat);
    this.trackGroup.add(this.skyDome);

    // Celestial Sun / Moon Core
    this.sunGroup = new THREE.Group();
    this.sunGroup.position.copy(this.config.sunPosition);

    const sunColor = this.config.theme === 'CYBER' ? 0x00f0ff :
                     this.config.theme === 'FOREST' ? 0x6ee7b7 :
                     this.config.theme === 'LAVA' ? 0xff4500 :
                     this.config.theme === 'ICE' ? 0xe0f2fe : 0xfffbeb;

    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(26, 24, 24),
      new THREE.MeshBasicMaterial({ color: sunColor, fog: false })
    );
    this.sunGroup.add(sunCore);

    // Glowing Aura Flare Ring
    const flareGeom = new THREE.RingGeometry(28, 90, 32);
    const flareMat = new THREE.MeshBasicMaterial({
      color: sunColor,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      fog: false
    });
    const flare = new THREE.Mesh(flareGeom, flareMat);
    flare.lookAt(new THREE.Vector3(0, 20, 0));
    this.sunGroup.add(flare);

    this.trackGroup.add(this.sunGroup);
  }

  // --------------------------------------------------------------------------
  // 2. GROUND SURFACE (Turquoise Ocean, Cyber Plaza, Mossy Forest, Lava Sea, Glacier)
  // --------------------------------------------------------------------------
  private buildGroundSurface(): void {
    const theme = this.config.theme;

    if (theme === 'CYBER') {
      // Wet reflective cyber-asphalt plaza with cyan grid lines
      const cyberPlaza = new THREE.Mesh(
        new THREE.PlaneGeometry(3200, 3200, 32, 32).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x070913, roughness: 0.22, metalness: 0.85 })
      );
      cyberPlaza.position.y = -1.0;
      cyberPlaza.receiveShadow = true;
      this.trackGroup.add(cyberPlaza);

    } else if (theme === 'FOREST') {
      // Deep mossy forest ground with crystal stream
      const forestFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(3200, 3200, 32, 32).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x142e1b, roughness: 0.92 })
      );
      forestFloor.position.y = -1.0;
      forestFloor.receiveShadow = true;
      this.trackGroup.add(forestFloor);

    } else if (theme === 'LAVA') {
      // Bubbling Molten Magma Sea
      const lavaGeom = new THREE.PlaneGeometry(3600, 3600, 64, 64);
      lavaGeom.rotateX(-Math.PI / 2);
      this.oceanBaseVertices = new Float32Array(lavaGeom.attributes.position.array);

      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xea580c,
        emissive: 0xdc2626,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.2
      });
      this.oceanMesh = new THREE.Mesh(lavaGeom, lavaMat);
      this.oceanMesh.position.y = -1.2;
      this.trackGroup.add(this.oceanMesh);

      const rockCrust = new THREE.Mesh(
        new THREE.PlaneGeometry(2800, 2800, 16, 16).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x1f1412, roughness: 0.95 })
      );
      rockCrust.position.y = -1.4;
      this.trackGroup.add(rockCrust);

    } else if (theme === 'ICE') {
      // Glacial ice sheet with high reflection
      const icePlaza = new THREE.Mesh(
        new THREE.PlaneGeometry(3200, 3200, 32, 32).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.08, metalness: 0.6 })
      );
      icePlaza.position.y = -1.0;
      icePlaza.receiveShadow = true;
      this.trackGroup.add(icePlaza);
    }
  }

  // --------------------------------------------------------------------------
  // 3. DISTANT HORIZON SCENERY (Pushed out to 960m - 1200m; ZERO TRACK COLLISION)
  // Tracks have max radius ~385m. Horizon distance > 950m guarantees 400m+ buffer!
  // --------------------------------------------------------------------------
  private buildDistantHorizon(): void {
    const horizonGroup = new THREE.Group();
    const theme = this.config.theme;

    const numPeaks = 18;
    for (let i = 0; i < numPeaks; i++) {
      const angle = (i / numPeaks) * Math.PI * 2;
      // Horizon distance: strictly 950m to 1180m (well outside the 385m track limits)
      const dist = 950 + (i % 4) * 60;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = 120 + (i % 5) * 35;
      const radius = 80 + (i % 3) * 25;

      const peakGroup = new THREE.Group();
      peakGroup.position.set(x, 0, z);

      if (theme === 'CYBER') {
        // Distant Mega-Skyscrapers with glowing windows
        const towerW = 45 + (i % 3) * 25;
        const towerH = 180 + (i % 6) * 50;
        const tower = new THREE.Mesh(
          new THREE.BoxGeometry(towerW, towerH, towerW),
          new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.3, metalness: 0.9 })
        );
        tower.position.y = towerH / 2;
        peakGroup.add(tower);

        const neonGlow = new THREE.Mesh(
          new THREE.BoxGeometry(towerW + 2, 6, towerW + 2),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x00f0ff : 0xfacc15 })
        );
        neonGlow.position.y = towerH - 8;
        peakGroup.add(neonGlow);

      } else if (theme === 'FOREST') {
        // Distant Mountain Ridges with pine canopies
        const ridge = new THREE.Mesh(
          new THREE.ConeGeometry(radius, height * 1.1, 7),
          new THREE.MeshStandardMaterial({ color: 0x0d3b26, roughness: 0.95 })
        );
        ridge.position.y = (height * 1.1) / 2;
        peakGroup.add(ridge);

      } else if (theme === 'LAVA') {
        // Smoky Obsidian Volcanoes with glowing golden amber craters
        const volcano = new THREE.Mesh(
          new THREE.CylinderGeometry(radius * 0.25, radius, height, 10),
          new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 })
        );
        volcano.position.y = height / 2;
        peakGroup.add(volcano);

        const magmaCrater = new THREE.Mesh(
          new THREE.CircleGeometry(radius * 0.22, 10).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b })
        );
        magmaCrater.position.y = height + 0.5;
        peakGroup.add(magmaCrater);

      } else if (theme === 'ICE') {
        // Crystalline Glacial Mountain Horns
        const glacier = new THREE.Mesh(
          new THREE.ConeGeometry(radius * 0.85, height * 1.3, 6),
          new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, metalness: 0.4 })
        );
        glacier.position.y = (height * 1.3) / 2;
        peakGroup.add(glacier);
      }

      horizonGroup.add(peakGroup);
    }

    this.trackGroup.add(horizonGroup);
  }

  // --------------------------------------------------------------------------
  // 4. FLOATING CLOUDS
  // --------------------------------------------------------------------------
  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02
    });

    const numClouds = 20;
    for (let i = 0; i < numClouds; i++) {
      const cloud = new THREE.Group();
      cloud.position.set(
        (Math.random() - 0.5) * 1200,
        120 + Math.random() * 80,
        (Math.random() - 0.5) * 1200
      );

      const puffs = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(18 + Math.random() * 15),
          cloudMat
        );
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
  // 5. ROAD SURFACE (High-Grip Asphalt, Themed Kerbs, Road Markings)
  // Perfectly Closed Seamless Circuit Loop with Upward Vertex Normals
  // --------------------------------------------------------------------------
  private buildRoadMesh(): void {
    const half = this.config.roadWidth / 2;
    const positions: number[] = [], colors: number[] = [], uvs: number[] = [];
    const indices: number[] = [];
    const ivory = new THREE.Color(0xf0e8cf);
    const road = this.config.roadColor;
    const slices = [-half - 1.2, -half, -half + .18, -.10, .10, half - .18, half, half + 1.2];
    for (let i = 0; i < this.splineSamples.length; i++) {
      const a = this.splineSamples[i];
      const b = this.splineSamples[(i + 1) % this.splineSamples.length];
      const kerb = Math.floor(i / 2) % 2 ? this.config.kerbColor1 : this.config.kerbColor2;
      const stripe = i % 6 < 2 ? ivory : road;
      const paint = [kerb, ivory, road, stripe, road, ivory, kerb];
      for (let k = 0; k < paint.length; k++) {
        const start = positions.length / 3;
        for (const row of [a, b]) {
          for (const lateral of [slices[k], slices[k + 1]]) {
            const p = row.point.clone().addScaledVector(row.binormal, lateral);
            p.y += Math.abs(lateral) > half ? .09 : .015;
            positions.push(p.x, p.y, p.z); colors.push(paint[k].r, paint[k].g, paint[k].b);
            uvs.push(p.x / 3, p.z / 3);
          }
        }
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices); geom.computeVertexNormals();
    const grain = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < grain.length; i += 4) {
      const value = 213 + ((Math.imul(i + 1, 2654435761) >>> 16) % 43);
      grain.set([value, value, value, 255], i);
    }
    const aggregate = new THREE.DataTexture(grain, 64, 64);
    aggregate.wrapS = aggregate.wrapT = THREE.RepeatWrapping;
    aggregate.generateMipmaps = true;
    aggregate.minFilter = THREE.LinearMipmapLinearFilter;
    aggregate.magFilter = THREE.LinearFilter;
    aggregate.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: aggregate, roughness: .87, metalness: .04 });

    this.roadMesh = new THREE.Mesh(geom, mat);
    this.roadMesh.receiveShadow = true;
    this.trackGroup.add(this.roadMesh);
  }

  // --------------------------------------------------------------------------
  // 6. 3D SOLID CRASH BARRIERS & NEON SAFETY RAILS & CHEVRON ARROWS
  // --------------------------------------------------------------------------
  private buildGuardrails(): void {
    const segments = this.splineSamples.length;
    const halfWidth = this.config.roadWidth / 2;
    const up = new THREE.Vector3(0, 1, 0);

    const barrierGroup = new THREE.Group();
    const leftVertices: number[] = [];
    const rightVertices: number[] = [];
    const barrierIndices: number[] = [];

    const barrierHeight = this.config.theme === 'BEACH' ? .78 : 1.35;

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
      color: 0x0c192c, // Clean deep navy-carbon racing barrier (no dreary gray)
      metalness: 0.75,
      roughness: 0.25,
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

    // High-Visibility Top Safety Rail (Theme-specific color: No pink/purple/red/gray)
    const railColor = this.config.theme === 'CYBER' ? 0x00f0ff :
                      this.config.theme === 'FOREST' ? 0x10b981 :
                      this.config.theme === 'LAVA' ? 0xf59e0b :
                      this.config.theme === 'ICE' ? 0x38bdf8 : 0xf0d2a4; // Monaco Racing Blue

    const topStripMat = new THREE.MeshBasicMaterial({ color: railColor, side: THREE.DoubleSide });

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

      const l1 = point.clone().addScaledVector(binormal, -halfWidth - 1.37).add(new THREE.Vector3(0, barrierHeight + 0.1, 0));
      const l2 = point.clone().addScaledVector(binormal, -halfWidth - 1.13).add(new THREE.Vector3(0, barrierHeight + 0.1, 0));
      leftTopVertices.push(l1.x, l1.y, l1.z);
      leftTopVertices.push(l2.x, l2.y, l2.z);

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
    barrierGroup.add(new THREE.Mesh(leftTopStripGeom, topStripMat));

    rightTopStripGeom.setAttribute('position', new THREE.Float32BufferAttribute(rightTopVertices, 3));
    rightTopStripGeom.setIndex(stripIndices);
    barrierGroup.add(new THREE.Mesh(rightTopStripGeom, topStripMat));

    this.trackGroup.add(barrierGroup);
    if (this.island) return;

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

        const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.1), chevronBackMat);
        signGroup.add(board);

        const chevron = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), chevronMat);
        chevron.position.z = side > 0 ? -0.06 : 0.06;
        if (side > 0) chevron.rotation.y = Math.PI;
        signGroup.add(chevron);

        barrierGroup.add(signGroup);
      });
    });


  }

  // --------------------------------------------------------------------------
  // 7. ROTATING COLLECTIBLE GOLDEN COINS
  // --------------------------------------------------------------------------
  private buildCollectibleCoins(): void {
    const coinGeom = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 18);
    coinGeom.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.92,
      roughness: 0.15,
      emissive: 0x854d0e,
      emissiveIntensity: 0.4
    });

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
  // 8. CHECKPOINTS & BOOST PADS
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

    const padColor = this.config.theme === 'LAVA' ? 0xff4500 : 0x00f0ff;
    const padMat = new THREE.MeshBasicMaterial({ color: padColor, side: THREE.DoubleSide });

    this.config.boostPads.forEach(ptIdx => {
      const t = ptIdx / this.config.points.length;
      const pos = this.curve.getPoint(t);
      const tangent = this.curve.getTangent(t).normalize();

      const pad = new THREE.Mesh(padGeom, padMat);
      pad.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
      pad.rotation.order = 'YXZ';
      pad.rotation.y = Math.atan2(tangent.x, tangent.z);
      pad.rotation.x = -Math.asin(tangent.y);

      const borderGeom = new THREE.RingGeometry(2.4, 2.6, 4);
      borderGeom.rotateX(-Math.PI / 2);
      borderGeom.rotateY(Math.PI / 4);
      const border = new THREE.Mesh(borderGeom, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      border.position.copy(pos).add(new THREE.Vector3(0, 0.08, 0));
      border.rotation.copy(pad.rotation);
      this.trackGroup.add(border);

      this.trackGroup.add(pad);
      this.boostPads.push({ mesh: pad, position: pad.position, direction: tangent });
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
    const postMat = new THREE.MeshStandardMaterial({ color: 0x455662, metalness: .34, roughness: .52 });

    const postGeom = new THREE.BoxGeometry(0.9, 8.0, 0.9);
    const leftPost = new THREE.Mesh(postGeom, postMat);
    leftPost.position.set(-halfW, 4.0, 0);
    gantry.add(leftPost);

    const rightPost = new THREE.Mesh(postGeom, postMat);
    rightPost.position.set(halfW, 4.0, 0);
    gantry.add(rightPost);

    let bannerMat: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    if (typeof document !== 'undefined') {
      const bannerCanvas = document.createElement('canvas');
      bannerCanvas.width = 1024;
      bannerCanvas.height = 256;
      const bCtx = bannerCanvas.getContext('2d')!;

      bCtx.fillStyle = '#1b2a36';
      bCtx.fillRect(0, 0, 1024, 256);
      bCtx.fillStyle = '#f57840';
      bCtx.fillRect(0, 0, 1024, 17);
      bCtx.fillStyle = '#ffebcc';
      bCtx.font = 'italic bold 93px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText('KARTVERSE', 512, 111);
      bCtx.font = 'bold 35px sans-serif';
      bCtx.fillText(this.config.name.toUpperCase(), 512, 188);
      for (const x of [15, 915]) {
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) {
          if ((row + col) % 2 === 0) bCtx.fillRect(x + col * 30, 63 + row * 30, 30, 30);
        }
      }

      const bannerTex = new THREE.CanvasTexture(bannerCanvas);
      bannerTex.colorSpace = THREE.SRGBColorSpace;
      bannerMat.dispose();
      bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, metalness: 0.4, roughness: 0.4 });
    }

    const banner = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 1.2, 2.4, 0.6), bannerMat);
    banner.position.set(0, 6.8, 0);
    gantry.add(banner);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(4.3, .8, .7), postMat);
    bar.position.set(0, 5.23, 0);
    gantry.add(bar);
    for (let p = -1; p <= 1; p++) {
      const lens = new THREE.MeshBasicMaterial({color: 0xb13e26});
      const light = new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.12,12).rotateX(Math.PI/2),lens);
      light.position.set(p * 1.24, 5.24, -.39);
      this.startLights.push(lens);
      gantry.add(light);
    }

    this.trackGroup.add(gantry);
  }

  // --------------------------------------------------------------------------
  // 10. UNIQUE THEMED ENVIRONMENTAL SCENERY (Strict Clearance: ZERO Collisions)
  // --------------------------------------------------------------------------
  private buildThemedScenery(): void {
    const up = new THREE.Vector3(0, 1, 0);
    const halfWidth = this.config.roadWidth / 2;
    const theme = this.config.theme;

    if (theme === 'CYBER') {
      // ----------------------------------------------------------------------
      // TRACK 2: NEON CITY (CYBER METROPOLIS)
      // ----------------------------------------------------------------------
      const towerCount = 40;
      for (let i = 0; i < towerCount; i++) {
        const t = i / towerCount;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        // Strictly offset outside road: halfWidth + 14m to 35m
        const dist = halfWidth + 14.0 + (i % 4) * 5.0;
        const bldgPos = pt.clone().addScaledVector(binormal, side * dist);

        const bldg = this.createCyberBuilding(i);
        bldg.position.copy(bldgPos);
        bldg.rotation.y = Math.atan2(tangent.x, tangent.z);
        this.trackGroup.add(bldg);

        // Holographic Billboards overhead/alongside
        if (i % 6 === 0) {
          const sign = this.createHoloBillboard(i % 3);
          sign.position.copy(pt).addScaledVector(binormal, side * (halfWidth + 4.5)).add(new THREE.Vector3(0, 9.5, 0));
          sign.rotation.y = Math.atan2(tangent.x, tangent.z);
          this.trackGroup.add(sign);
        }
      }

    } else if (theme === 'FOREST') {
      // ----------------------------------------------------------------------
      // TRACK 3: MYSTIC FOREST (ANCIENT ENCHANTED WOODS)
      // ----------------------------------------------------------------------
      const treeCount = 50;
      for (let i = 0; i < treeCount; i++) {
        const t = i / treeCount;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        const dist = halfWidth + 9.5 + (i % 5) * 3.5;
        const propPos = pt.clone().addScaledVector(binormal, side * dist);

        // Giant ancient redwood
        const tree = this.createRedwoodTree();
        tree.position.copy(propPos);
        this.trackGroup.add(tree);

        // Glowing Bioluminescent Mushrooms
        if (i % 3 === 0) {
          const shroom = this.createGlowingMushroom(i);
          shroom.position.copy(pt).addScaledVector(binormal, side * (halfWidth + 3.8));
          this.trackGroup.add(shroom);
        }
      }

    } else if (theme === 'LAVA') {
      // ----------------------------------------------------------------------
      // TRACK 4: VOLCANO RUSH (MOLTEN CALDERA)
      // ----------------------------------------------------------------------
      const spireCount = 45;
      for (let i = 0; i < spireCount; i++) {
        const t = i / spireCount;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        const dist = halfWidth + 12.0 + (i % 4) * 4.5;
        const propPos = pt.clone().addScaledVector(binormal, side * dist);

        // Obsidian spire monolith
        const spire = this.createObsidianSpire(i);
        spire.position.copy(propPos);
        this.trackGroup.add(spire);

        // Glowing lava vent
        if (i % 5 === 0) {
          const vent = this.createMagmaVent();
          vent.position.copy(pt).addScaledVector(binormal, side * (halfWidth + 4.5));
          this.trackGroup.add(vent);
        }
      }

    } else if (theme === 'ICE') {
      // ----------------------------------------------------------------------
      // TRACK 5: FROST PEAK (GLACIAL SUMMIT)
      // ----------------------------------------------------------------------
      const iceCount = 45;
      for (let i = 0; i < iceCount; i++) {
        const t = i / iceCount;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        const dist = halfWidth + 11.5 + (i % 4) * 4.0;
        const propPos = pt.clone().addScaledVector(binormal, side * dist);

        // Crystalline Iceberg
        const iceberg = this.createIceberg(i);
        iceberg.position.copy(propPos);
        this.trackGroup.add(iceberg);

        // Snow-covered alpine pine
        if (i % 3 === 0) {
          const pine = this.createSnowPine();
          pine.position.copy(pt).addScaledVector(binormal, -side * (halfWidth + 5.5));
          this.trackGroup.add(pine);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // PROCEDURAL SCENERY HELPERS (Modular & Clean)
  // --------------------------------------------------------------------------
  private createCyberBuilding(seed: number): THREE.Group {
    const bldg = new THREE.Group();
    const w = 18 + (seed % 3) * 6;
    const h = 45 + (seed % 6) * 15;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25, metalness: 0.85 }));
    body.position.y = h / 2;
    bldg.add(body);

    const neonBandColor = seed % 2 === 0 ? 0x00f0ff : 0xff007f;
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.2, w + 0.6), new THREE.MeshBasicMaterial({ color: neonBandColor }));
    band.position.y = h - 2;
    bldg.add(band);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 12, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9 }));
    antenna.position.set(0, h + 6, 0);
    bldg.add(antenna);
    return bldg;
  }

  private createHoloBillboard(type: number): THREE.Group {
    const board = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(14, 6.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9 }));
    board.add(frame);

    const glowCol = type === 0 ? 0x00f0ff : type === 1 ? 0x38bdf8 : 0xfacc15;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 5.8), new THREE.MeshBasicMaterial({ color: glowCol, transparent: true, opacity: 0.85 }));
    screen.position.z = 0.22;
    board.add(screen);
    return board;
  }

  private createRedwoodTree(): THREE.Group {
    const tree = new THREE.Group();
    const h = 26 + Math.random() * 8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.4, h, 8),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 })
    );
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    for (let c = 0; c < 3; c++) {
      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(6.5 - c * 1.2, 8.5, 7),
        new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.8 })
      );
      foliage.position.y = h * 0.55 + c * 5.5;
      foliage.castShadow = true;
      tree.add(foliage);
    }
    return tree;
  }

  private createGlowingMushroom(seed: number): THREE.Group {
    const shroom = new THREE.Group();
    const stemH = 2.4 + (seed % 3) * 0.8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, stemH, 8), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    stem.position.y = stemH / 2;
    shroom.add(stem);

    const capCol = seed % 2 === 0 ? 0x06b6d4 : 0x10b981; // Cyan & Emerald (no purple)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: capCol, emissive: capCol, emissiveIntensity: 0.55 })
    );
    cap.position.y = stemH;
    shroom.add(cap);
    return shroom;
  }

  private createObsidianSpire(seed: number): THREE.Group {
    const spire = new THREE.Group();
    const h = 22 + (seed % 5) * 6;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, h, 5),
      new THREE.MeshStandardMaterial({ color: 0x18100e, roughness: 0.9, metalness: 0.3 })
    );
    rock.position.y = h / 2;
    rock.rotation.y = seed * 0.7;
    spire.add(rock);
    return spire;
  }

  private createMagmaVent(): THREE.Group {
    const vent = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.4, 8, 12).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x221815 })
    );
    rim.position.y = 0.4;
    vent.add(rim);

    const lavaCore = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b }) // Warm Golden Molten Amber (no red)
    );
    lavaCore.position.y = 0.42;
    vent.add(lavaCore);
    return vent;
  }

  private createIceberg(seed: number): THREE.Group {
    const berg = new THREE.Group();
    const h = 20 + (seed % 4) * 6;
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(h * 0.4, 0),
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        roughness: 0.15,
        metalness: 0.35,
        transparent: true,
        opacity: 0.88
      })
    );
    mesh.position.y = h * 0.35;
    mesh.scale.set(1.1, 1.8, 1.1);
    berg.add(mesh);
    return berg;
  }

  private createSnowPine(): THREE.Group {
    const pine = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 6, 6), new THREE.MeshStandardMaterial({ color: 0x3f2516 }));
    trunk.position.y = 3;
    pine.add(trunk);

    for (let l = 0; l < 3; l++) {
      const tier = new THREE.Mesh(
        new THREE.ConeGeometry(3.8 - l * 0.8, 4.2, 6),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 })
      );
      tier.position.y = 5 + l * 2.8;
      pine.add(tier);
    }
    return pine;
  }

  // --------------------------------------------------------------------------
  // 11. STRICT TRACK CLEARANCE VALIDATION
  // --------------------------------------------------------------------------
  public setStartingLights(countdown: number | null): void {
    this.startLights.forEach((light, i) => {
      light.color.setHex(countdown === 0 || countdown === null ? 0x66dc99 :
        i <= 3 - countdown ? 0xff6837 : 0x563c37);
    });
  }

  public update(delta: number, playerPos: THREE.Vector3): void {
    this.island?.update(delta, playerPos);
    // Other circuits retain their animated ground surface.
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
        if (playerPos.distanceTo(coin.position) < 2.4) {
          coin.collected = true;
          coin.mesh.visible = false;
          audio.playItemCollect();
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 13. TRACK CONSTRAINT & BOUNDARY ENFORCEMENT (PHYSICS & CLAMPING)
  // --------------------------------------------------------------------------
  public getTrackConstraint(kartPos: THREE.Vector3): TrackConstraintResult {
    let best = 0, fraction = 0, minDistance = Infinity;
    for (let i = 0; i < this.splineSamples.length; i++) {
      const a = this.splineSamples[i].point;
      const b = this.splineSamples[(i + 1) % this.splineSamples.length].point;
      const dx = b.x - a.x, dz = b.z - a.z;
      const u = THREE.MathUtils.clamp(((kartPos.x - a.x) * dx + (kartPos.z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const x = kartPos.x - a.x - u * dx, z = kartPos.z - a.z - u * dz;
      const distance = x * x + z * z;
      if (distance < minDistance) { minDistance = distance; best = i; fraction = u; }
    }
    const a = this.splineSamples[best], b = this.splineSamples[(best + 1) % this.splineSamples.length];
    const fineCenter = a.point.clone().lerp(b.point, fraction);
    const tangent = a.tangent.clone().lerp(b.tangent, fraction).normalize();
    const binormal = a.binormal.clone().lerp(b.binormal, fraction).normalize();
    const lateralOffset = kartPos.clone().sub(fineCenter).dot(binormal);

    const roadHalfWidth = this.config.roadWidth / 2;
    const maxBoundary = roadHalfWidth + 0.6;

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
  // 14. STARTING GRID SLOTS (Strictly In-Lane Staggered Grid)
  // --------------------------------------------------------------------------
  public getStartingGrid(): { position: THREE.Vector3; rotationY: number }[] {
    const slots: { position: THREE.Vector3; rotationY: number }[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < 8; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const t = 1 - (18 + row * 6 + (i % 2) * 1.75) / this.curve.getLength();
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const binormal = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const rotY = Math.atan2(tangent.x, tangent.z);

      const pos = pt.clone().addScaledVector(binormal, col * 2.5);
      pos.y = pt.y + 0.25;
      slots.push({ position: pos, rotationY: rotY });
    }

    return slots;
  }
}
