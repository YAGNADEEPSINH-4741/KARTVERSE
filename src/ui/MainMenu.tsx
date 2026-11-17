// ============================================================================
// KARTVERSE — Master Arcade Home Page Screen
// Ultra-Responsive, Non-Overlapping AAA Glassmorphic Interface
// Faithful Recreation of the Official AAA Kartverse Mockup
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
      className="relative w-full h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 select-none overflow-hidden bg-cover bg-center bg-no-repeat font-sans"
      style={{ backgroundImage: 'url(/assets/images/home_bg.jpg)' }}
    >
      {/* Subtle atmospheric vignette gradient overlay for text readability without obscuring artwork */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-transparent pointer-events-none z-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/30 pointer-events-none z-0" />

      {/* ==================================================================== */}
      {/* 1. TOP HEADER BAR: BRAND LOGO (Left) & RACER PROFILE (Right)          */}
      {/* ==================================================================== */}
      <div className="relative z-10 w-full flex items-center justify-between flex-shrink-0">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-pink-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center font-black text-white text-2xl sm:text-3xl shadow-[0_0_25px_rgba(0,240,255,0.7)] border border-white/30 flex-shrink-0">
            K
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 drop-shadow-[0_4px_18px_rgba(0,240,255,0.7)] leading-none">
              KARTVERSE
            </h1>
            <p className="text-[9px] sm:text-[10px] md:text-xs uppercase font-extrabold tracking-[0.35em] text-cyan-400 mt-1">
              RACE BEYOND LIMITS
            </p>
          </div>
        </div>

        {/* Top-Right User Identity Pill with Live Supabase Sync */}
        <button
          onClick={() => {
            audio.playMenuClick();
            setIsProfileModalOpen(true);
          }}
          title="Click to edit racer name & cloud profile in Supabase"
          className="group relative flex items-center gap-2.5 sm:gap-3 bg-slate-900/85 hover:bg-slate-800/95 backdrop-blur-xl border-2 border-fuchsia-500/80 hover:border-cyan-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl shadow-[0_0_25px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(0,240,255,0.7)] transition-all duration-200 cursor-pointer text-left active:scale-95"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-pink-500 flex items-center justify-center text-lg sm:text-xl shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
            🏎️
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-black text-white tracking-wide group-hover:text-cyan-300 transition-colors truncate max-w-[110px] sm:max-w-[150px]">
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

      {/* ==================================================================== */}
      {/* 2. MAIN RACE MODE COMMAND CARDS (Floating Left Stack)               */}
      {/* ==================================================================== */}
      <div className="relative z-10 w-full max-w-[420px] sm:max-w-[480px] md:max-w-[520px] lg:max-w-[560px] my-auto py-2 sm:py-4 space-y-3 sm:space-y-3.5">
        
        {/* Card 1: QUICK RACE */}
        <button
          onClick={() => startSinglePlayer('QUICK_RACE')}
          className="group relative w-full flex items-center justify-between p-3.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/75 hover:bg-slate-900/90 backdrop-blur-xl border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.35)] hover:shadow-[0_0_40px_rgba(0,240,255,0.75)] transition-all duration-200 text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
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
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl sm:text-3xl group-hover:scale-110 transition-transform shadow-inner flex-shrink-0 ml-2">
            🏁
          </div>
        </button>

        {/* Card 2: MULTIPLAYER */}
        <button
          onClick={() => navTo('MULTIPLAYER_LOBBY')}
          className="group relative w-full flex items-center justify-between p-3.5 sm:p-4 md:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/75 hover:bg-slate-900/90 backdrop-blur-xl border-2 border-fuchsia-500 shadow-[0_0_25px_rgba(217,70,239,0.35)] hover:shadow-[0_0_40px_rgba(217,70,239,0.75)] transition-all duration-200 text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
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
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-2xl sm:text-3xl text-cyan-400 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(0,240,255,0.4)] flex-shrink-0 ml-2">
            🌐
          </div>
        </button>

        {/* Split Row: GRAND PRIX & TIME TRIAL */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full">
          {/* Card 3A: GRAND PRIX */}
          <button
            onClick={() => startSinglePlayer('GRAND_PRIX')}
            className="group relative flex flex-col justify-between p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/75 hover:bg-slate-900/90 backdrop-blur-xl border-2 border-yellow-500/60 hover:border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] transition-all text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
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
              <p className="text-[10px] text-slate-300 mt-0.5">5-Track Cup</p>
            </div>
          </button>

          {/* Card 3B: TIME TRIAL */}
          <button
            onClick={() => startSinglePlayer('TIME_TRIAL')}
            className="group relative flex flex-col justify-between p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-950/75 hover:bg-slate-900/90 backdrop-blur-xl border-2 border-cyan-500/60 hover:border-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all text-left cursor-pointer transform hover:-translate-y-0.5 active:scale-[0.99]"
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
              <p className="text-[10px] text-slate-300 mt-0.5">Beat the Clock</p>
            </div>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3. BOTTOM UTILITY BAR: NAV PILLS (Left) & SETTINGS PILL (Right)     */}
      {/* ==================================================================== */}
      <div className="relative z-10 w-full flex flex-wrap items-center justify-between gap-3 pt-2 flex-shrink-0">
        
        {/* Left Utility Cluster: Garage, Circuits, Leaderboard */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navTo('GARAGE')}
            className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-2xl bg-slate-950/80 hover:bg-cyan-500 hover:text-slate-950 text-white font-black italic text-xs sm:text-sm tracking-wider uppercase border-2 border-cyan-400 shadow-[0_0_18px_rgba(0,240,255,0.3)] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 backdrop-blur-xl"
          >
            <span>🔧</span>
            <span>GARAGE & TUNING</span>
          </button>

          <button
            onClick={() => navTo('TRACK_SELECT')}
            className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-2xl bg-slate-950/80 hover:bg-fuchsia-500 hover:text-white text-white font-black italic text-xs sm:text-sm tracking-wider uppercase border-2 border-fuchsia-500 shadow-[0_0_18px_rgba(217,70,239,0.3)] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 backdrop-blur-xl"
          >
            <span>📖</span>
            <span>CIRCUITS</span>
          </button>

          <button
            onClick={() => navTo('LEADERBOARD')}
            className="py-2 sm:py-2.5 px-3 sm:px-4 rounded-2xl bg-slate-950/80 hover:bg-yellow-400 hover:text-slate-950 text-white font-black italic text-xs sm:text-sm tracking-wider uppercase border-2 border-yellow-400 shadow-[0_0_18px_rgba(250,204,21,0.3)] transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer active:scale-95 backdrop-blur-xl"
          >
            <span>🏆</span>
            <span>LEADERBOARD</span>
          </button>
        </div>

        {/* Right Utility: Settings Pill */}
        <button
          onClick={() => navTo('SETTINGS')}
          className="py-2 sm:py-2.5 px-4 sm:px-5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 text-white font-black italic text-xs sm:text-sm uppercase tracking-wider border-2 border-slate-600 hover:border-cyan-400 shadow-[0_0_18px_rgba(0,0,0,0.5)] transition-all flex items-center gap-2 cursor-pointer active:scale-95 backdrop-blur-xl"
        >
          <span>⚙️</span>
          <span>SETTINGS</span>
        </button>
      </div>

      {/* Supabase Racer Profile Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
};
