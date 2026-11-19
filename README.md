# 🏁 KARTVERSE — 3D Multiplayer Arcade Racing Game

![Three.js](https://img.shields.io/badge/Three.js-r187-black?style=for-the-badge&logo=three.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?style=for-the-badge&logo=vite)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?style=for-the-badge&logo=socket.io)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)

**KARTVERSE** is a high-octane, browser-based 3D multiplayer arcade kart racing game inspired by *Mario Kart*. Built with Three.js, React 19, TypeScript, and Socket.IO, backed by Supabase PostgreSQL for persistent racer profiles and cloud leaderboards.

---

## 🌟 Key Features

- **🏎️ Arcade Kart Physics & Signed Transmission**:
  - Smooth longitudinal acceleration, aerodynamic drag, and high-speed corner grip.
  - Active braking decelerates to 0 KM/H with positive speed readings.
  - Reverse gear engages from a full stop with dedicated `[R]` HUD indicator.
  - 360° hazard spinout recovery for banana peels, oil slicks, and missile detonations.

- **⚡ 3-Tier Dynamic Drift & Mini-Turbo System**:
  - Hold `Shift` during turns to enter power slides with dynamic chassis tilt and camera roll.
  - **Stage 1 (Blue Sparks)**: 1.2s charge $\rightarrow$ *Mini-Turbo* (+25% boost).
  - **Stage 2 (Purple Sparks)**: 2.4s charge $\rightarrow$ *Super Mini-Turbo* (+45% boost).
  - **Stage 3 (Gold Sparks)**: 3.8s charge $\rightarrow$ *Ultra Mini-Turbo* (+70% boost).

- **🔥 Nitrous Oxide Boost State Machine**:
  - 4-state engine: `READY`, `ACTIVE`, `COOLDOWN`, `RECHARGING`.
  - Press `N` or `F` for immediate +160% forward thrust, +48% top speed, camera FOV kick (+8°), radial speed lines, and twin exhaust thruster flames.

- **🏝️ 5 Handcrafted Circuits & Procedural Splines**:
  - **Sunset Island Circuit** (Harbor straight, coastal esses, headland hairpin, cliff tunnel and cable-stayed crossing).
  - **Neon Cyber City** (Futuristic metropolis with elevated expressways and glowing skyscrapers).
  - **Mystic Forest** (Ancient bioluminescent canopy with glowing mushroom groves).
  - **Volcano Rush** (Infernal volcanic caldera, basalt pillars, and magma rivers).
  - **Frost Peak** (Glacial alpine cavern with low-friction ice chicanes).

- **🛡️ Strict Corridor Clearance & Track Safety**:
  - Automated `TrackValidator` enforces $(roadWidth/2 + 6.0\text{m})$ safety corridor clearance.
  - Zero solid mountain, rock, or tree penetrations on the racing asphalt.
  - Wide arched stone mountain tunnel ($25\text{m}$ span, $12\text{m}$ height) with neon guide rails.

- **🌐 Real-Time Multiplayer (2–8 Racers)**:
  - Private 6-character room codes (e.g. `KV89RT`).
  - Interactive Host Track Card Selection with live real-time sync to all lobby participants.
  - 20Hz UDP-style telemetry synchronization (position, rotation, drift tier, and item events).

- **🎮 8 Arcade Weapons & Items**:
  - Rocket Boost, Energy Shield, Oil Slick, Homing Orb, Lightning Pulse, Turbo Charge, Speed Magnet, and Mystery Box.
  - Dynamic rubberband distribution (catchup items for trailing racers; defensive traps for front runners).

- **☁️ Supabase Cloud Integration**:
  - Persistent user profiles, level progression, and runtime racer name updates.
  - Cloud circuit leaderboards where Supabase grants access, plus recorded finishes on this device.

---

## ⌨️ Controls

| Action | Primary Key | Alternate Key |
| :--- | :--- | :--- |
| **Accelerate / Gas** | <kbd>W</kbd> | <kbd>↑</kbd> |
| **Brake / Reverse** | <kbd>S</kbd> | <kbd>↓</kbd> |
| **Steer Left / Right** | <kbd>A</kbd> / <kbd>D</kbd> | <kbd>←</kbd> / <kbd>→</kbd> |
| **Power Slide / Drift** | <kbd>Shift</kbd> | — |
| **Use Power-Up Item** | <kbd>Space</kbd> | <kbd>E</kbd> |
| **Nitro Boost** | <kbd>N</kbd> | <kbd>F</kbd> |
| **Reset to Track** | <kbd>R</kbd> | — |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (Node.js 20+ recommended)
- npm or pnpm

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YAGNADEEPSINH-4741/KARTVERSE.git
   cd KARTVERSE
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the template and supply your Supabase credentials:
   ```bash
   cp .env.example .env
   ```

4. **Start the Development Servers**:
   ```bash
   # Starts both Vite client (port 3000) and Socket.IO server (port 3001)
   npm start
   ```

5. **Open in Browser**:
   Navigate to `http://localhost:3000`. Set `VITE_SERVER_URL` to use a Socket.IO server. Leave it empty to use Supabase Realtime.

---

## Design and reference study

- [Art direction and component system](docs/ART-DIRECTION.md)
- [Technical and visual references](docs/REFERENCE-STUDY.md)
- [Asset provenance and licenses](ASSET_LICENSES.md)

## 🧪 Testing Suite

Run the automated engine and multiplayer test suites:

```bash
# 1. Core engine, physics, checkpoints & lap progression
npx tsx tests/gameplay.test.ts

# 2. Track barriers, clearance validator & out-of-bounds rescue
npx tsx tests/boundary.test.ts

# 3. Dual-client multiplayer room, host track sync & telemetry
npx tsx tests/multiplayer.test.ts

# 4. Production build check
npm run build
```

---

## 📂 Project Structure

```
├── public/                 # Static assets (3D textures, clean wallpaper, icons)
├── server/                 # Authoritative Socket.IO multiplayer server
│   ├── rooms/              # Room state manager & player sessions
│   └── index.ts            # WebSocket server entry point
├── src/
│   ├── ai/                 # Autonomous AI racers & racing-line navigation
│   ├── audio/              # Procedural Web Audio engine (synthesized RPM, SFX)
│   ├── game/               # Master Three.js GameEngine & chase camera
│   ├── items/              # Power-up items, projectile physics & item boxes
│   ├── multiplayer/        # Socket.IO client & network interpolation
│   ├── racing/             # LapManager, checkpoint state machine & positions
│   ├── store/              # Zustand state store (telemetry, profile, room)
│   ├── supabase/           # Supabase client, auth & leaderboard queries
│   ├── tracks/             # Spline curves, 3D track extrusion & TrackValidator
│   ├── ui/                 # React 19 HUD, Menu, Garage, Lobby & Modals
│   ├── vehicles/           # Kart models, physics, drift & nitro systems
│   ├── App.tsx             # Root screen router & 3D canvas mount
│   └── main.tsx            # Application entry point
├── tests/                  # Headless testing scripts
├── DEVELOPMENT.md          # Detailed engineering architecture
├── ASSET_LICENSES.md       # Asset attribution & licenses
└── package.json
```

---

## 📜 License & Attribution

- Game Source Code: Distributed under the **MIT License**.
- 3D Models & Scenery: CC0 / Permissive open-source assets. See [ASSET_LICENSES.md](ASSET_LICENSES.md) for full licensing details.
