// ============================================================================
// KARTVERSE — Master Arcade Home Page Screen
// Ultra-Responsive, Non-Overlapping AAA Glassmorphic Interface
// Supports 1080p, 1440p, 4K, 720p Laptop Screens & Tablets
// ============================================================================

import React, { useState } from 'react';
import { useGameStore, ScreenState, GameRaceMode } from '../store/gameStore';
import { audio } from '../audio/AudioManager';
import { ProfileModal } from './ProfileModal';

export const MainMenu: React.FC = () => {
  const setScreen = useGameStore(state => state.setScreen);
  const setRaceMode = useGameStore(state => state.setRaceMode);
  const profile = useGameStore(state => state.profile);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const startSinglePlayer = (mode: GameRaceMode) => {
    audio.playMenuClick();
    setRaceMode(mode);
    setScreen('QUICK_RACE');
  };

  const navTo = (screen: ScreenState) => {
    audio.playMenuClick();
    setScreen(screen);
  };

  return (
    <div 
      className="relative w-full h-full flex select-none overflow-hidden bg-cover bg-center bg-no-repeat font-sans"
      style={{ backgroundImage: 'url(/assets/images/home_bg.jpg)' }}
    >
      {/* Background Dimmer for High Contrast */}
      <div className="absolute inset-0 bg-slate-950/20 pointer-events-none z-0" />

      {/* ==================================================================== */}
      {/* LEFT COMMAND CONSOLE (Solid Glassmorphism — Eliminates Ghosting)     */}
      {/* Uses responsive sizing, flex-shrink, and clean spacing                */}
      {/* ==================================================================== */}
      <div className="relative z-10 w-full sm:w-[480px] md:w-[520px] lg:w-[560px] h-full flex flex-col justify-between p-4 sm:p-6 md:p-7 lg:p-8 bg-slate-950/98 backdrop-blur-2xl border-r border-cyan-500/30 shadow-[30px_0_70px_rgba(0,0,0,0.95)] overflow-y-auto overflow-x-hidden">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-13 md:h-13 rounded-2xl bg-gradient-to-tr from-pink-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center font-black text-white text-2xl sm:text-3xl shadow-[0_0_25px_rgba(0,240,255,0.7)] border border-white/20 flex-shrink-0">
            K
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 drop-shadow-[0_4px_18px_rgba(0,240,255,0.6)] leading-none">
              KARTVERSE
            </h1>
            <p className="text-[9px] sm:text-[10px] md:text-xs uppercase font-extrabold tracking-[0.35em] text-cyan-400 mt-1">
              RACE BEYOND LIMITS
            </p>
          </div>
        </div>

        {/* Mode Navigation Cards */}
        <div className="my-auto py-3 space-y-2.5 sm:space-y-3 md:space-y-3.5 w-full">
          {/* Card 1: QUICK RACE */}
          <button
            onClick={() => startSinglePlayer('QUICK_RACE')}
            className="group relative w-full flex items-center justify-between p-3.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/95 hover:bg-slate-850 border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_35px_rgba(0,240,255,0.65)] transition-all duration-200 text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <div className="pr-2">
              <div className="text-[10px] sm:text-[11px] uppercase font-black tracking-widest text-cyan-400">
                ARCADE SOLO
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl font-black italic text-white group-hover:text-cyan-200 transition-colors mt-0.5 tracking-tight">
                QUICK RACE
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">
                Jump straight into an 8-kart battle against adaptive AI
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-110 transition-transform shadow-inner flex-shrink-0 ml-2">
              🏁
            </div>
          </button>

          {/* Card 2: MULTIPLAYER */}
          <button
            onClick={() => navTo('MULTIPLAYER_LOBBY')}
            className="group relative w-full flex items-center justify-between p-3.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl bg-slate-900/95 hover:bg-slate-850 border-2 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:shadow-[0_0_35px_rgba(217,70,239,0.65)] transition-all duration-200 text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
          >
            <div className="pr-2">
              <div className="text-[10px] sm:text-[11px] uppercase font-black tracking-widest text-fuchsia-400">
                REAL-TIME ONLINE
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl font-black italic text-white group-hover:text-fuchsia-200 transition-colors mt-0.5 tracking-tight">
                MULTIPLAYER
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-0.5 sm:mt-1 line-clamp-1 sm:line-clamp-none">
                Host or join 6-char rooms with friends (2-8 racers)
              </p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-2xl sm:text-3xl text-cyan-400 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(0,240,255,0.4)] flex-shrink-0 ml-2">
              🌐
            </div>
          </button>

          {/* Split Row: GRAND PRIX & TIME TRIAL */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
            {/* Card 3A: GRAND PRIX */}
            <button
              onClick={() => startSinglePlayer('GRAND_PRIX')}
              className="group relative flex flex-col justify-between p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-900/95 hover:bg-slate-850 border border-cyan-500/50 hover:border-yellow-400 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_25px_rgba(250,204,21,0.4)] transition-all text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-yellow-400">
                  TOURNAMENT
                </span>
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">🏆</span>
              </div>
              <div className="mt-1.5 sm:mt-2">
                <div className="text-base sm:text-lg font-black italic text-white group-hover:text-yellow-300 transition-colors">
                  GRAND PRIX
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">5-Track Cup</p>
              </div>
            </button>

            {/* Card 3B: TIME TRIAL */}
            <button
              onClick={() => startSinglePlayer('TIME_TRIAL')}
              className="group relative flex flex-col justify-between p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-900/95 hover:bg-slate-850 border border-cyan-500/50 hover:border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-cyan-400">
                  SOLO RECORD
                </span>
                <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">⏱️</span>
              </div>
              <div className="mt-1.5 sm:mt-2">
                <div className="text-base sm:text-lg font-black italic text-white group-hover:text-cyan-300 transition-colors">
                  TIME TRIAL
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">Beat the Clock</p>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Navigation Cluster */}
        <div className="pt-2.5 sm:pt-3 border-t border-slate-800/80 flex flex-col gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={() => navTo('GARAGE')}
              className="py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-slate-900 hover:bg-cyan-500 hover:text-slate-950 text-white font-black italic text-[10px] sm:text-[11px] tracking-wider uppercase border border-cyan-400/80 shadow-[0_0_12px_rgba(0,240,255,0.25)] transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
            >
              <span>🛠️</span>
              <span>GARAGE</span>
            </button>

            <button
              onClick={() => navTo('TRACK_SELECT')}
              className="py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-slate-900 hover:bg-fuchsia-500 hover:text-white text-white font-black italic text-[10px] sm:text-[11px] tracking-wider uppercase border border-fuchsia-500/80 shadow-[0_0_12px_rgba(217,70,239,0.25)] transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
            >
              <span>📖</span>
              <span>CIRCUITS</span>
            </button>

            <button
              onClick={() => navTo('LEADERBOARD')}
              className="py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-slate-900 hover:bg-yellow-400 hover:text-slate-950 text-white font-black italic text-[10px] sm:text-[11px] tracking-wider uppercase border border-yellow-400/80 shadow-[0_0_12px_rgba(250,204,21,0.25)] transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
            >
              <span>🏆</span>
              <span>RANKS</span>
            </button>
          </div>

          <button
            onClick={() => navTo('SETTINGS')}
            className="w-full py-2 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-[11px] sm:text-xs uppercase tracking-wider border border-slate-700 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95"
          >
            <span>⚙️</span>
            <span>SETTINGS & CONTROLS</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TOP-RIGHT USER IDENTITY PILL (With Supabase Live Cloud Sync)          */}
      {/* Responsive positioning: fits cleanly across all screen widths         */}
      {/* ==================================================================== */}
      <div className="absolute top-4 sm:top-6 md:top-8 right-4 sm:right-6 md:right-8 z-20">
        <button
          onClick={() => {
            audio.playMenuClick();
            setIsProfileModalOpen(true);
          }}
          title="Click to edit racer name & cloud profile in Supabase"
          className="group relative flex items-center gap-2.5 sm:gap-3 bg-[#0a0f1d] hover:bg-[#11192e] border-2 border-purple-500/80 hover:border-cyan-400 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl w-[200px] sm:w-[240px] h-[52px] sm:h-[58px] shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:shadow-[0_0_35px_rgba(0,240,255,0.8)] transition-all duration-200 cursor-pointer text-left active:scale-95"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-pink-500 flex items-center justify-center text-lg sm:text-xl shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
            🏎️
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-white tracking-wide group-hover:text-cyan-300 transition-colors truncate max-w-[110px] sm:max-w-[130px]">
                {profile.username}
              </span>
              <span className="text-[10px] sm:text-xs text-slate-400 group-hover:text-white transition-colors flex-shrink-0" title="Edit name">
                ✏️
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-extrabold flex items-center gap-1.5 mt-0.5">
              <span className="px-1.5 py-0.2 rounded bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 font-black text-[9px] sm:text-[10px]">
                LVL {profile.level}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300 font-mono text-[10px] sm:text-[11px]">
                {profile.xp} XP
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Modal for runtime name editing & cloud persistence */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
};
