// ============================================================================
// KARTVERSE — Master Heads-Up Display Router (Desktop & Dedicated Mobile)
// Seamless Automatic Switching: Desktop Cockpit & Asphalt-Inspired Mobile HUD
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { POWER_UPS, PowerUpType } from '../items/PowerUpSystem';
import { TRACKS } from '../tracks/TrackData';
import { isMobileOrTablet, requestLandscapeOrientation } from '../utils/deviceDetection';
import { MobileRaceHUD } from './MobileRaceHUD';

export interface RaceHUDProps {
  onExit?: () => void;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({ onExit }) => {
  const telemetry = useGameStore(state => state.telemetry);
  const selectedTrack = useGameStore(state => state.selectedTrack);
  const miniMapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Active mini-turbo popup banner state
  const [boostBanner, setBoostBanner] = useState<{ text: string; color: string } | null>(null);

  // Self-dismissing countdown display to ensure "GO!" never persists
  const [visibleCountdown, setVisibleCountdown] = useState<number | null>(null);

  // Mobile / Tablet touch detection & screen auto-rotation
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const mobile = isMobileOrTablet();
      setIsTouchDevice(mobile);

      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);

      // Attempt orientation lock to landscape if on mobile/tablet
      if (mobile && portrait) {
        requestLandscapeOrientation().catch(() => {});
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  // Track geometry and bounding box computation for 2D minimap
  const trackConfig = TRACKS[selectedTrack] || TRACKS.sunset_coast;

  const trackCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3(trackConfig.points, true, 'catmullrom', 0.15);
  }, [trackConfig]);

  const trackSplinePoints = useMemo(() => {
    return trackCurve.getPoints(120);
  }, [trackCurve]);

  const trackBounds = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of trackSplinePoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    return {
      minX,
      maxX,
      minZ,
      maxZ,
      width: maxX - minX || 1,
      height: maxZ - minZ || 1
    };
  }, [trackSplinePoints]);

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
      let color = 'from-blue-500 to-cyan-400 text-cyan-100';
      if (text.includes('ULTRA')) {
        color = 'from-amber-400 via-yellow-300 to-amber-500 text-slate-950 shadow-[0_0_35px_#f59e0b]';
      } else if (text.includes('SUPER')) {
        color = 'from-sky-400 via-blue-500 to-cyan-300 text-white shadow-[0_0_35px_#0284c7]';
      } else {
        color = 'from-cyan-400 to-blue-600 text-white shadow-[0_0_35px_#00f0ff]';
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

  // Render Desktop 2D Full-Track Minimap Radar
  useEffect(() => {
    if (isTouchDevice) return; // Mobile uses its dedicated compact minimap
    const canvas = miniMapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pad = 14;
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

    // 1. Subtle background radar scanlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let y = 10; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // 2. Outer glowing track halo
    ctx.save();
    ctx.beginPath();
    trackSplinePoints.forEach((p, idx) => {
      const c = toCanvas(p.x, p.z);
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = themeGlow;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = themeGlow;
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.restore();

    // 3. Inner dark asphalt road
    ctx.save();
    ctx.beginPath();
    trackSplinePoints.forEach((p, idx) => {
      const c = toCanvas(p.x, p.z);
      if (idx === 0) ctx.moveTo(c.x, c.y);
      else ctx.lineTo(c.x, c.y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Center guide line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.restore();

    // 4. Start/Finish Line Gate Indicator
    if (trackSplinePoints.length > 1) {
      const p0 = toCanvas(trackSplinePoints[0].x, trackSplinePoints[0].z);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 5. Opponents (AI and Remote Players)
    if (telemetry.racerPositions && telemetry.racerPositions.length > 0) {
      telemetry.racerPositions.forEach((racer) => {
        if (racer.isPlayer) return;
        const pt = toCanvas(racer.x, racer.z);

        ctx.fillStyle = racer.kartColor || '#0284c7';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // 6. Local Player on Track (High Visibility Pulsing Icon)
      const playerPos = telemetry.racerPositions.find(r => r.isPlayer);
      if (playerPos) {
        const p = toCanvas(playerPos.x, playerPos.z);
        const pulse = (Date.now() % 1000) / 1000;

        ctx.strokeStyle = `rgba(0, 240, 255, ${0.7 * (1 - pulse)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + pulse * 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }, [isTouchDevice, telemetry.racerPositions, trackBounds, trackConfig.theme, trackSplinePoints]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden font-sans">
      {/* Dynamic Speed Lines during active Nitro */}
      {telemetry.isNitroActive && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,240,255,0.18)_100%)] animate-pulse pointer-events-none" />
      )}

      {/* Mini-Turbo Release Toast Notification */}
      {boostBanner && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center animate-bounce z-30">
          <div className={`px-5 py-2 rounded-2xl bg-gradient-to-r ${boostBanner.color} border-2 border-white/60 font-black italic text-xl md:text-2xl tracking-tighter shadow-2xl`}>
            ⚡ {boostBanner.text} ⚡
          </div>
        </div>
      )}

      {/* 1. Countdown Banner (Auto-dismisses after GO!) */}
      {visibleCountdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="text-center animate-bounce">
            <h1 className="text-7xl sm:text-8xl md:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-yellow-400 to-cyan-300 drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]">
              {visibleCountdown === 0 ? 'GO!!' : visibleCountdown}
            </h1>
          </div>
        </div>
      )}

      {/* 2. Wrong Way Alert */}
      {telemetry.isWrongWay && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-amber-500/95 text-slate-950 font-black text-xl md:text-2xl px-6 py-2 rounded-full border-2 border-yellow-300 shadow-[0_0_30px_#f59e0b] animate-pulse z-40">
          ⚠️ WRONG WAY! TURN AROUND!
        </div>
      )}

      {/* ==================================================================== */}
      {/* MOBILE HUD ROUTE: Professional, Clean, Maximum Road Visibility       */}
      {/* ==================================================================== */}
      {isTouchDevice ? (
        <>
          {/* Landscape Orientation Advisory (when smartphone held vertical/portrait) */}
          {isPortrait ? (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-6 text-center pointer-events-auto">
              <div className="relative mb-6">
                <div className="w-22 h-22 rounded-3xl bg-blue-900/40 border-2 border-cyan-400/80 flex items-center justify-center text-4xl shadow-[0_0_35px_rgba(0,240,255,0.4)] animate-bounce">
                  📱
                </div>
                <div className="absolute -bottom-2 -right-2 text-2xl animate-spin">
                  🔄
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-400 to-cyan-300 mb-2 drop-shadow-md">
                ROTATE DEVICE TO LANDSCAPE
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-sky-200 max-w-xs mb-5 leading-relaxed">
                Turn your phone sideways for wide-angle arcade racing and responsive full-screen controls!
              </p>
              <button
                onClick={() => requestLandscapeOrientation()}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black italic tracking-wider uppercase text-xs shadow-[0_0_25px_rgba(0,240,255,0.6)] active:scale-95 transition-all cursor-pointer"
              >
                AUTOROTATE & FULLSCREEN ⚡
              </button>
            </div>
          ) : (
            <MobileRaceHUD
              onExit={onExit}
              trackSplinePoints={trackSplinePoints}
              trackBounds={trackBounds}
              trackConfig={trackConfig}
            />
          )}
        </>
      ) : (
        /* ================================================================== */
        /* DESKTOP HUD ROUTE: Original Cockpit Layout Remains 100% Preserved   */
        /* ================================================================== */
        <>
          {/* Top Left: Premium Position Badge & Lap Counter */}
          <div className="absolute top-6 left-6 flex items-start gap-4">
            {/* Position Badge */}
            <div className={`backdrop-blur-md rounded-2xl px-5 py-3 flex items-baseline gap-1.5 transition-all shadow-2xl ${
              telemetry.position === 1
                ? 'bg-gradient-to-br from-amber-500/90 via-yellow-400/90 to-amber-600/90 border-2 border-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.6)]'
                : telemetry.position === 2
                ? 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-2 border-white text-slate-950 shadow-[0_0_25px_rgba(255,255,255,0.4)]'
                : telemetry.position === 3
                ? 'bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 border-2 border-amber-400 text-white shadow-[0_0_20px_rgba(217,119,6,0.5)]'
                : 'bg-blue-950/85 border-2 border-cyan-500/60 text-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
            }`}>
              <span className="text-3xl">
                {telemetry.position === 1 ? '👑' : telemetry.position === 2 ? '🥈' : telemetry.position === 3 ? '🥉' : '🏁'}
              </span>
              <span className="text-5xl md:text-6xl font-black italic tracking-tighter drop-shadow-md">
                {telemetry.position}
              </span>
              <span className="text-2xl font-black uppercase">
                {getRankSuffix(telemetry.position)}
              </span>
              <span className="text-sm font-bold opacity-75 ml-1">
                / {telemetry.totalRacers}
              </span>
            </div>

            {/* Lap Badge */}
            <div className="bg-blue-950/85 backdrop-blur-md border border-sky-500/50 rounded-2xl px-5 py-3 shadow-[0_0_20px_rgba(14,165,233,0.3)]">
              <div className="text-xs uppercase font-extrabold tracking-wider text-sky-300">LAP</div>
              <div className="text-3xl font-black italic text-white">
                {telemetry.currentLap} <span className="text-slate-400 text-lg">/ {telemetry.totalLaps}</span>
              </div>
            </div>
          </div>

          {/* Top Left (Below Badges): Live Standings Leaderboard Tower */}
          {telemetry.leaderboard && telemetry.leaderboard.length > 0 && (
            <div className="absolute top-28 left-6 hidden sm:flex flex-col gap-1 w-52 bg-blue-950/85 backdrop-blur-md border border-blue-900/80 rounded-2xl p-2.5 shadow-xl">
              <div className="flex justify-between items-center px-1.5 pb-1 border-b border-blue-900/60 text-[9px] font-black uppercase tracking-wider text-sky-400">
                <span>STANDINGS</span>
                <span className="text-cyan-400 animate-pulse">● LIVE</span>
              </div>
              <div className="flex flex-col gap-1 mt-0.5">
                {telemetry.leaderboard.slice(0, 8).map((r) => {
                  const isPlayer = r.isPlayer;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-all ${
                        isPlayer
                          ? 'bg-gradient-to-r from-cyan-500/30 to-blue-600/30 border border-cyan-400/80 text-cyan-200 font-black shadow-[0_0_12px_rgba(0,240,255,0.35)]'
                          : 'bg-blue-900/30 text-slate-200 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`w-4 text-[10px] font-black ${
                          r.rank === 1 ? 'text-yellow-400' : r.rank === 2 ? 'text-slate-200' : r.rank === 3 ? 'text-amber-500' : 'text-sky-300'
                        }`}>
                          #{r.rank}
                        </span>
                        <span className="truncate max-w-[100px] text-[11px]">
                          {r.name}
                        </span>
                        {isPlayer && (
                          <span className="text-[8px] bg-cyan-400 text-slate-950 font-black px-1 rounded uppercase tracking-wider">
                            YOU
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-sky-400/70 font-mono">
                        L{r.lap}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Right: Timer & Best Lap */}
          <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
            <div className="bg-blue-950/85 backdrop-blur-md border border-sky-900/60 rounded-2xl px-5 py-2 text-right shadow-lg">
              <div className="text-xs uppercase font-bold text-sky-300">RACE TIME</div>
              <div className="text-2xl font-mono font-black text-yellow-400">
                {formatTime(telemetry.raceTime)}
              </div>
            </div>

            {telemetry.bestLapTime > 0 && (
              <div className="bg-blue-950/70 backdrop-blur-sm border border-sky-900/60 rounded-xl px-4 py-1.5 text-right">
                <span className="text-xs font-semibold text-sky-300 mr-2">BEST:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{formatTime(telemetry.bestLapTime)}</span>
              </div>
            )}
          </div>

          {/* Center Top: Held Item Box & Exit Race Button (Desktop) */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            {onExit && (
              <button
                onClick={onExit}
                className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-xs font-black uppercase text-slate-300 hover:text-white transition-all cursor-pointer pointer-events-auto shadow-lg"
              >
                ← EXIT RACE
              </button>
            )}

            <div className="relative w-20 h-20 bg-blue-950/90 backdrop-blur-md border-2 border-yellow-400/80 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(250,204,21,0.4)]">
              {currentItemDef ? (
                <div className="flex flex-col items-center animate-pulse">
                  <span className="text-4xl">{currentItemDef.icon}</span>
                  <span className="text-[10px] font-black uppercase text-yellow-300 mt-1 tracking-tighter">
                    [SPACE] USE
                  </span>
                </div>
              ) : (
                <span className="text-3xl text-sky-700 font-bold">?</span>
              )}
            </div>
          </div>

          {/* Bottom Right: Speedometer & Nitro Meter */}
          <div className="absolute bottom-6 right-6 flex flex-col items-end gap-3 z-20">
            {/* Nitro Meter */}
            <div className={`w-48 bg-blue-950/85 backdrop-blur-md rounded-xl p-2.5 transition-all shadow-lg ${
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
            <div className="bg-blue-950/90 backdrop-blur-md rounded-3xl px-7 py-4 flex items-baseline gap-2 transition-all border-2 border-cyan-500/60 shadow-[0_0_30px_rgba(0,240,255,0.25)]">
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

          {/* Bottom Left: Full-Circuit Spline Minimap Radar */}
          <div className="absolute bottom-20 left-6 z-20">
            <div className="w-44 h-44 rounded-3xl bg-blue-950/85 backdrop-blur-md border border-cyan-500/50 p-2 shadow-[0_0_25px_rgba(0,240,255,0.25)] flex flex-col items-center justify-between relative overflow-hidden">
              <div className="w-full flex justify-between items-center px-1 text-[9px] font-black uppercase tracking-wider text-cyan-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  RADAR
                </span>
                <span className="text-sky-300 truncate max-w-[80px]">
                  {trackConfig.name}
                </span>
              </div>

              <canvas
                ref={miniMapCanvasRef}
                width={160}
                height={136}
                className="w-full h-full my-auto"
              />

              <div className="w-full flex justify-between items-center px-1 text-[8px] font-mono text-sky-400/80">
                <span>MAP 2D</span>
                <span className="text-cyan-300">● LIVE POS</span>
              </div>
            </div>
          </div>

          {/* Desktop Keyboard Controls Tips */}
          <div className="absolute bottom-6 left-6 bg-blue-950/75 backdrop-blur-sm border border-sky-900/60 rounded-xl px-4 py-2 text-xs text-sky-200 flex gap-4 z-20">
            <div><kbd className="bg-blue-900 px-1.5 py-0.5 rounded text-white font-mono">W / ↑</kbd> Gas</div>
            <div><kbd className="bg-blue-900 px-1.5 py-0.5 rounded text-white font-mono">Shift</kbd> Drift</div>
            <div><kbd className="bg-blue-900 px-1.5 py-0.5 rounded text-white font-mono">Space</kbd> Item</div>
            <div><kbd className="bg-blue-900 px-1.5 py-0.5 rounded text-white font-mono">N</kbd> Nitro</div>
            <div><kbd className="bg-blue-900 px-1.5 py-0.5 rounded text-white font-mono">R</kbd> Reset</div>
          </div>
        </>
      )}
    </div>
  );
};
