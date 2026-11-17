// ============================================================================
// KARTVERSE — Master Application Component & Screen Router
// Always-on 3D Studio Canvas + Translucent High-Octane Glassmorphic UI
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { GameEngine } from './game/GameEngine';
import { MainMenu } from './ui/MainMenu';
import { MultiplayerLobby } from './ui/MultiplayerLobby';
import { Garage } from './ui/Garage';
import { TrackSelect } from './ui/TrackSelect';
import { LeaderboardModal } from './ui/LeaderboardModal';
import { SettingsModal } from './ui/SettingsModal';
import { RaceHUD } from './ui/RaceHUD';
import { RaceResultsModal } from './ui/RaceResultsModal';
import { audio } from './audio/AudioManager';

export const App: React.FC = () => {
  const currentScreen = useGameStore(state => state.currentScreen);
  const raceStatus = useGameStore(state => state.raceStatus);
  const selectedKart = useGameStore(state => state.selectedKart);
  const kartColor = useGameStore(state => state.kartColor);
  const selectedTrack = useGameStore(state => state.selectedTrack);
  const setScreen = useGameStore(state => state.setScreen);
  const setRaceStatus = useGameStore(state => state.setRaceStatus);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Initialize Web Audio on first user interaction
  useEffect(() => {
    const handleFirstGesture = () => {
      audio.init();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('keydown', handleFirstGesture);

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // Mount 3D GameEngine once on mount
  useEffect(() => {
    if (canvasContainerRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasContainerRef.current);
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const isRacingScreen = ['QUICK_RACE', 'GRAND_PRIX', 'TIME_TRIAL', 'BATTLE_ARENA'].includes(currentScreen);

  // Switch engine between Showroom and Race sessions
  useEffect(() => {
    if (!engineRef.current) return;

    if (isRacingScreen) {
      if (engineRef.current.mode !== 'RACING') {
        engineRef.current.initRaceSession();
      }
    } else {
      if (engineRef.current.mode !== 'SHOWROOM') {
        engineRef.current.initShowroomSession();
      } else {
        engineRef.current.updateShowroomKart();
      }
    }
  }, [isRacingScreen, currentScreen, selectedKart, kartColor, selectedTrack]);

  const handleRestartRace = () => {
    if (engineRef.current) {
      engineRef.current.initRaceSession();
    }
  };

  const handleExitToMenu = () => {
    audio.playMenuClick();
    if (engineRef.current) {
      engineRef.current.initShowroomSession();
    }
    setRaceStatus('IDLE');
    setScreen('MENU');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Permanent 3D WebGL Canvas Layer */}
      <div ref={canvasContainerRef} className="absolute inset-0 z-0" />

      {/* In-Race HUD & Results Overlay */}
      {isRacingScreen && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <RaceHUD />

          {/* Exit / Pause Button */}
          <button
            onClick={handleExitToMenu}
            className="absolute top-6 left-1/2 -translate-x-1/2 -ml-28 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/80 text-xs font-black uppercase text-slate-300 hover:text-white transition-all cursor-pointer pointer-events-auto shadow-lg"
          >
            ← EXIT RACE
          </button>

          {raceStatus === 'FINISHED' && (
            <div className="pointer-events-auto">
              <RaceResultsModal onRestart={handleRestartRace} />
            </div>
          )}
        </div>
      )}

      {/* Menu Screens Overlay (Translucent glassmorphism) */}
      {!isRacingScreen && (
        <div className="absolute inset-0 z-10 pointer-events-auto">
          {currentScreen === 'MENU' && <MainMenu />}
          {currentScreen === 'MULTIPLAYER_LOBBY' && <MultiplayerLobby />}
          {currentScreen === 'GARAGE' && <Garage />}
          {currentScreen === 'TRACK_SELECT' && <TrackSelect />}
          {currentScreen === 'LEADERBOARD' && <LeaderboardModal />}
          {currentScreen === 'SETTINGS' && <SettingsModal />}
        </div>
      )}
    </div>
  );
};
