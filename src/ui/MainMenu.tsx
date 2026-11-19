import { useGameStore } from '../store/gameStore';
import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Flag,
  Keyboard,
  MapPin,
  Play,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { TRACKS } from '../tracks/TrackData';
import {
  Brand,
  CourseListLink,
  Header,
  Modal,
  navigate,
  RouteMap,
  startRace,
} from './Interface';

const featured = TRACKS.sunset_coast;
const modes = [
  {
    name: 'Quick race',
    tag: 'SINGLE PLAYER',
    detail: 'Take on seven AI rivals.',
    icon: Flag,
    kart: 'speed_demon',
    tone: 'orange',
    run: () => startRace('QUICK_RACE'),
  },
  {
    name: 'Multiplayer',
    tag: 'ONLINE RACING',
    detail: 'Host or join a private grid.',
    icon: Users,
    kart: 'cyber_glider',
    tone: 'blue',
    run: () => navigate('MULTIPLAYER_LOBBY'),
  },
  {
    name: 'Time trial',
    tag: 'SOLO CHALLENGE',
    detail: 'Chase your fastest lap.',
    icon: Timer,
    kart: 'shadow_phantom',
    tone: 'mint',
    run: () => startRace('TIME_TRIAL'),
  },
  {
    name: 'Grand Prix',
    tag: 'CHAMPIONSHIP',
    detail: 'Race the five-circuit tour.',
    icon: Trophy,
    kart: 'quantum_leap',
    tone: 'violet',
    run: () => startRace('GRAND_PRIX', Object.keys(TRACKS)[0]),
  },
];
const keys = [
  ['W / ↑', 'Accelerate'],
  ['A D / ← →', 'Steer'],
  ['S / ↓', 'Brake and reverse'],
  ['Shift', 'Drift'],
  ['N / F', 'Nitro'],
  ['E / Space', 'Use item'],
  ['R', 'Return to track'],
];
export const MainMenu = () => {
  const [controls, setControls] = useState(false);
  return (
    <div className="page scroll-page">
      <Header />
      <main className="content hub">
        <section className="feature-poster" aria-labelledby="feature-heading">
          <img
            className="poster-image"
            src="/assets/images/sunset-island-hero.webp"
            alt="An orange open-wheel kart sweeps past the island coast at sunset"
            fetchPriority="high"
          />
          <div className="poster-shade" />
          <div className="poster-content">
            <div className="feature-label">
              <span className="lane-stripes" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>{' '}
              Featured circuit
            </div>
            <h1 id="feature-heading">
              <span>Sunset</span>
              <span>Island Circuit</span>
            </h1>
            <p>
              Carve through coastal hairpins, hit the boost and race the last
              light across the island.
            </p>
            <div className="action-row">
              <button
                className="btn primary"
                onClick={() => startRace('QUICK_RACE', featured.id)}
              >
                <Play size={16} fill="currentColor" /> Play now
              </button>
              <button
                className="btn secondary"
                onClick={() => navigate('MULTIPLAYER_LOBBY')}
              >
                <Users size={18} /> Multiplayer
              </button>
            </div>
          </div>
          <div className="poster-foot">
            <div className="poster-meta">
              <span>
                <MapPin /> Tropical coast
              </span>
              <i />
              <span>
                <Flag /> {featured.laps} laps
              </span>
            </div>
            <button onClick={() => navigate('TRACK_SELECT')}>
              Circuit guide <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <section className="mode-section">
          <div className="section-heading">
            <h2>
              <i />
              Race modes
            </h2>
            <button className="text-link" onClick={() => setControls(true)}>
              <Keyboard size={17} /> How to play
            </button>
          </div>
          <div className="mode-grid">
            {modes.map(({ name, tag, detail, icon: Icon, kart, tone, run }) => (
              <button key={name} className={'mode-card ' + tone} onClick={run}>
                <span className="mode-art">
                  <img
                    loading="lazy"
                    src={'/assets/karts/' + kart + '.webp'}
                    alt=""
                  />
                </span>
                <span className="mode-tag">
                  <Icon size={14} />
                  {tag}
                </span>
                <strong>{name}</strong>
                <span className="mode-copy">{detail}</span>
                <ArrowUpRight className="mode-arrow" size={15} />
              </button>
            ))}
          </div>
        </section>
        <section className="track-showcase">
          <div className="section-heading">
            <h2>
              <i />
              Circuit selection
            </h2>
            <CourseListLink />
          </div>
          <div className="preview-grid">
            {Object.values(TRACKS)
              .slice(0, 3)
              .map((track) => (
                <button
                  key={track.id}
                  className={'track-preview biome-' + track.theme}
                  onClick={() => {
                    selectTrack(track.id);
                  }}
                >
                  <img
                    src={'/assets/circuits/' + track.id + '.webp'}
                    alt=""
                    loading="lazy"
                  />
                  <div className="track-overlay" />
                  <div>
                    <small>
                      {track.difficulty} · {track.laps} LAPS
                    </small>
                    <strong>{track.name}</strong>
                  </div>
                  <RouteMap track={track} />
                </button>
              ))}
          </div>
        </section>
        <footer>
          <Brand />
          <button onClick={() => setControls(true)}>Controls</button>
          <button onClick={() => navigate('SETTINGS')}>Settings</button>
          <a
            href="https://github.com/YAGNADEEPSINH-4741/KARTVERSE"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
      {controls && (
        <Modal title="How to play" onClose={() => setControls(false)}>
          <p>
            Pass each checkpoint in order and cross the finish line after three
            laps. Drive through item boxes for a power-up.
          </p>
          <dl className="controls-list">
            {keys.map(([key, action]) => (
              <div key={key}>
                <dt>{action}</dt>
                <dd>
                  <kbd>{key}</kbd>
                </dd>
              </div>
            ))}
          </dl>
          <p>
            On touchscreens, steer with your left thumb and use the pedals on
            the right. Hold drift through a turn and release for a mini-turbo.
          </p>
        </Modal>
      )}
    </div>
  );
};
function selectTrack(id: string) {
  useGameStore.getState().setSelectedTrack(id);
  navigate('TRACK_SELECT');
}
