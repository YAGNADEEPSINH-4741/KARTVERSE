// ============================================================================
// KARTVERSE — Real-Time Multiplayer Lobby Screen
// Room Creation, 6-Char Code Joining, Player Roster, Ready State
// Host Track Card Selection with Real-Time Multi-Client Sync
// ============================================================================

import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketManager } from '../multiplayer/SocketManager';
import { audio } from '../audio/AudioManager';
import { TRACKS } from '../tracks/TrackData';

export const MultiplayerLobby: React.FC = () => {
  const setScreen = useGameStore(state => state.setScreen);
  const setRaceMode = useGameStore(state => state.setRaceMode);
  const profile = useGameStore(state => state.profile);
  const selectedKart = useGameStore(state => state.selectedKart);
  const kartColor = useGameStore(state => state.kartColor);
  const selectedTrack = useGameStore(state => state.selectedTrack);
  const setSelectedTrack = useGameStore(state => state.setSelectedTrack);

  const roomCode = useGameStore(state => state.roomCode);
  const isHost = useGameStore(state => state.isHost);
  const roomPlayers = useGameStore(state => state.roomPlayers);

  const [inputCode, setInputCode] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      audio.playMenuClick();
      await socketManager.createRoom(profile.username, selectedKart, kartColor);
      setRaceMode('MULTIPLAYER');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!inputCode.trim()) {
      setErrorMsg('Please enter a 6-character room code');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      audio.playMenuClick();
      await socketManager.joinRoom(inputCode.trim().toUpperCase(), profile.username, selectedKart, kartColor);
      setRaceMode('MULTIPLAYER');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReady = () => {
    audio.playMenuClick();
    const next = !isReady;
    setIsReady(next);
    socketManager.toggleReady(next);
  };

  const handleSelectTrack = (trackId: string) => {
    if (!isHost) return;
    audio.playMenuClick();
    setSelectedTrack(trackId);
    socketManager.setTrack(trackId);
  };

  const handleStartRace = () => {
    audio.playMenuClick();
    socketManager.startRace();
    setScreen('QUICK_RACE');
  };

  const handleLeaveRoom = () => {
    audio.playMenuClick();
    socketManager.disconnect();
    useGameStore.getState().setRoomCode(null);
    setScreen('MENU');
  };

  const currentTrackData = TRACKS[selectedTrack] || TRACKS.sunset_coast;

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-10 z-10 select-none overflow-y-auto bg-slate-950/90 backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center w-full">
        <div>
          <button
            onClick={handleLeaveRoom}
            className="text-xs uppercase font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-1.5"
          >
            ← BACK TO MENU
          </button>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-pink-500">
            ONLINE MULTIPLAYER
          </h1>
        </div>

        {roomCode && (
          <div className="flex items-center gap-3 bg-purple-900/40 border-2 border-purple-500/60 px-5 py-2.5 rounded-2xl shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            <span className="text-xs uppercase font-extrabold text-purple-300">ROOM CODE:</span>
            <span className="text-2xl font-mono font-black text-yellow-300 tracking-widest">
              {roomCode}
            </span>
            <button
              onClick={handleCopyCode}
              className="px-2.5 py-1 rounded-lg bg-purple-600/60 hover:bg-purple-500 text-xs font-bold text-white uppercase transition-all cursor-pointer"
              title="Copy Room Code"
            >
              {copied ? '✓ COPIED' : '📋 COPY'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="my-auto max-w-5xl w-full mx-auto py-4">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-900/50 border border-red-500 text-red-200 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {!roomCode ? (
          // Room Entry Options (Create or Join)
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Create Room Card */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-purple-500/40 backdrop-blur-md shadow-2xl flex flex-col justify-between">
              <div>
                <span className="text-4xl">👑</span>
                <h2 className="text-2xl font-black italic text-white mt-4">HOST A RACE</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Generate a private 6-character room code. Choose the track and invite friends or rivals!
                </p>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="mt-8 w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black italic text-lg tracking-wider uppercase shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'CREATING ROOM...' : 'CREATE ROOM'}
              </button>
            </div>

            {/* Join Room Card */}
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-cyan-500/40 backdrop-blur-md shadow-2xl flex flex-col justify-between">
              <div>
                <span className="text-4xl">🔑</span>
                <h2 className="text-2xl font-black italic text-white mt-4">JOIN A RACE</h2>
                <p className="text-sm text-slate-400 mt-2">
                  Enter a 6-character room code provided by the host.
                </p>

                <div className="mt-6">
                  <input
                    type="text"
                    maxLength={6}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="ENTER 6-CHAR CODE"
                    className="w-full bg-slate-950 border-2 border-cyan-500/50 focus:border-cyan-400 rounded-xl px-5 py-4 text-center font-mono text-2xl font-black tracking-widest text-cyan-300 placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleJoinRoom}
                disabled={loading}
                className="mt-8 w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black italic text-lg tracking-wider uppercase shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'CONNECTING...' : 'JOIN ROOM'}
              </button>
            </div>
          </div>
        ) : (
          // In-Room Lobby Roster & Track Selection
          <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
            {/* Header: Racers in Lobby */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-black italic text-white flex items-center gap-2">
                  <span>RACERS IN LOBBY</span>
                  <span className="text-cyan-400 font-mono text-lg font-bold">({roomPlayers.length} / 8)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  {isHost ? 'You are the Host! Choose a track below and start when racers are ready.' : 'Waiting for the host to select track and launch race.'}
                </p>
              </div>
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {roomPlayers.map((player) => (
                <div
                  key={player.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between shadow-inner"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-md"
                      style={{ backgroundColor: player.kartColor || '#9333ea' }}
                    >
                      🏎️
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-white flex items-center gap-1">
                        <span className="truncate max-w-[90px]">{player.username}</span>
                        {player.isHost && <span className="text-xs text-yellow-400" title="Host">👑</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">
                        {player.kartId.replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                    player.isReady 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {player.isReady ? 'READY' : 'WAITING'}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Track Selection Cards (Phase 4 Requirement) */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-400">
                    {isHost ? '🎮 HOST TRACK SELECTION (CLICK TO SELECT)' : '🗺️ HOST SELECTED TRACK'}
                  </span>
                  {!isHost && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-bold animate-pulse">
                      LIVE SYNC
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Current: <strong className="text-white">{currentTrackData.name}</strong> ({currentTrackData.laps} Laps)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {Object.values(TRACKS).map((t) => {
                  const isSelected = t.id === selectedTrack;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelectTrack(t.id)}
                      className={`relative p-3 rounded-2xl transition-all duration-200 border-2 text-left ${
                        isHost ? 'cursor-pointer transform hover:-translate-y-1' : 'cursor-default'
                      } ${
                        isSelected
                          ? 'bg-gradient-to-b from-cyan-950/80 to-slate-900 border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.45)] ring-2 ring-cyan-400/40'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {/* Theme Icon & Difficulty */}
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="text-xl">
                          {t.theme === 'BEACH' ? '🏝️' : t.theme === 'CYBER' ? '🌆' : t.theme === 'FOREST' ? '🌲' : t.theme === 'LAVA' ? '🌋' : '❄️'}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                          t.difficulty === 'EASY' ? 'bg-green-500/20 text-green-300 border border-green-500/40' :
                          t.difficulty === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
                          'bg-red-500/20 text-red-300 border border-red-500/40'
                        }`}>
                          {t.difficulty}
                        </span>
                      </div>

                      <div className="font-black italic text-sm text-white truncate">
                        {t.name}
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 min-h-[30px]">
                        {t.tagline}
                      </p>

                      <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-800/80 text-[9px] text-slate-400 font-bold">
                        <span>{t.laps} LAPS</span>
                        {isSelected && (
                          <span className="text-cyan-400 font-black animate-pulse">✓ ACTIVE</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
              <button
                onClick={handleLeaveRoom}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-colors cursor-pointer"
              >
                LEAVE ROOM
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleReady}
                  className={`px-6 py-3 rounded-xl font-black italic tracking-wider text-sm uppercase transition-all cursor-pointer ${
                    isReady
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                  }`}
                >
                  {isReady ? 'UNREADY' : 'SET READY'}
                </button>

                {isHost && (
                  <button
                    onClick={handleStartRace}
                    className="px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black italic tracking-wider text-sm uppercase shadow-[0_0_25px_rgba(0,240,255,0.5)] transition-all cursor-pointer active:scale-95"
                  >
                    START RACE 🏁
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-slate-500">
        Kartverse Authoritative Multiplayer Engine • 20Hz Real-Time Synchronization
      </div>
    </div>
  );
};
