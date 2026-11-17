// ============================================================================
// KARTVERSE — 3D Garage & Vehicle Customization Center
// Live Real-Time 3D Showcase with Tuning Controls
// ============================================================================

import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { audio } from '../audio/AudioManager';

interface KartCatalogItem {
  id: string;
  name: string;
  tagline: string;
  type: string;
  stats: {
    speed: number;
    accel: number;
    handling: number;
    drift: number;
    weight: number;
  };
}

const KARTS: KartCatalogItem[] = [
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    tagline: 'Streamlined Formula Aero racer built for blistering straightaways',
    type: 'Speed',
    stats: { speed: 95, accel: 85, handling: 78, drift: 80, weight: 65 }
  },
  {
    id: 'cyber_glider',
    name: 'Cyber Glider',
    tagline: 'Futuristic neon hover-blade with razor-sharp cornering agility',
    type: 'Handling',
    stats: { speed: 82, accel: 90, handling: 96, drift: 88, weight: 60 }
  },
  {
    id: 'vortex_striker',
    name: 'Vortex Striker',
    tagline: 'Armored heavyweight wedge that shoves opponents and holds the road',
    type: 'Heavy',
    stats: { speed: 90, accel: 72, handling: 70, drift: 75, weight: 95 }
  },
  {
    id: 'quantum_leap',
    name: 'Quantum Leap',
    tagline: 'High-tech prototype with explosive mini-turbo boost discharges',
    type: 'Boost',
    stats: { speed: 88, accel: 94, handling: 84, drift: 92, weight: 68 }
  },
  {
    id: 'hyper_drift',
    name: 'Hyper Drift',
    tagline: 'JDM-inspired tuner tuned for prolonged purple mini-turbo slides',
    type: 'Drift',
    stats: { speed: 85, accel: 86, handling: 89, drift: 98, weight: 70 }
  },
  {
    id: 'shadow_phantom',
    name: 'Shadow Phantom',
    tagline: 'Stealth interceptor chassis with balanced all-round championship specs',
    type: 'Balanced',
    stats: { speed: 88, accel: 88, handling: 88, drift: 88, weight: 72 }
  }
];

const PAINT_PALETTE = [
  { name: 'Neon Cyan', hex: '#00f0ff' },
  { name: 'Lava Red', hex: '#ff3b30' },
  { name: 'Solar Yellow', hex: '#ffcc00' },
  { name: 'Ultraviolet', hex: '#af52de' },
  { name: 'Emerald Flash', hex: '#34c759' },
  { name: 'Blazing Orange', hex: '#ff9500' },
  { name: 'Stealth Black', hex: '#222222' }
];

