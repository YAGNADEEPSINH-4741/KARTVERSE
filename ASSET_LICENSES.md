# KARTVERSE — Asset Manifest & Open-Source Licenses

All procedural geometries, textures, audio synthesizers, and shaders in **KARTVERSE** are engineered for 0-byte external network overhead, maximum WebGL performance, and clean open-source compliance.

---

## 1. Asset & Subsystem Manifest

| Asset / System | Original Source / Tech | License | Format | Size | Intended Usage |
|---|---|---|---|---|---|
| **Speed Demon 3D Model** | Procedural Three.js Parametric Mesh | MIT (Original) | Procedural BufferGeometry | ~2 KB (Code) | Formula aero tournament kart |
| **Cyber Glider 3D Model** | Procedural Three.js Parametric Mesh | MIT (Original) | Procedural BufferGeometry | ~2 KB (Code) | High-agility neon hover-blade |
| **Vortex Striker 3D Model**| Procedural Three.js Parametric Mesh | MIT (Original) | Procedural BufferGeometry | ~2 KB (Code) | Heavyweight battering ram chassis |
| **Quantum Leap 3D Model**  | Procedural Three.js Parametric Mesh | MIT (Original) | Procedural BufferGeometry | ~2 KB (Code) | High-tech hypercar prototype |
| **Hyper Drift 3D Model**   | Procedural Three.js Parametric Mesh | MIT (Original) | Procedural BufferGeometry | ~2 KB (Code) | JDM drift roadster chassis |
| **Shadow Phantom 3D Model**| Procedural Three.js Parametric Mesh | MIT (Original) | Procedural BufferGeometry | ~2 KB (Code) | Stealth all-round interceptor |
| **Sunset Coast Circuit**   | CatmullRomCurve3 Ribbon Extrusion  | CC0 (Original) | Procedural Spline Mesh | ~4 KB (Code) | Tropical beach circuit with ocean jumps |
| **Neon City Circuit**      | CatmullRomCurve3 Ribbon Extrusion  | CC0 (Original) | Procedural Spline Mesh | ~4 KB (Code) | Cyberpunk city with illuminated skyscrapers |
| **Mystic Forest Circuit**  | CatmullRomCurve3 Ribbon Extrusion  | CC0 (Original) | Procedural Spline Mesh | ~4 KB (Code) | Forest circuit with giant flora |
| **Volcano Rush Circuit**   | CatmullRomCurve3 Ribbon Extrusion  | CC0 (Original) | Procedural Spline Mesh | ~4 KB (Code) | Magma chasm circuit with basalt rocks |
| **Frost Peak Circuit**     | CatmullRomCurve3 Ribbon Extrusion  | CC0 (Original) | Procedural Spline Mesh | ~4 KB (Code) | Glacial mountain circuit with ice crystals |
| **8 Power-Up Weapons**    | Procedural Holographic Meshes      | MIT (Original) | Three.js Meshes & Sprites | ~3 KB (Code) | Item boxes, rockets, shields, oil traps |
| **Kart Engine RPM Audio**  | Web Audio API Dual Saw/Triangle    | CC0 (Original) | Procedural Audio Synthesis | 0 bytes | Dynamic RPM engine audio synthesis |
| **Drift Spark SFX**        | Web Audio API Exponential Chirp    | CC0 (Original) | Procedural Audio Synthesis | 0 bytes | 3-stage mini-turbo charge frequencies |
| **Countdown & Boost SFX**  | Web Audio API Polyphonic Synth     | CC0 (Original) | Procedural Audio Synthesis | 0 bytes | 3.. 2.. 1.. GO! & turbo boosts |
| **Dynamic BGM Theme**      | Web Audio API 4-Voice Chord Synth  | CC0 (Original) | Procedural Audio Synthesis | 0 bytes | Arcade racing soundtrack |

---

## 2. Open-Source Libraries & Dependencies

- **Three.js** (`three`) — MIT License (Mr.doob and Three.js contributors)
- **React 19** (`react`, `react-dom`) — MIT License (Meta Platforms, Inc.)
- **Zustand** (`zustand`) — MIT License (Paul Henschel and Zustand contributors)
- **Vite** (`vite`) — MIT License (Evan You and Vite contributors)
- **Socket.IO** (`socket.io`, `socket.io-client`) — MIT License (Guillermo Rauch and Socket.IO contributors)
- **Supabase JS Client** (`@supabase/supabase-js`) — MIT License (Supabase Inc.)
- **Howler.js** (`howler`) — MIT License (James Simpson and GoldFire Studios)
- **Lucide Icons** (`lucide-react`) — ISC License (Lucide Contributors)
- **Tailwind CSS** — MIT License (Tailwind Labs, Inc.)

---

## 3. Remote Database & API Attributions

- **Supabase Cloud Project**:
  - URL: `https://rlclbbnvciqnxmppjavr.supabase.co`
  - Region: `ap-south-1`
  - PostgreSQL with Row-Level Security (RLS) policies protecting tables (`karts`, `tracks`, `profiles`, `game_rooms`, `race_results`, `player_stats`).
  - No remote service-role keys are exposed in client-facing bundles.

