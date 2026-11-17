// ============================================================================
// KARTVERSE — Track Selection Screen (5 Diverse Biomes)
// ============================================================================

import React from 'react';
import { useGameStore } from '../store/gameStore';
import { TRACKS } from '../tracks/TrackData';
import { audio } from '../audio/AudioManager';

export const TrackSelect: React.FC = () => {
  const setScreen = useGameStore(state => state.setScreen);
  const selectedTrack = useGameStore(state => state.selectedTrack);
  const setSelectedTrack = useGameStore(state => state.setSelectedTrack);

  const tracksList = Object.values(TRACKS);

  const handleSelectAndRace = (trackId: string) => {
    audio.playMenuClick();
    setSelectedTrack(trackId);
    setScreen('QUICK_RACE');
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'EASY':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'HARD':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      default:
        return 'bg-red-500/20 text-red-400 border-red-500/40';
    }
  };

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
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-300">
            CIRCUIT SELECTION
          </h1>
        </div>
      </div>

      {/* Track Grid */}
      <div className="my-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-6xl w-full mx-auto">
        {tracksList.map(t => {
          const isSelected = selectedTrack === t.id;
          return (
            <div
              key={t.id}
              onClick={() => {
                audio.playMenuClick();
                setSelectedTrack(t.id);
              }}
              className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.35)] scale-105'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:scale-102'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${getDifficultyBadge(t.difficulty)}`}>
                    {t.difficulty}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{t.laps} LAPS</span>
                </div>

                <div className="w-full h-28 rounded-2xl mb-4 flex items-center justify-center text-4xl shadow-inner bg-slate-950/80 border border-slate-800">
                  {t.theme === 'BEACH' && '🏖️'}
                  {t.theme === 'CYBER' && '🌆'}
                  {t.theme === 'FOREST' && '🌲'}
                  {t.theme === 'LAVA' && '🌋'}
                  {t.theme === 'ICE' && '❄️'}
                </div>

                <h3 className="text-xl font-black italic text-white">{t.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{t.tagline}</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectAndRace(t.id);
                }}
                className={`mt-5 w-full py-2.5 rounded-xl text-xs font-black italic tracking-wider uppercase transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_15px_#00f0ff]'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isSelected ? 'RACE NOW 🏁' : 'SELECT'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-slate-500">
        Each circuit features distinct surface friction, elevation changes and boost clusters.
      </div>
    </div>
  );
};

