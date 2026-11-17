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

export const TRACKS: Record<string, TrackConfig> = {
  sunset_coast: {
    id: 'sunset_coast',
    name: 'Sunset Paradise',
    tagline: 'Sun-drenched tropical paradise with waterfall jump, mountain tunnel & ocean bridge',
    theme: 'BEACH',
    difficulty: 'EASY',
    laps: 3,
    roadWidth: 16.0,
    skyColor: new THREE.Color(0x0284c7),       // Crisp Azure Blue
    horizonColor: new THREE.Color(0xbae6fd),   // Warm Golden Horizon
    sunPosition: new THREE.Vector3(260, 140, -320), // Natural golden daylight
    roadColor: new THREE.Color(0x0b1120),      // Deep Obsidian Asphalt
    kerbColor1: new THREE.Color(0x0284c7),     // Monaco Racing Blue
    kerbColor2: new THREE.Color(0xffffff),     // Crisp Alpine White
    terrainColor: new THREE.Color(0xfde047),   // Warm Golden Beach Sand
    points: [
      new THREE.Vector3(0, 0, 0),             // 0. Finish line & Starting Gantry
      new THREE.Vector3(0, 0, 80),            // 1. Home straight
      new THREE.Vector3(0, 0, 160),           // 2. Home straight exit
      new THREE.Vector3(55, 0.5, 235),        // 3. Turn 1 wide coastal turn entry
      new THREE.Vector3(150, 1.2, 280),       // 4. Turn 1 apex
      new THREE.Vector3(245, 2.0, 240),       // 5. Palm forest section
      new THREE.Vector3(315, 7.5, 140),       // 6. Waterfall jump hill crest
      new THREE.Vector3(345, 2.0, 35),        // 7. Waterfall jump landing
      new THREE.Vector3(315, 0.5, -75),       // 8. Mountain tunnel entrance
      new THREE.Vector3(215, 0.5, -170),      // 9. Mountain tunnel exit
      new THREE.Vector3(105, 2.2, -240),      // 10. Ocean bridge boardwalk entrance
      new THREE.Vector3(-45, 2.2, -230),      // 11. Ocean bridge boardwalk exit
      new THREE.Vector3(-145, 1.0, -160),     // 12. Nitro boost coastal straight
      new THREE.Vector3(-95, 0.5, -160),      // 13. Approach to home straight
      new THREE.Vector3(0, 0, -80)            // 14. Home straight entry
    ],
    boostPads: [4, 8, 12],
    itemBoxClusters: [2, 5, 10]
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

