# KARTVERSE — Architecture & Technical Implementation

**KARTVERSE** is a high-performance 3D browser-based arcade multiplayer kart racing game inspired by Mario Kart, built with Three.js, React 19, TypeScript, Zustand, and Socket.IO, backed by Supabase PostgreSQL.

---

## 1. System Architecture

```
                                  +------------------------------+
                                  |     React 19 / Vite UI       |
                                  | (HUD, Garage, Lobby, Screens)|
                                  +--------------+---------------+
                                                 |
                                  +--------------v---------------+
                                  |        Zustand Store         |
                                  | (Telemetry, Rooms, Profile)  |
                                  +--------------+---------------+
                                                 |
                 +-------------------------------+-------------------------------+
                 |                                                               |
  +--------------v---------------+                                +--------------v---------------+
  |       Three.js Engine        |                                |      Multiplayer Socket      |
  | (Renderer, Shadows, Bloom)   |                                |  (Socket.IO Client @ 20Hz)   |
  +--------------+---------------+                                +--------------+---------------+
                 |                                                               |
  +--------------v---------------+                                +--------------v---------------+
  |   Arcade Physics & Tracks    |                                |   Node.js Authority Server   |
  | (Drift, Nitro, Checkpoints)  |                                | (RoomManager, RaceSimulation)|
  +--------------+---------------+                                +--------------+---------------+
                 |                                                               |
  +--------------v---------------+                                +--------------v---------------+
  |  Web Audio Procedural Engine |                                |      Supabase PostgreSQL     |
  |  (RPM synth, boosts, SFX)    |                                | (Auth, RLS, Leaderboards)    |
  +------------------------------+                                +------------------------------+
```

---

## 2. Core Modules

### 2.1 Vehicle Physics & Drift Mechanics (`src/vehicles/`)
- **Signed Longitudinal Velocity & Transmission Gears (`KartPhysics.ts`)**:
  - Forward gear (`speed >= 0`) brakes to 0 cleanly without dipping negative.
  - Reverse gear (`isReversing = true`) engaged only when holding brake while fully stopped.
  - Active reverse acceleration up to -13 m/s (~47 km/h) with positive magnitude displayed alongside an `[R]` gear indicator.
- **3-Tier Advanced Drift System (`DriftSystem.ts`)**:
  - Initiated by holding `Shift` while turning.
  - Dynamic body roll and camera tilt into turns.
  - Progressive particle sparks and mini-turbo boosts:
    - **Stage 1 (Blue Sparks)**: 1.2s charge -> Mini-Turbo (+25% speed for 1.2s)
    - **Stage 2 (Purple Sparks)**: 2.4s charge -> Super Mini-Turbo (+45% speed for 2.2s)
    - **Stage 3 (Gold Sparks)**: 3.8s charge -> Ultra Mini-Turbo (+70% speed for 3.2s)
- **Nitro Boost System (`BoostSystem.ts`)**:
  - State machine: `READY`, `ACTIVE`, `COOLDOWN`, `RECHARGING`.
  - Triggered with `N` or `F`. Increases top speed (+48%) and acceleration (+160%).
  - Dynamic FOV expansion (+8 degrees), speed lines radial overlay, and twin cyan thruster flame cones.
- **3D Procedural Karts (`KartModels.ts`)**:
  - 6 distinct tournament chassis: *Speed Demon, Cyber Glider, Vortex Striker, Quantum Leap, Hyper Drift, Shadow Phantom*.
  - Independent rotating wheels, high-intensity forward headlights, neon cyan underglow, bright red taillights, driver with red hoodie and goggles.

### 2.2 Circuits, Clearance Corridor & Mountain Cavern (`src/tracks/`)
- **Sunset Paradise Tropical Circuit (`TrackData.ts` & `TrackManager.ts`)**:
  - Closed 3D Catmull-Rom spline curve with dense 400-point sampling.
  - Ribbon road mesh with red/white alternating 3D rumble kerbs, yellow dashed centerlines, and asphalt grain.
  - Wooden bridge boardwalk section spanning the turquoise bay with sturdy timber pillars driven into the seabed.
  - Cascading rock gorge and crystal blue waterfall jump section.
  - Historic nautical lighthouse on coastal bluff with spinning 3D searchlight beacon.
  - Floating sky island with ancient stone temple and striped sunset hot air balloon.
- **Corridor Clearance & Mountain Tunnel (`TrackValidator.ts`)**:
  - Strict $(roadWidth / 2 + 6.0m) = 14.0m$ clearance corridor enforcement.
  - Zero solid mountain, tree, or rock collisions with the racing surface.
  - Grand Arched Mountain Cavern Tunnel ($25m$ span, $12m$ height) allowing karts to drive through the mountain interior with stone buttresses and neon guide rails.
  - Automated `TrackValidator` runs at initialization with 0 clearance violations reported.

### 2.3 Checkpoint State Machine & Lap Manager (`src/racing/`)
- **Lap Detection (`LapManager.ts`)**:
  - State machine: `WAITING_FOR_START` -> `RACING` -> sequential checkpoints -> `LAP_COMPLETED` -> `RACE_FINISHED`.
  - Sequential in-order checkpoint traversal with lookahead tolerance window.
  - Anti-cheat requirement: at least 80% of track checkpoints must be logged before the finish line triggers a lap completion.
  - Debounce cooldown (10s) and start line crossing exclusion at countdown `GO!`.
  - Real-time wrong-way detection using spline tangent dot products.

### 2.4 Multiplayer Lobby & Host Track Selection (`src/ui/MultiplayerLobby.tsx`)
- **Host Track Card Selector**:
  - 5 interactive cards: Sunset Paradise, Neon Cyber City, Mystic Forest, Volcano Rush, Frozen Kingdom.
  - Real-time multi-client synchronization via Socket.IO (`select_track` -> `room_updated`).
  - Non-host players see the selected track card update with live sync badge.
  - Host-only permission check enforced on both frontend and server.

### 2.5 Cloud Database Persistence (`src/supabase/`)
- **Supabase PostgreSQL Integration**:
  - Tables: `tracks`, `game_rooms`, `room_players`, `race_results`, `player_stats`.
  - User profiles with runtime name editing persisted across sessions.
  - Row Level Security (RLS) policies allowing public anonymous and authenticated access.

---

## 3. Testing & Verification

Run the core engine, boundary physics, and multiplayer test suites:

```bash
# 1. Gameplay, physics & lap manager tests
npx tsx tests/gameplay.test.ts

# 2. Track barrier collisions & clamping tests
npx tsx tests/boundary.test.ts

# 3. Multiplayer dual-client room & sync tests
npx tsx tests/multiplayer.test.ts
```

All 3 automated test suites pass with 100% success.
