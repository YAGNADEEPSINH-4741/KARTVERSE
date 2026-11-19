import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Menu,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import { useGameStore, ScreenState, GameRaceMode } from '../store/gameStore';
import { TRACKS, createTrackCurve, TrackConfig } from '../tracks/TrackData';
import { audio } from '../audio/AudioManager';
import { ProfileModal } from './ProfileModal';

export const navigate = (screen: ScreenState) => {
  audio.playMenuClick();
  useGameStore.getState().setScreen(screen);
};

export function startRace(mode: GameRaceMode, trackId?: string) {
  const store = useGameStore.getState();
  if (trackId) store.setSelectedTrack(trackId);
  store.setRaceMode(mode);
  navigate(
    mode === 'TIME_TRIAL' || mode === 'GRAND_PRIX' ? mode : 'QUICK_RACE',
  );
}

export function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 44 32" aria-hidden="true">
        <path d="M7 3h9L8 29H0zM20 3h8l-4 12L35 3h9L30 18l6 11H26l-6-10-3 10H10z" />
      </svg>
      <span>
        KART<span>VERSE</span>
      </span>
    </span>
  );
}

const routes: [ScreenState, string][] = [
  ['MENU', 'Race hub'],
  ['GARAGE', 'Garage'],
  ['TRACK_SELECT', 'Circuits'],
  ['LEADERBOARD', 'Leaderboard'],
];

export function Header({ beforeNavigate }: { beforeNavigate?: () => void }) {
  const screen = useGameStore((s) => s.currentScreen);
  const profile = useGameStore((s) => s.profile);
  const [menu, setMenu] = useState(false);
  const [identity, setIdentity] = useState(false);
  const go = (next: ScreenState) => {
    if (next !== screen) beforeNavigate?.();
    setMenu(false);
    navigate(next);
  };
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand-link"
            aria-label="KartVerse home"
            onClick={() => go('MENU')}
          >
            <Brand />
          </button>
          <nav
            className={'navigation' + (menu ? ' opened' : '')}
            aria-label="Main navigation"
          >
            {routes.map(([id, label]) => (
              <button
                key={id}
                aria-current={screen === id ? 'page' : undefined}
                onClick={() => go(id)}
              >
                {label}
              </button>
            ))}
            <button
              className="mobile-only"
              onClick={() => go('MULTIPLAYER_LOBBY')}
            >
              Multiplayer
            </button>
          </nav>
          <div className="user-actions">
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => go('SETTINGS')}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="profile-button"
              onClick={() => {
                setMenu(false);
                setIdentity(true);
              }}
            >
              <span className="avatar">
                <UserRound size={17} />
              </span>
              <span className="profile-name">{profile.username}</span>
              <ChevronDown size={14} />
            </button>
            <button
              className="menu-toggle icon-button"
              aria-label={menu ? 'Close menu' : 'Open menu'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {identity && <ProfileModal isOpen onClose={() => setIdentity(false)} />}
    </>
  );
}

export function Page({
  children,
  title,
  eyebrow,
  beforeNavigate,
  className = '',
}: React.PropsWithChildren<{
  title: string;
  eyebrow?: string;
  beforeNavigate?: () => void;
  className?: string;
}>) {
  return (
    <div className={'page scroll-page ' + className}>
      <Header beforeNavigate={beforeNavigate} />
      <main className="content subpage">
        <button
          className="back"
          onClick={() => {
            beforeNavigate?.();
            navigate('MENU');
          }}
        >
          <ArrowLeft size={15} /> Race hub
        </button>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function getRouteDrawing(track: TrackConfig) {
  const curve = createTrackCurve(track);
  const points = curve.getSpacedPoints(192);
  const xs = points.map((p) => p.x),
    zs = points.map((p) => p.z);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  const scale = Math.min(144 / (maxX - minX), 72 / (maxZ - minZ));
  const project = (x: number, z: number) => [
    80 + (x - (minX + maxX) / 2) * scale,
    44 - (z - (minZ + maxZ) / 2) * scale,
  ];
  return {
    project,
    length: curve.getLength(),
    path:
      'M' +
      points
        .map((p) =>
          project(p.x, p.z)
            .map((n) => n.toFixed(2))
            .join(','),
        )
        .join('L') +
      'Z',
    start: project(points[0].x, points[0].z),
  };
}

export function RouteMap({
  track,
  racers = [],
}: {
  track: TrackConfig;
  racers?: { x: number; z: number; isPlayer: boolean; kartColor?: string }[];
}) {
  const drawing = useMemo(() => getRouteDrawing(track), [track]);
  return (
    <svg
      viewBox="0 0 160 88"
      role="img"
      aria-label={track.name + ' course map'}
      className="route-map"
    >
      <path
        d={drawing.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <rect
        x={drawing.start[0] - 2.5}
        y={drawing.start[1] - 2.5}
        width="5"
        height="5"
        fill="#ff783d"
      />
      {racers.map((r, i) => {
        const [x, y] = drawing.project(r.x, r.z);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r.isPlayer ? 3.8 : 2.6}
            fill={r.isPlayer ? '#fff' : r.kartColor || '#20d9e8'}
            stroke="#101827"
            strokeWidth="1"
          />
        );
      })}
    </svg>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: React.PropsWithChildren<{ title: string; onClose: () => void }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className="kv-dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <section>
        <div className="dialog-top">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </dialog>
  );
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  return (
    Math.floor(seconds / 60) +
    ':' +
    String(Math.floor(seconds % 60)).padStart(2, '0') +
    '.' +
    String(Math.floor(seconds * 100) % 100).padStart(2, '0')
  );
}

export function CourseListLink() {
  return (
    <button className="text-link" onClick={() => navigate('TRACK_SELECT')}>
      All circuits <ArrowRight size={15} />
    </button>
  );
}
