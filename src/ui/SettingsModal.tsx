// ============================================================================
// KARTVERSE — Audio, Graphics & Keybinding Configuration Screen
// ============================================================================

import React from 'react';
import { useGameStore, GraphicsQuality } from '../store/gameStore';
import { audio } from '../audio/AudioManager';

export const SettingsModal: React.FC = () => {
  const setScreen = useGameStore(state => state.setScreen);
  const masterVolume = useGameStore(state => state.masterVolume);
  const setMasterVolume = useGameStore(state => state.setMasterVolume);
  const musicVolume = useGameStore(state => state.musicVolume);
  const setMusicVolume = useGameStore(state => state.setMusicVolume);
  const sfxVolume = useGameStore(state => state.sfxVolume);
  const setSfxVolume = useGameStore(state => state.setSfxVolume);
  const graphicsQuality = useGameStore(state => state.graphicsQuality);
  const setGraphicsQuality = useGameStore(state => state.setGraphicsQuality);

  const qualities: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-8 md:p-12 z-10 select-none overflow-hidden bg-slate-950/80 backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center w-full">
        <div>
          <button
            onClick={() => setScreen('MENU')}
            className="text-xs uppercase font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-2"
          >
            ← BACK TO MENU
          </button>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
            GAME SETTINGS
          </h1>
        </div>

        <button
          onClick={() => {
            audio.playMenuClick();
            setScreen('MENU');
          }}
          className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black italic text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
        >
          APPLY & CLOSE
        </button>
      </div>

      {/* Settings Grid */}
      <div className="my-auto grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full mx-auto">
        {/* Left Column: Audio & Graphics */}
        <div className="space-y-6 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-black italic text-white flex items-center gap-2">
            <span>🔊</span> AUDIO & PERFORMANCE
          </h2>

          {/* Master Volume */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
              <span>MASTER VOLUME</span>
              <span className="font-mono">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMasterVolume(v);
                audio.setMasterVolume(v);
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* SFX Volume */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
              <span>SFX & MOTOR ENGINE VOLUME</span>
              <span className="font-mono">{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfxVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setSfxVolume(v);
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Music Volume */}
          <div>
            <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
              <span>MUSIC VOLUME</span>
              <span className="font-mono">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>

          {/* Graphics Quality */}
          <div className="pt-4 border-t border-slate-800">
            <div className="text-xs font-bold text-slate-300 mb-3">GRAPHICS PRESET</div>
            <div className="grid grid-cols-4 gap-2">
              {qualities.map(q => (
                <button
                  key={q}
                  onClick={() => {
                    audio.playMenuClick();
                    setGraphicsQuality(q);
                  }}
                  className={`py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                    graphicsQuality === q
                      ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Keybinding Cheatsheet */}
        <div className="space-y-4 bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-3xl p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-black italic text-white flex items-center gap-2 mb-4">
              <span>🎮</span> CONTROLS CHEATSHEET
            </h2>

            <div className="space-y-3">
              {[
                { action: 'ACCELERATE', keys: ['W', '↑'] },
                { action: 'BRAKE / REVERSE', keys: ['S', '↓'] },
                { action: 'STEER LEFT / RIGHT', keys: ['A / D', '← / →'] },
                { action: 'POWER SLIDE DRIFT', keys: ['SHIFT'] },
                { action: 'USE POWER-UP ITEM', keys: ['SPACE', 'E'] },
                { action: 'NITRO BOOST SURGE', keys: ['N', 'F'] },
                { action: 'RESET KART ON TRACK', keys: ['R'] }
              ].map(ctrl => (
                <div
                  key={ctrl.action}
                  className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800"
                >
                  <span className="text-xs font-extrabold text-slate-300 uppercase">{ctrl.action}</span>
                  <div className="flex gap-1.5">
                    {ctrl.keys.map(k => (
                      <kbd key={k} className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-xs font-bold shadow-sm">
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300">
            💡 <strong>Pro Tip:</strong> Hold <kbd className="bg-cyan-900 px-1 py-0.5 rounded">SHIFT</kbd> into a turn to initiate a power slide. Maintain the drift to charge up Blue, Orange and Purple mini-turbo boost discharges!
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        Preferences persist in local session storage.
      </div>
    </div>
  );
};

