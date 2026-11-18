// ============================================================================
// KARTVERSE — Mobile-Native Racing HUD & Touchscreen Interface
// Inspired by Asphalt Legends, Real Racing 3 & Mario Kart Tour
// Maximum Gameplay Visibility, Ergonomic Thumb Clusters & Safe-Area Insets
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { POWER_UPS, PowerUpType } from '../items/PowerUpSystem';
import { touchControls } from '../input/TouchControls';
import { audio } from '../audio/AudioManager';

export interface MobileRaceHUDProps {
  onExit?: () => void;
  trackSplinePoints: THREE.Vector3[];
  trackBounds: { minX: number; maxX: number; minZ: number; maxZ: number; width: number; height: number };
  trackConfig: any;
}

export const MobileRaceHUD: React.FC<MobileRaceHUDProps> = ({
  onExit,
  trackSplinePoints,
  trackBounds,
  trackConfig
}) => {
  const telemetry = useGameStore(state => state.telemetry);
  const miniMapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Collapsible panels
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);

  // Pressed visual states for tactile touch feedback
  const [activeTouches, setActiveTouches] = useState<{
    steerLeft?: boolean;
    steerRight?: boolean;
    gas?: boolean;
    brake?: boolean;
    rev?: boolean;
    nitro?: boolean;
    item?: boolean;
  }>({});

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

  // Auto-close leaderboard when driving resumes
  const handleDriveInput = (key: keyof typeof touchControls, active: boolean) => {
    touchControls[key] = active;
    if (active && showLeaderboard) {
      setShowLeaderboard(false);
    }
  };

  // Helper for touch events on controls with safe preventDefault
  const bindTouch = (key: keyof typeof touchControls, touchStateKey: keyof typeof activeTouches) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleDriveInput(key, true);
      setActiveTouches(prev => ({ ...prev, [touchStateKey]: true }));
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handleDriveInput(key, false);
      setActiveTouches(prev => ({ ...prev, [touchStateKey]: false }));
    },
    onTouchCancel: () => {
      handleDriveInput(key, false);
      setActiveTouches(prev => ({ ...prev, [touchStateKey]: false }));
    },
    onMouseDown: () => {
      handleDriveInput(key, true);
      setActiveTouches(prev => ({ ...prev, [touchStateKey]: true }));
    },
    onMouseUp: () => {
      handleDriveInput(key, false);
      setActiveTouches(prev => ({ ...prev, [touchStateKey]: false }));
    },
    onMouseLeave: () => {
      handleDriveInput(key, false);
      setActiveTouches(prev => ({ ...prev, [touchStateKey]: false }));
    }
  });

  // Render Compact 2D Minimap
  useEffect(() => {
    if (!showMinimap) return;
    const canvas = miniMapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 8;
    const usableW = canvas.width - pad * 2;
    const usableH = canvas.height - pad * 2;
    const scale = Math.min(usableW / trackBounds.width, usableH / trackBounds.height);
    const offsetX = pad + (usableW - trackBounds.width * scale) / 2 - trackBounds.minX * scale;
    const offsetZ = pad + (usableH - trackBounds.height * scale) / 2 - trackBounds.minZ * scale;

    const toCanvas = (wx: number, wz: number) => ({
      x: wx * scale + offsetX,
      y: wz * scale + offsetZ
    });

    const themeGlow =
      trackConfig.theme === 'CYBER' ? '#00f0ff' :
      trackConfig.theme === 'LAVA' ? '#f59e0b' :
      trackConfig.theme === 'FOREST' ? '#10b981' :
      trackConfig.theme === 'ICE' ? '#38bdf8' : '#0284c7';

    // 1. Circuit track halo
    ctx.save();
    ctx.beginPath();
    trackSplinePoints.forEach((p, idx) => {
      const c = toCanvas(p.x, p.z);
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = themeGlow;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = themeGlow;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.6;
    ctx.stroke();
    ctx.restore();

    // 2. Inner track asphalt
    ctx.save();
    ctx.beginPath();
    trackSplinePoints.forEach((p, idx) => {
      const c = toCanvas(p.x, p.z);
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#050a14';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // 3. Start/Finish gate
    if (trackSplinePoints.length > 1) {
      const p0 = toCanvas(trackSplinePoints[0].x, trackSplinePoints[0].z);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Opponents
    if (telemetry.racerPositions && telemetry.racerPositions.length > 0) {
      telemetry.racerPositions.forEach((racer) => {
        if (racer.isPlayer) return;
        const pt = toCanvas(racer.x, racer.z);
        ctx.fillStyle = racer.kartColor || '#0284c7';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 5. Player (pulsing cyan)
      const playerPos = telemetry.racerPositions.find(r => r.isPlayer);
      if (playerPos) {
        const p = toCanvas(playerPos.x, playerPos.z);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [showMinimap, telemetry.racerPositions, trackBounds, trackConfig.theme, trackSplinePoints]);

  return (
    <div 
      className="absolute inset-0 pointer-events-none select-none overflow-hidden font-sans"
      style={{
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))'
      }}
    >
      {/* ==================================================================== */}
      {/* 1. TOP MINIMAL BAR: Sleek, Low-Profile Racing Information            */}
      {/* ==================================================================== */}
      <div className="absolute top-2 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
        {/* Left Cluster: Exit & Position / Lap Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {onExit && (
            <button
              onClick={() => { audio.playMenuClick(); onExit(); }}
              className="h-8 px-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 text-slate-300 active:text-white flex items-center gap-1 text-[11px] font-black uppercase tracking-wider shadow-md active:scale-95 transition-all"
              aria-label="Exit Race"
            >
              <span>←</span>
              <span className="hidden xs:inline">EXIT</span>
            </button>
          )}

          {/* Combined Race Position & Lap Capsule */}
          <div className="h-8 px-3 rounded-full bg-slate-950/70 backdrop-blur-md border border-cyan-500/40 flex items-center gap-2 shadow-lg">
            {/* Position */}
            <div className="flex items-baseline gap-0.5">
              <span className="text-sm font-black italic text-cyan-300">
                {telemetry.position}
              </span>
              <span className="text-[10px] font-black uppercase text-cyan-400">
                {getRankSuffix(telemetry.position)}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 ml-0.5">
                /{telemetry.totalRacers}
              </span>
            </div>

            <div className="w-px h-3.5 bg-slate-700/80" />

            {/* Lap */}
            <div className="flex items-baseline gap-0.5 text-[11px] font-bold text-slate-200">
              <span className="text-[9px] uppercase font-black text-sky-400">LAP</span>
              <span className="font-black text-white">{telemetry.currentLap}</span>
              <span className="text-slate-400 text-[10px]">/{telemetry.totalLaps}</span>
            </div>
          </div>
        </div>

        {/* Center: Active Item Availability Indicator (Compact Mini-Pill) */}
        {currentItemDef && (
          <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 backdrop-blur-md border border-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.35)] animate-pulse">
            <span className="text-base">{currentItemDef.icon}</span>
            <span className="text-[10px] font-black uppercase text-yellow-300 tracking-wider">
              {currentItemDef.name}
            </span>
          </div>
        )}

        {/* Right Cluster: Timer & Collapsible Standings Toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Digital Timer */}
          <div className="h-8 px-3 rounded-full bg-slate-950/70 backdrop-blur-md border border-slate-700/60 flex items-center gap-1.5 shadow-md">
            <span className="text-[9px] font-black uppercase text-sky-400">TIME</span>
            <span className="text-xs font-mono font-black text-yellow-400 tracking-tight">
              {formatTime(telemetry.raceTime)}
            </span>
          </div>

          {/* Standings Tower Toggle Button */}
          <button
            onClick={() => {
              audio.playMenuClick();
              setShowLeaderboard(prev => !prev);
            }}
            className={`h-8 px-2.5 rounded-full backdrop-blur-md border flex items-center gap-1 text-[11px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 ${
              showLeaderboard
                ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                : 'bg-slate-950/70 border-slate-700/60 text-slate-300'
            }`}
            aria-label="Toggle Standings"
          >
            <span>🏆</span>
            <span className="text-[9px] font-bold">{showLeaderboard ? 'HIDE' : 'RANK'}</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. SLIDE-OUT STANDINGS PANEL (Collapsible, Does Not Obstruct Road)   */}
      {/* ==================================================================== */}
      {showLeaderboard && telemetry.leaderboard && (
        <div className="absolute top-12 right-3 w-48 max-w-[50vw] bg-slate-950/90 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-2.5 shadow-2xl z-40 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex justify-between items-center pb-1 mb-1 border-b border-slate-800 text-[9px] font-black uppercase tracking-wider text-cyan-400">
            <span>LIVE STANDINGS</span>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="text-slate-400 hover:text-white px-1 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {telemetry.leaderboard.map((r) => (
              <div
                key={r.id}
                className={`flex items-center justify-between px-2 py-0.5 rounded-lg text-[10px] ${
                  r.isPlayer
                    ? 'bg-cyan-500/25 border border-cyan-400/80 text-cyan-200 font-black'
                    : 'bg-slate-900/40 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1 truncate">
                  <span className={`w-3.5 font-black ${
                    r.rank === 1 ? 'text-yellow-400' : r.rank === 2 ? 'text-slate-200' : r.rank === 3 ? 'text-amber-500' : 'text-sky-300'
                  }`}>
                    #{r.rank}
                  </span>
                  <span className="truncate max-w-[85px]">{r.name}</span>
                </div>
                <span className="text-[8px] font-mono opacity-70">L{r.lap}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. COMPACT MINIMAP RADAR (Top-Left under Top Bar, Collapsible)       */}
      {/* ==================================================================== */}
      <div className="absolute top-12 left-3 z-20 pointer-events-auto">
        {showMinimap ? (
          <div className="relative w-22 h-22 rounded-2xl bg-slate-950/60 backdrop-blur-md border border-cyan-500/40 p-1 shadow-lg">
            <button
              onClick={() => setShowMinimap(false)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-900 border border-slate-600 text-slate-300 flex items-center justify-center text-[9px] shadow"
              title="Minimize Radar"
            >
              ✕
            </button>
            <canvas
              ref={miniMapCanvasRef}
              width={80}
              height={80}
              className="w-full h-full"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowMinimap(true)}
            className="w-7 h-7 rounded-full bg-slate-950/70 backdrop-blur-md border border-cyan-400/50 flex items-center justify-center text-xs shadow-md text-cyan-300 active:scale-95"
            title="Expand Radar"
          >
            🗺️
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 4. SPEEDOMETER & NITRO ENERGY STRIP (Ultra-Clean Bottom-Center)      */}
      {/* ==================================================================== */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 pointer-events-none">
        {/* Sleek, Razor-Thin Nitro Energy Strip */}
        <div className="w-28 sm:w-36 h-1.5 rounded-full bg-slate-900/80 backdrop-blur-xs border border-slate-700/60 p-0.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              telemetry.isNitroActive
                ? 'bg-gradient-to-r from-amber-400 via-cyan-300 to-white shadow-[0_0_8px_#00f0ff]'
                : 'bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_6px_#00f0ff]'
            }`}
            style={{ width: `${telemetry.nitroPercent}%` }}
          />
        </div>

        {/* Minimalist Digital Speed Indicator */}
        <div className="px-3 py-0.5 rounded-full bg-slate-950/45 backdrop-blur-xs flex items-baseline gap-1">
          {telemetry.isReversing && (
            <span className="text-[10px] font-black text-amber-400 animate-pulse mr-0.5">
              R
            </span>
          )}
          <span className="text-xl sm:text-2xl font-black italic tracking-tight text-white drop-shadow">
            {telemetry.speedKmh}
          </span>
          <span className="text-[9px] font-black uppercase italic text-cyan-400 tracking-wider">
            KM/H
          </span>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 5. LEFT SECTION: Ergonomic Steering Thumb Controls                   */}
      {/* ==================================================================== */}
      <div 
        className="absolute bottom-3 left-3 z-30 pointer-events-auto flex items-center gap-2.5"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)'
        }}
      >
        {/* STEER LEFT */}
        <button
          {...bindTouch('steerLeft', 'steerLeft')}
          className={`w-14 h-14 rounded-full backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90 ${
            activeTouches.steerLeft
              ? 'bg-cyan-500/40 border-2 border-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.6)]'
              : 'bg-slate-900/45 hover:bg-slate-900/60 border border-cyan-400/50'
          }`}
          aria-label="Steer Left"
        >
          <span className="text-2xl font-black text-cyan-300 drop-shadow">◀</span>
          <span className="text-[8px] font-black uppercase text-cyan-200 tracking-tighter -mt-1">LEFT</span>
        </button>

        {/* STEER RIGHT */}
        <button
          {...bindTouch('steerRight', 'steerRight')}
          className={`w-14 h-14 rounded-full backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90 ${
            activeTouches.steerRight
              ? 'bg-cyan-500/40 border-2 border-cyan-300 shadow-[0_0_20px_rgba(0,240,255,0.6)]'
              : 'bg-slate-900/45 hover:bg-slate-900/60 border border-cyan-400/50'
          }`}
          aria-label="Steer Right"
        >
          <span className="text-2xl font-black text-cyan-300 drop-shadow">▶</span>
          <span className="text-[8px] font-black uppercase text-cyan-200 tracking-tighter -mt-1">RIGHT</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 6. RIGHT SECTION: Driving Controls Cluster (Gas, Brake, Nitro, Item) */}
      {/* ==================================================================== */}
      <div 
        className="absolute bottom-3 right-3 z-30 pointer-events-auto flex items-end gap-2.5"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
      >
        {/* Left Sub-Column: Reverse & Brake */}
        <div className="flex flex-col gap-2 items-center">
          {/* REVERSE GEAR BUTTON */}
          <button
            {...bindTouch('reverse', 'rev')}
            className={`w-11 h-10 rounded-xl backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer shadow-md active:scale-90 ${
              activeTouches.rev
                ? 'bg-blue-600/50 border-2 border-sky-300 shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                : 'bg-slate-900/40 border border-sky-400/40'
            }`}
            aria-label="Reverse"
          >
            <span className="text-sm font-black text-sky-300">⬇</span>
            <span className="text-[7px] font-black uppercase text-sky-200 -mt-0.5">REV</span>
          </button>

          {/* ACTIVE BRAKE BUTTON */}
          <button
            {...bindTouch('brake', 'brake')}
            className={`w-13 h-13 rounded-2xl backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90 ${
              activeTouches.brake
                ? 'bg-amber-600/60 border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
                : 'bg-slate-900/45 border border-amber-400/60'
            }`}
            aria-label="Brake"
          >
            <span className="text-lg text-amber-300 drop-shadow">🛑</span>
            <span className="text-[8px] font-black uppercase text-amber-200 tracking-wider -mt-0.5">BRAKE</span>
          </button>
        </div>

        {/* Center Sub-Column: Item Deploy & Nitro Boost */}
        <div className="flex flex-col gap-2 items-center">
          {/* USE HELD ITEM */}
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              touchControls.useItem = true;
              audio.playBoost();
            }}
            onMouseDown={() => {
              touchControls.useItem = true;
              audio.playBoost();
            }}
            className={`w-11 h-11 rounded-2xl backdrop-blur-md flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-90 ${
              currentItemDef
                ? 'bg-emerald-950/70 border-2 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                : 'bg-slate-900/35 border border-slate-700/40 opacity-60'
            }`}
            aria-label="Use Item"
          >
            {currentItemDef ? (
              <span className="text-lg drop-shadow">{currentItemDef.icon}</span>
            ) : (
              <span className="text-xs text-slate-500 font-bold">🎁</span>
            )}
          </button>

          {/* NITRO BOOST BUTTON */}
          <button
            {...bindTouch('nitro', 'nitro')}
            className={`w-13 h-13 rounded-full backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90 ${
              activeTouches.nitro
                ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 border-2 border-white text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.8)]'
                : 'bg-gradient-to-br from-amber-500/70 via-yellow-500/70 to-amber-600/70 border border-yellow-300/80 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
            }`}
            aria-label="Nitro Boost"
          >
            <span className="text-lg">⚡</span>
            <span className="text-[7.5px] font-black uppercase tracking-tighter -mt-1">NITRO</span>
          </button>
        </div>

        {/* Rightmost Primary Control: SPEED / GAS PEDAL */}
        <button
          {...bindTouch('accelerate', 'gas')}
          className={`w-16 h-22 sm:w-18 sm:h-24 rounded-3xl backdrop-blur-md flex flex-col items-center justify-center transition-all cursor-pointer shadow-xl active:scale-95 ${
            activeTouches.gas
              ? 'bg-gradient-to-t from-cyan-500 via-sky-400 to-cyan-300 border-2 border-white text-slate-950 shadow-[0_0_30px_rgba(0,240,255,0.8)]'
              : 'bg-gradient-to-t from-cyan-700/60 via-sky-600/60 to-cyan-500/60 border-2 border-cyan-400/80 text-white shadow-[0_0_15px_rgba(0,240,255,0.4)]'
          }`}
          aria-label="Speed Accelerate"
        >
          <span className="text-3xl text-white font-black drop-shadow">⚡</span>
          <span className="text-xs font-black italic uppercase text-slate-950 tracking-wider">GAS</span>
        </button>
      </div>
    </div>
  );
};
