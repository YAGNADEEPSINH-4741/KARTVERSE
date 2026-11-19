# KARTVERSE — Asset Manifest & Open-Source Licenses

KartVerse builds the racing world and playable vehicles from local Three.js geometry. The website serves its art and fonts from the application bundle.

## Sunset Island release assets

| Shipped file | Provenance |
|---|---|
| `public/assets/images/sunset-island-hero.webp` | Original KartVerse promotional illustration, created with the built-in OpenAI image generation tool. The brief specified a low front three-quarter view of an orange open-wheel kart with vented side pods and a rear wing, a red-suited driver, a coastal bridge, turquoise water and a shaded left foreground for the page title. The input was text only. |
| `public/assets/karts/*.webp` | Six transparent Three.js studio captures of the six playable body kits in `src/vehicles/KartModels.ts`. Geometry, paint, driver and wheel details come from the game factory. The studio lighting uses the Three.js MIT-licensed procedural RoomEnvironment. |
| `public/assets/circuits/*.webp` | Five scene captures from KartVerse's own TrackManager. The Sunset Island capture frames the cable crossing, upper road and lagoon. |
| `public/assets/fonts/*.woff2` | Locally served Rajdhani, Inter and Oxanium fonts distributed under the SIL Open Font License 1.1. The corresponding copyright and license notices are bundled beside the font files. [Rajdhani notice](public/assets/fonts/Rajdhani-OFL.txt) · [Inter notice](public/assets/fonts/Inter-OFL.txt) · [Oxanium notice](public/assets/fonts/Oxanium-OFL.txt) |

The asset study reviewed terrain materials, road props and tropical vegetation from public catalogs. The new artwork and course use project-specific meshes and materials. The selected examples and their terms are recorded in the [reference study](docs/REFERENCE-STUDY.md).

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
| **Sunset Island Circuit**  | KartVerse course, terrain, water, bridge and tunnel meshes | Original project geometry | Procedural spline and instanced scenery | Generated at runtime | Harbor start, rising headland corners and cable-stayed crossing |
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

