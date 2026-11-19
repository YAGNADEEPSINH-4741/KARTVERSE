import React, { useEffect, useRef, useState } from 'react';
import type { GameEngine } from './game/GameEngine';
import { useGameStore } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { MultiplayerLobby } from './ui/MultiplayerLobby';
import { Garage } from './ui/Garage';
import { TrackSelect } from './ui/TrackSelect';
import { LeaderboardModal } from './ui/LeaderboardModal';
import { SettingsModal } from './ui/SettingsModal';
import { RaceHUD } from './ui/RaceHUD';
import { RaceResultsModal } from './ui/RaceResultsModal';
import { Brand } from './ui/Interface';
import { audio } from './audio/AudioManager';
import { socketManager } from './multiplayer/SocketManager';
import { resetTouchControls } from './input/TouchControls';
import { TRACKS } from './tracks/TrackData';

export const App = () => {
  const screen = useGameStore((s) => s.currentScreen);
  const status = useGameStore((s) => s.raceStatus);
  const kart = useGameStore((s) => s.selectedKart);
  const paint = useGameStore((s) => s.kartColor);
  const track = useGameStore((s) => s.selectedTrack);
  const online = useGameStore((s) => s.raceMode === 'MULTIPLAYER');
  const racing = [
    'QUICK_RACE',
    'GRAND_PRIX',
    'TIME_TRIAL',
    'BATTLE_ARENA',
  ].includes(screen);
  const stage = racing ? 'race' : screen === 'GARAGE' ? 'showroom' : null;
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [session, setSession] = useState(0);
  const [tourPoints, setTourPoints] = useState(0);
  function exitRace() {
    if (useGameStore.getState().roomCode) void socketManager.leaveRace();
    resetTouchControls();
    useGameStore.getState().setRaceStatus('IDLE');
    useGameStore.getState().setScreen('MENU');
    setTourPoints(0);
  }
  useEffect(() => {
    function initAudio() {
      audio.init();
      const s = useGameStore.getState();
      audio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume);
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    }
    const leave = () => {
      if (useGameStore.getState().roomCode)
        void socketManager.leaveRace('WINDOW_CLOSED');
    };
    window.addEventListener('pointerdown', initAudio);
    window.addEventListener('keydown', initAudio);
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('pagehide', leave);
    };
  }, []);
  useEffect(() => {
    if (!stage || !container.current) return;
    let active = true;
    setError('');
    setLoading('Loading race engine');
    const prepare = async () => {
      try {
        const { GameEngine } = await import('./game/GameEngine');
        if (!active) return;
        setLoading(
          stage === 'race'
            ? 'Preparing circuit and starting grid'
            : 'Preparing kart showroom',
        );
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        if (!active || !container.current) return;
        engine.current = new GameEngine(container.current);
        (window as any).__gameEngine = engine.current;
        if (stage === 'race') engine.current.initRaceSession();
        setLoading('');
      } catch {
        if (active) {
          setError(
            'The 3D renderer could not start. Enable WebGL or hardware acceleration in your browser and try again.',
          );
          setLoading('');
        }
      }
    };
    void prepare();
    return () => {
      active = false;
      resetTouchControls();
      engine.current?.destroy();
      engine.current = null;
      delete (window as any).__gameEngine;
    };
  }, [
    stage,
    session,
    stage === 'race' && !online ? track : null,
  ]);
  useEffect(() => {
    if (stage === 'showroom') engine.current?.updateShowroomKart();
  }, [kart, paint, stage]);
  function nextRace() {
    const s = useGameStore.getState();
    if (s.raceMode === 'GRAND_PRIX') {
      const tracks = Object.keys(TRACKS),
        next = tracks.indexOf(track) + 1;
      if (next < tracks.length) {
        setTourPoints(tourPoints + Math.max(0, 9 - s.telemetry.position));
        s.setRaceStatus('IDLE');
        s.setSelectedTrack(tracks[next]);
        return;
      }
      setTourPoints(0);
      s.setSelectedTrack(tracks[0]);
    }
    s.setRaceStatus('IDLE');
    setSession((n) => n + 1);
  }
  return (
    <div className="app">
      {stage && <div className="engine-layer" ref={container} />}
      {screen === 'MENU' && <MainMenu />}
      {screen === 'GARAGE' && <Garage />}
      {screen === 'TRACK_SELECT' && <TrackSelect />}
      {screen === 'MULTIPLAYER_LOBBY' && <MultiplayerLobby />}
      {screen === 'LEADERBOARD' && <LeaderboardModal />}
      {screen === 'SETTINGS' && <SettingsModal />}
      {racing && !loading && !error && <RaceHUD onExit={exitRace} />}
      {racing && status === 'FINISHED' && (
        <RaceResultsModal
          onRestart={nextRace}
          onExit={exitRace}
          tourPoints={tourPoints}
        />
      )}
      {stage && (loading || error) && (
        <div className="loading-screen" role="status">
          <Brand />
          {error ? (
            <>
              <p>{error}</p>
              <button className="btn primary" onClick={exitRace}>
                Race hub
              </button>
            </>
          ) : (
            <>
              <progress aria-label={loading} />
              <p>{loading}…</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