export const Garage: React.FC = () => {
  const setScreen = useGameStore(state => state.setScreen);
  const selectedKart = useGameStore(state => state.selectedKart);
  const setSelectedKart = useGameStore(state => state.setSelectedKart);
  const kartColor = useGameStore(state => state.kartColor);
  const setKartColor = useGameStore(state => state.setKartColor);

  const [activeKartId, setActiveKartId] = useState(selectedKart);
  const [activeColor, setActiveColor] = useState(kartColor);

  const currentKart = KARTS.find(k => k.id === activeKartId) || KARTS[0];

  const handleSelectKart = (id: string) => {
    audio.playMenuClick();
    setActiveKartId(id);
    setSelectedKart(id); // Instantly updates the live 3D showroom kart!
  };

  const handleSelectColor = (hex: string) => {
    audio.playMenuClick();
    setActiveColor(hex);
    setKartColor(hex); // Instantly updates the 3D paint!
  };

  const handleApply = () => {
    audio.playMenuClick();
    setSelectedKart(activeKartId);
    setKartColor(activeColor);
    setScreen('MENU');
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-8 md:p-12 z-10 select-none overflow-hidden bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-slate-950/90 pointer-events-none">
      {/* Header */}
      <div className="flex justify-between items-center w-full pointer-events-auto">
        <div>
          <button
            onClick={() => setScreen('MENU')}
            className="text-xs uppercase font-extrabold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-1.5"
          >
            ← BACK TO MENU
          </button>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-yellow-300 to-pink-400">
            KART TUNING GARAGE
          </h1>
        </div>

        <button
          onClick={handleApply}
          className="px-7 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black italic text-sm tracking-wider uppercase shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-all cursor-pointer"
        >
          SAVE & EQUIP
        </button>
      </div>

      {/* Main Showcase Layout (Split panels leaving center open for 3D kart view) */}
      <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-7xl mx-auto pointer-events-auto">
        {/* Left Column: Kart Select List */}
        <div className="lg:col-span-4 flex flex-col gap-2.5 overflow-y-auto max-h-[520px] pr-2">
          <div className="text-xs font-black uppercase tracking-wider text-cyan-400 mb-1">SELECT CHASSIS</div>
          {KARTS.map(k => (
            <button
              key={k.id}
              onClick={() => handleSelectKart(k.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between backdrop-blur-md ${
                activeKartId === k.id
                  ? 'bg-cyan-950/60 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="text-[10px] uppercase font-black text-cyan-400">{k.type} CLASS</div>
                <div className="text-lg font-black italic text-white">{k.name}</div>
              </div>
              <span className="text-2xl">🏎️</span>
            </button>
          ))}
        </div>

        {/* Center: Open Space for live 3D Turntable view! */}
        <div className="hidden lg:block lg:col-span-4" />

        {/* Right Column: Performance Stats & Paint Customizer */}
        <div className="lg:col-span-4 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {currentKart.type} SPECIFICATION
                </span>
                <h2 className="text-2xl font-black italic text-white mt-2">{currentKart.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{currentKart.tagline}</p>
              </div>

              {/* Paint preview indicator badge */}
              <div
                className="w-11 h-11 rounded-xl border-2 border-white/40 shadow-xl flex items-center justify-center text-lg"
                style={{ backgroundColor: activeColor }}
              >
                🏁
              </div>
            </div>

            {/* Performance Stat Bars */}
            <div className="mt-6 space-y-3">
              {[
                { label: 'TOP SPEED', value: currentKart.stats.speed, color: 'bg-red-500' },
                { label: 'ACCELERATION', value: currentKart.stats.accel, color: 'bg-yellow-400' },
                { label: 'HANDLING', value: currentKart.stats.handling, color: 'bg-cyan-400' },
                { label: 'DRIFT GRIP', value: currentKart.stats.drift, color: 'bg-purple-500' },
                { label: 'WEIGHT / MOMENTUM', value: currentKart.stats.weight, color: 'bg-blue-500' }
              ].map(stat => (
                <div key={stat.label}>
                  <div className="flex justify-between text-[11px] font-extrabold text-slate-300 mb-1">
                    <span>{stat.label}</span>
                    <span className="font-mono">{stat.value}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full ${stat.color} rounded-full transition-all duration-300`}
                      style={{ width: `${stat.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Paint Customizer Palette */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="text-[11px] font-extrabold uppercase text-slate-400 mb-2.5">CUSTOM CHASSIS PAINT</div>
            <div className="flex flex-wrap gap-2.5 items-center">
              {PAINT_PALETTE.map(paint => (
                <button
                  key={paint.hex}
                  onClick={() => handleSelectColor(paint.hex)}
                  title={paint.name}
                  className={`w-8 h-8 rounded-lg transition-all cursor-pointer ${
                    activeColor === paint.hex
                      ? 'scale-125 ring-2 ring-white shadow-[0_0_12px_rgba(255,255,255,0.7)]'
                      : 'hover:scale-110 opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: paint.hex }}
                />
              ))}

              {/* Hex Custom Picker */}
              <input
                type="color"
                value={activeColor}
                onChange={(e) => handleSelectColor(e.target.value)}
                className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-0"
                title="Custom Hex Color"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 pointer-events-auto">
        Live 3D showroom rotates selected vehicle in real time.
      </div>
    </div>
  );
};
