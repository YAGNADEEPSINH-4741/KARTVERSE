// ============================================================================
// KARTVERSE — Post-Race Podium & Results Celebration Modal
// ============================================================================

import React from 'react';
import { useGameStore } from '../store/gameStore';
import { audio } from '../audio/AudioManager';

interface RaceResultsModalProps {
  onRestart: () => void;
}

export const RaceResultsModal: React.FC<RaceResultsModalProps> = ({ onRestart }) => {
  const setScreen = useGameStore(state => state.setScreen);
  const setRaceStatus = useGameStore(state => state.setRaceStatus);
  const telemetry = useGameStore(state => state.telemetry);
  const profile = useGameStore(state => state.profile);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${mins}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const isPodium = telemetry.position <= 3;

  const handleMainMenu = () => {
    audio.playMenuClick();
    setRaceStatus('IDLE');
    setScreen('MENU');
  };

  const handleRaceAgain = () => {
    audio.playMenuClick();
    setRaceStatus('COUNTDOWN');
    onRestart();
  };

  return (
    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 select-none">
      <div className="bg-slate-900 border-2 border-yellow-400/80 rounded-3xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(250,204,21,0.3)] text-center animate-in fade-in zoom-in duration-300">
        {/* Podium Trophy Icon */}
        <div className="text-7xl mb-2 animate-bounce">
          {telemetry.position === 1 ? '🏆' : telemetry.position === 2 ? '🥈' : telemetry.position === 3 ? '🥉' : '🏁'}
        </div>

        {/* Victory Headline */}
        <h2 className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-400">
          {telemetry.position === 1
            ? 'VICTORY!'
            : isPodium
            ? 'PODIUM FINISH!'
            : 'RACE COMPLETE!'}
        </h2>

        <p className="text-sm font-extrabold uppercase text-slate-400 mt-1 tracking-widest">
          FINISHED IN {telemetry.position}
          {telemetry.position === 1 ? 'ST' : telemetry.position === 2 ? 'ND' : telemetry.position === 3 ? 'RD' : 'TH'} PLACE
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 my-6 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">TOTAL TIME</div>
            <div className="text-2xl font-mono font-black text-white mt-0.5">
              {formatTime(telemetry.raceTime)}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">BEST LAP</div>
            <div className="text-2xl font-mono font-black text-green-400 mt-0.5">
              {formatTime(telemetry.bestLapTime)}
            </div>
          </div>
        </div>

        {/* XP Reward Banner */}
        <div className="mb-6 bg-purple-900/40 border border-purple-500/40 rounded-xl p-3 flex items-center justify-between">
          <div className="text-left">
            <div className="text-xs uppercase font-extrabold text-purple-300">XP REWARD</div>
            <div className="text-sm font-black text-white">+{telemetry.position === 1 ? 500 : 250} EXP</div>
          </div>
          <span className="text-2xl">✨</span>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={handleMainMenu}
            className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black italic text-sm tracking-wider uppercase transition-colors cursor-pointer"
          >
            MAIN MENU
          </button>
          <button
            onClick={handleRaceAgain}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black italic text-sm tracking-wider uppercase shadow-[0_0_20px_#00f0ff] transition-all cursor-pointer"
          >
            RACE AGAIN 🏁
          </button>
        </div>
      </div>
    </div>
  );
};

