// ============================================================================
// KARTVERSE — High-Octane In-Race Heads-Up Display (HUD)
// Speedometer, Transmission Gear [R], Nitro Meter, Drift Boosts & Minimap Radar
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { POWER_UPS, PowerUpType } from '../items/PowerUpSystem';

export const RaceHUD: React.FC = () => {
  const telemetry = useGameStore(state => state.telemetry);
  const miniMapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active mini-turbo popup banner state
  const [boostBanner, setBoostBanner] = useState<{ text: string; color: string } | null>(null);

  // Self-dismissing countdown display to ensure "GO!" never persists
  const [visibleCountdown, setVisibleCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (telemetry.countdownNumber !== null) {
      setVisibleCountdown(telemetry.countdownNumber);
      if (telemetry.countdownNumber === 0) {
        const timer = setTimeout(() => {
          setVisibleCountdown(null);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } else {
      setVisibleCountdown(null);
    }
  }, [telemetry.countdownNumber]);

  useEffect(() => {
    if (telemetry.miniTurboNotification) {
      const text = telemetry.miniTurboNotification;
      let color = 'from-blue-500 to-cyan-400 text-cyan-200';
      if (text.includes('ULTRA')) {
        color = 'from-amber-400 via-orange-500 to-yellow-300 text-yellow-100 shadow-[0_0_35px_#f59e0b]';
      } else if (text.includes('SUPER')) {
        color = 'from-fuchsia-500 via-purple-600 to-pink-400 text-pink-100 shadow-[0_0_35px_#d946ef]';
      } else {
        color = 'from-cyan-400 to-blue-600 text-cyan-100 shadow-[0_0_35px_#00f0ff]';
      }

      setBoostBanner({ text, color });
      const timer = setTimeout(() => {
        setBoostBanner(null);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [telemetry.miniTurboNotification]);

  const currentItemDef = telemetry.currentItem ? POWER_UPS[telemetry.currentItem as PowerUpType] : null;

  // Format time mm:ss.ms
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${mins}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const getRankSuffix = (rank: number) => {
    if (rank === 1) return 'st';
    if (rank === 2) return 'nd';
    if (rank === 3) return 'rd';
    return 'th';
  };

  // Render 2D Minimap Radar
  useEffect(() => {
    const canvas = miniMapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const scale = 0.22; // maps ~250m radius into 60px

    // Radar circular grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Draw all racers on radar
    if (telemetry.racerPositions && telemetry.racerPositions.length > 0) {
      telemetry.racerPositions.forEach((racer) => {
        const x = centerX + racer.x * scale;
        const y = centerY + racer.z * scale;

        if (racer.isPlayer) {
          // Local player: pulsing cyan dot with white center
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(x, y, 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Opponent: red dot
          ctx.fillStyle = '#ff3b30';
          ctx.beginPath();
          ctx.arc(x, y, 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }, [telemetry.racerPositions]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-sans">
      {/* Dynamic Speed Lines during active Nitro */}
      {telemetry.isNitroActive && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,240,255,0.18)_100%)] animate-pulse pointer-events-none" />
      )}

      {/* Mini-Turbo Release Toast Notification */}
      {boostBanner && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-bounce z-30">
          <div className={`px-6 py-2.5 rounded-2xl bg-gradient-to-r ${boostBanner.color} border-2 border-white/60 font-black italic text-2xl md:text-3xl tracking-tighter shadow-2xl`}>
            ⚡ {boostBanner.text} ⚡
          </div>
        </div>
      )}

      {/* 1. Countdown Banner (Auto-dismisses after GO!) */}
      {visibleCountdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center animate-bounce">
            <h1 className="text-8xl md:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-red-500 to-purple-600 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
              {visibleCountdown === 0 ? 'GO!!' : visibleCountdown}
            </h1>
          </div>
        </div>
      )}

      {/* 2. Wrong Way Alert */}
      {telemetry.isWrongWay && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white font-black text-2xl md:text-3xl px-8 py-3 rounded-full border-2 border-yellow-400 shadow-[0_0_30px_#ff0033] animate-pulse">
          ⚠️ WRONG WAY! TURN AROUND!
        </div>
      )}

      {/* 3. Top Left: Position Badge & Lap Counter */}
      <div className="absolute top-6 left-6 flex items-center gap-4">
        {/* Position Badge */}
        <div className="bg-slate-900/85 backdrop-blur-md border border-cyan-500/50 rounded-2xl px-5 py-3 shadow-[0_0_20px_rgba(0,240,255,0.3)] flex items-baseline gap-1">
          <span className="text-5xl md:text-6xl font-black italic text-cyan-400 drop-shadow-[0_0_10px_#00f0ff]">
            {telemetry.position}
          </span>
          <span className="text-2xl font-extrabold text-cyan-300">
            {getRankSuffix(telemetry.position)}
          </span>
          <span className="text-sm font-bold text-slate-400 ml-1">
            / {telemetry.totalRacers}
          </span>
        </div>

        {/* Lap Badge */}
        <div className="bg-slate-900/85 backdrop-blur-md border border-purple-500/50 rounded-2xl px-5 py-3 shadow-[0_0_20px_rgba(168,85,247,0.3)]">
          <div className="text-xs uppercase font-extrabold tracking-wider text-purple-300">LAP</div>
          <div className="text-3xl font-black italic text-white">
            {telemetry.currentLap} <span className="text-slate-400 text-lg">/ {telemetry.totalLaps}</span>
          </div>
        </div>
      </div>

      {/* 4. Top Right: Timer & Best Lap */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700 rounded-2xl px-5 py-2 text-right shadow-lg">
          <div className="text-xs uppercase font-bold text-slate-400">RACE TIME</div>
          <div className="text-2xl font-mono font-black text-yellow-400">
            {formatTime(telemetry.raceTime)}
          </div>
        </div>

        {telemetry.bestLapTime > 0 && (
          <div className="bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-xl px-4 py-1.5 text-right">
            <span className="text-xs font-semibold text-slate-400 mr-2">BEST:</span>
            <span className="text-sm font-mono font-bold text-green-400">{formatTime(telemetry.bestLapTime)}</span>
          </div>
        )}
      </div>

      {/* 5. Center Top: Held Item Box */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <div className="relative w-20 h-20 bg-slate-900/90 backdrop-blur-md border-2 border-yellow-400/80 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(250,204,21,0.4)]">
          {currentItemDef ? (
            <div className="flex flex-col items-center animate-pulse">
              <span className="text-4xl">{currentItemDef.icon}</span>
              <span className="text-[10px] font-black uppercase text-yellow-300 mt-1 tracking-tighter">
                [SPACE] USE
              </span>
            </div>
          ) : (
            <span className="text-3xl text-slate-600 font-bold">?</span>
          )}
        </div>
      </div>

      {/* 6. Bottom Right: Speedometer & Nitro Meter */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3">
        {/* Nitro Meter */}
        <div className={`w-48 bg-slate-900/85 backdrop-blur-md rounded-xl p-2.5 transition-all shadow-lg ${
          telemetry.isNitroActive 
            ? 'border-2 border-cyan-400 shadow-[0_0_25px_#00f0ff] animate-pulse' 
            : 'border border-cyan-500/40'
        }`}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
              {telemetry.isNitroActive ? '🔥 NITRO BOOST!' : 'NITRO'}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400">{telemetry.nitroPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                telemetry.isNitroActive 
                  ? 'bg-gradient-to-r from-amber-400 via-cyan-400 to-white shadow-[0_0_15px_#00f0ff]' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_#00f0ff]'
              }`}
              style={{ width: `${telemetry.nitroPercent}%` }}
            />
          </div>
        </div>

        {/* Speed Dial with Gear Indicator [R] */}
        <div className={`bg-slate-900/90 backdrop-blur-md rounded-3xl px-7 py-4 flex items-baseline gap-2 transition-all ${
          telemetry.isNitroActive 
            ? 'border-2 border-fuchsia-400 shadow-[0_0_35px_rgba(217,70,239,0.5)] scale-105' 
            : 'border-2 border-cyan-500/60 shadow-[0_0_30px_rgba(0,240,255,0.25)]'
        }`}>
          {telemetry.isReversing && (
            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-400 font-black text-sm tracking-widest animate-pulse mr-1">
              R
            </span>
          )}
          <span className="text-6xl font-black italic tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]">
            {telemetry.speedKmh}
          </span>
          <span className="text-lg font-black uppercase italic text-cyan-400 tracking-wider">
            KM/H
          </span>
        </div>
      </div>

      {/* 7. Bottom Left: Real-Time Radar Mini-Map */}
      <div className="absolute bottom-20 left-6">
        <div className="w-28 h-28 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-cyan-500/40 p-1.5 shadow-[0_0_20px_rgba(0,240,255,0.2)] flex items-center justify-center relative overflow-hidden">
          <canvas
            ref={miniMapCanvasRef}
            width={100}
            height={100}
            className="w-full h-full"
          />
          <div className="absolute top-1 left-2 text-[8px] font-black uppercase text-cyan-400 tracking-wider">
            RADAR
          </div>
        </div>
      </div>

      {/* 8. Bottom Left: Key Controls */}
      <div className="absolute bottom-6 left-6 bg-slate-900/70 backdrop-blur-sm border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-400 flex gap-4">
        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">W / ↑</kbd> Gas</div>
        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">Shift</kbd> Drift</div>
        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">Space</kbd> Item</div>
        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">N</kbd> Nitro</div>
        <div><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-mono">R</kbd> Reset</div>
      </div>
    </div>
  );
};
