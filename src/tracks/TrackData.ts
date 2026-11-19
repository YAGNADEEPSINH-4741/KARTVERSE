// ============================================================================
// KARTVERSE — 5 Original Racing Tracks Specifications & Spline Curves
// ============================================================================

import * as THREE from 'three';

export interface TrackConfig {
  id: string;
  name: string;
  tagline: string;
  theme: 'BEACH' | 'CYBER' | 'FOREST' | 'LAVA' | 'ICE';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  laps: number;
  roadWidth: number;
  skyColor: THREE.Color;
  horizonColor: THREE.Color;
  sunPosition: THREE.Vector3;
  roadColor: THREE.Color;
  kerbColor1: THREE.Color;
  kerbColor2: THREE.Color;
  terrainColor: THREE.Color;
  points: THREE.Vector3[];
  boostPads: number[]; // Spline indices
  itemBoxClusters: number[]; // Spline indices
}

/** All track consumers use the same closed centerline and arc-length table. */
export function createTrackCurve(config: TrackConfig): THREE.CatmullRomCurve3 {
  const curve = new THREE.CatmullRomCurve3(config.points, true, 'centripetal');
  curve.arcLengthDivisions = 1024;
  return curve;
}

export const TRACKS: Record<string, TrackConfig> = {
  sunset_coast: {
    id: 'sunset_coast',
    name: 'Sunset Island Circuit',
    tagline: 'Harbor grid, headland hairpin and a high crossing over the lagoon',
    theme: 'BEACH',
    difficulty: 'MEDIUM',
    laps: 3,
    roadWidth: 16,
    skyColor: new THREE.Color(0x759aac),
    horizonColor: new THREE.Color(0xffbb96),
    sunPosition: new THREE.Vector3(-230, 108, 640),
    roadColor: new THREE.Color(0x393e43),
    kerbColor1: new THREE.Color(0xff713c),
    kerbColor2: new THREE.Color(0xffebce),
    terrainColor: new THREE.Color(0xe4bb89),
    points: [
      // The quay straight runs north, then folds into rising island esses.
      [0, 2, 0], [0, 2, 88], [22, 3, 143], [74, 7, 158],
      [115, 13, 135], [151, 18, 145], [174, 22, 190],
      // Ocean overlook: a tight but two-lane descending hairpin.
      [192, 25, 233], [224, 26, 235], [236, 23, 208], [211, 19, 165],
      [204, 14, 114], [235, 10, 70], [272, 7, 43],
      // The basalt gallery drops onto a long westbound cable crossing.
      [280, 6, -14], [249, 8, -75], [201, 11, -105],
      [125, 14, -109], [47, 13, -109], [-17, 9, -105],
      // A second switchback brings the field past the harbor grandstand.
      [-63, 6, -117], [-86, 3, -96], [-78, 2, -70],
      [-43, 2, -63], [-13, 2, -51], [0, 2, -28]
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    boostPads: [2, 12, 18],
    itemBoxClusters: [3, 10, 20]
  },

  neon_city: {
    id: 'neon_city',
    name: 'Neon City',
    tagline: 'Futuristic metropolis with elevated glass expressways',
    theme: 'CYBER',
    difficulty: 'MEDIUM',
    laps: 3,
    roadWidth: 17.0,
    skyColor: new THREE.Color(0x020617),       // Midnight Navy
    horizonColor: new THREE.Color(0x0c274e),   // Royal Blue Skyline
    sunPosition: new THREE.Vector3(0, -50, 0), // Night
    roadColor: new THREE.Color(0x08101e),      // Navy Carbon Road
    kerbColor1: new THREE.Color(0x00f0ff),     // Electric Cyan
    kerbColor2: new THREE.Color(0xffffff),     // Clean White
    terrainColor: new THREE.Color(0x050b14),
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(80, 4, 150),
      new THREE.Vector3(200, 12, 190),
      new THREE.Vector3(320, 14, 110),
      new THREE.Vector3(380, 8, -20),
      new THREE.Vector3(280, 4, -140),
      new THREE.Vector3(140, 0, -220),
      new THREE.Vector3(-60, 4, -240),
      new THREE.Vector3(-180, 8, -140),
      new THREE.Vector3(-160, 4, -20)
    ],
    boostPads: [3, 7],
    itemBoxClusters: [1, 4, 8]
  },

  mystic_forest: {
    id: 'mystic_forest',
    name: 'Mystic Forest',
    tagline: 'Ancient bioluminescent canopy with glowing mushroom groves',
    theme: 'FOREST',
    difficulty: 'MEDIUM',
    laps: 3,
    roadWidth: 15.0,
    skyColor: new THREE.Color(0x064e3b),       // Lush Pine
    horizonColor: new THREE.Color(0x34d399),   // Sunlit Meadow Green
    sunPosition: new THREE.Vector3(120, 80, 150),
    roadColor: new THREE.Color(0x0f2417),      // Forest Earth Road
    kerbColor1: new THREE.Color(0x10b981),     // Racing Emerald
    kerbColor2: new THREE.Color(0xffffff),     // Crisp White
    terrainColor: new THREE.Color(0x047857),   // Rich Moss
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(70, 2, 130),
      new THREE.Vector3(170, 6, 210),
      new THREE.Vector3(280, 8, 140),
      new THREE.Vector3(240, 4, 20),
      new THREE.Vector3(330, 2, -90),
      new THREE.Vector3(220, 0, -180),
      new THREE.Vector3(80, 3, -190),
      new THREE.Vector3(-80, 5, -130),
      new THREE.Vector3(-120, 2, -40)
    ],
    boostPads: [2, 5],
    itemBoxClusters: [1, 3, 7]
  },

  volcano_rush: {
    id: 'volcano_rush',
    name: 'Volcano Rush',
    tagline: 'High-adrenaline circuit over bubbling magma calderas',
    theme: 'LAVA',
    difficulty: 'HARD',
    laps: 3,
    roadWidth: 16.0,
    skyColor: new THREE.Color(0x1c1917),       // Obsidian Basalt Sky
    horizonColor: new THREE.Color(0xb45309),   // Warm Golden Amber
    sunPosition: new THREE.Vector3(-150, 70, -200),
    roadColor: new THREE.Color(0x0c0a09),      // Dark Obsidian Road
    kerbColor1: new THREE.Color(0xf59e0b),     // Racing Amber / Gold
    kerbColor2: new THREE.Color(0xffffff),     // Crisp White
    terrainColor: new THREE.Color(0x78350f),   // Warm Copper Bedrock
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(90, 5, 140),
      new THREE.Vector3(220, 15, 230),
      new THREE.Vector3(340, 18, 150),
      new THREE.Vector3(300, 10, 0),
      new THREE.Vector3(360, 4, -130),
      new THREE.Vector3(210, 0, -230),
      new THREE.Vector3(70, 4, -250),
      new THREE.Vector3(-90, 8, -170),
      new THREE.Vector3(-150, 4, -50)
    ],
    boostPads: [2, 6],
    itemBoxClusters: [1, 4, 8]
  },

  frost_peak: {
    id: 'frost_peak',
    name: 'Frost Peak',
    tagline: 'Glacial summit hairpins with frozen ice tunnels',
    theme: 'ICE',
    difficulty: 'EXPERT',
    laps: 3,
    roadWidth: 16.5,
    skyColor: new THREE.Color(0x0284c7),       // Pure Alpine Blue Sky
    horizonColor: new THREE.Color(0xe0f2fe),   // Glacier White Horizon
    sunPosition: new THREE.Vector3(200, 90, 200),
    roadColor: new THREE.Color(0x0f172a),      // Glacial Track
    kerbColor1: new THREE.Color(0x38bdf8),     // Glacial Sky Blue
    kerbColor2: new THREE.Color(0xffffff),     // Alpine White
    terrainColor: new THREE.Color(0xf0fdf4),   // Pristine White Snow
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(80, 4, 130),
      new THREE.Vector3(180, 12, 220),
      new THREE.Vector3(300, 16, 170),
      new THREE.Vector3(260, 8, 20),
      new THREE.Vector3(320, 2, -100),
      new THREE.Vector3(190, 0, -200),
      new THREE.Vector3(50, 4, -220),
      new THREE.Vector3(-90, 8, -160),
      new THREE.Vector3(-130, 3, -30)
    ],
    boostPads: [3, 7],
    itemBoxClusters: [1, 4, 8]
  }
};

