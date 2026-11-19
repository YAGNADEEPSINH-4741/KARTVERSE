import React, { useEffect, useState } from 'react';
import { Check, Copy, Flag, LogOut, Plus, Users } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { socketManager } from '../multiplayer/SocketManager';
import { TRACKS } from '../tracks/TrackData';
import { Page, RouteMap, navigate } from './Interface';

export const MultiplayerLobby = () => {
  const {
    roomCode,
    isHost,
    roomPlayers,
    profile,
    selectedKart,
    kartColor,
    selectedTrack,
    setRaceMode,
    setScreen,
  } = useGameStore();
  const [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false);
  const local = roomPlayers.find(
    (p) => p.id === socketManager.getLocalPlayerId(),
  );
  const track = TRACKS[selectedTrack] || TRACKS.sunset_coast;
  function leave() {
    void socketManager.leaveRace();
  }
  async function enter(host: boolean) {
    setError('');
    if (!host && code.length !== 6) {
      setError('Enter the six-character room code.');
      return;
    }
    setBusy(true);
    try {
      if (host)
        await socketManager.createRoom(
          profile.username,
          selectedKart,
          kartColor,
        );
      else
        await socketManager.joinRoom(
          code,
          profile.username,
          selectedKart,
          kartColor,
        );
      setRaceMode('MULTIPLAYER');
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not connect to the room.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
    } catch {
      setError('Select the room code to copy it.');
    }
  }
  useEffect(() => {
    if (copied) {
      const id = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(id);
    }
  }, [copied]);
  return (
    <Page
      title={roomCode ? 'Race room' : 'Multiplayer'}
      eyebrow="Private grid"
      beforeNavigate={leave}
    >
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!roomCode ? (
        <div className="lobby-grid">
          <section className="panel">
            <Users className="section-icon" />
            <h2>Host a race</h2>
            <p>
              Choose a circuit and share your six-character room code with the
              other drivers.
            </p>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => enter(true)}
            >
              <Plus size={17} /> Create room
            </button>
          </section>
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              void enter(false);
            }}
          >
            <Flag className="section-icon" />
            <h2>Join the grid</h2>
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              autoComplete="off"
              value={code}
              maxLength={8}
              placeholder="KV8F2A"
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 6),
                )
              }
            />
            <button className="btn secondary" disabled={busy}>
              Join room
            </button>
          </form>
        </div>
      ) : (
        <div className="lobby-grid">
          <section className="panel">
            <p className="eyebrow">Room code</p>
            <div className="code-row">
              <strong data-room-code>{roomCode}</strong>
              <button
                className="icon-button"
                aria-label="Copy room code"
                onClick={copy}
              >
                {copied ? <Check /> : <Copy />}
              </button>
            </div>
            <h2>
              Starting grid <small>{roomPlayers.length} / 8</small>
            </h2>
            <ul className="roster">
              {roomPlayers.map((p) => (
                <li key={p.id}>
                  <span
                    className="driver-dot"
                    style={{ background: p.kartColor }}
                  />
                  <strong>{p.username}</strong>
                  <span className={p.isReady ? 'ready' : ''}>
                    {p.isHost ? 'Host' : p.isReady ? 'Ready' : 'Waiting'}
                  </span>
                </li>
              ))}
            </ul>
            {isHost ? (
              <button
                className="btn primary"
                disabled={
                  busy ||
                  roomPlayers.length < 2 ||
                  roomPlayers.some((p) => !p.isReady)
                }
                onClick={() => {
                  socketManager.startRace();
                  setRaceMode('MULTIPLAYER');
                  setScreen('QUICK_RACE');
                }}
              >
                <Flag size={17} /> Start race
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={() => socketManager.toggleReady(!local?.isReady)}
              >
                <Check size={17} />
                {local?.isReady ? 'Cancel ready' : 'Set ready'}
              </button>
            )}
            <button
              className="back"
              onClick={() => {
                leave();
                navigate('MENU');
              }}
            >
              <LogOut size={15} /> Leave room
            </button>
          </section>
          <section className="panel room-track">
            <RouteMap track={track} />
            <h2>{track.name}</h2>
            <p>{track.tagline}</p>
            {isHost ? (
              <>
                <label htmlFor="room-track">Circuit</label>
                <select
                  id="room-track"
                  value={track.id}
                  onChange={(e) => socketManager.setTrack(e.target.value)}
                >
                  {Object.values(TRACKS).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p>The host selects the circuit and starts the race.</p>
            )}
          </section>
        </div>
      )}
    </Page>
  );
};
