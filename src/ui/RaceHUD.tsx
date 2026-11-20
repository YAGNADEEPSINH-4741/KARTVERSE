import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Diamond,
  Droplet,
  Flame,
  ListOrdered,
  Magnet,
  Map,
  Orbit,
  Package,
  Rocket,
  Shield,
  Zap,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { POWER_UPS, PowerUpType } from '../items/PowerUpSystem';
import { TRACKS } from '../tracks/TrackData';
import { isMobileOrTablet } from '../utils/deviceDetection';
import { MobileRaceHUD } from './MobileRaceHUD';
import { formatTime, RouteMap } from './Interface';
const itemIcons = {
  ROCKET_BOOST: Rocket,
  SHIELD: Shield,
  OIL_TRAP: Droplet,
  HOMING_ORB: Orbit,
  LIGHTNING_PULSE: Zap,
  TURBO_CHARGE: Flame,
  MYSTERY_BOX: Package,
  SPEED_MAGNET: Magnet,
};
export function RaceHUD({ onExit }: { onExit: () => void }) {
  const t = useGameStore((s) => s.telemetry),
    id = useGameStore((s) => s.selectedTrack);
  const track = TRACKS[id] || TRACKS.sunset_coast;
  const [mobile, setMobile] = useState(isMobileOrTablet),
    [standings, setStandings] = useState(!mobile),
    [map, setMap] = useState(true);
  useEffect(() => {
    const resize = () => setMobile(isMobileOrTablet());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const key = t.currentItem as PowerUpType,
    Item = itemIcons[key] || Diamond;
  return (
    <div className={'race-hud ' + (mobile ? 'touch-hud' : 'desktop-hud')}>
      <div className="hud-top-left">
        <button className="hud-btn" aria-label="Exit race" onClick={onExit}>
          <ArrowLeft size={17} />
          {!mobile && 'Exit race'}
        </button>
        <div className="timing-panel">
          <div>
            <small>Position</small>
            <strong>
              {t.position}
              <em> / {t.totalRacers}</em>
            </strong>
          </div>
          <div>
            <small>Lap</small>
            <strong>
              {t.currentLap}
              <em> / {t.totalLaps}</em>
            </strong>
          </div>
          <div>
            <small>Race time</small>
            <b>{formatTime(t.raceTime)}</b>
          </div>
        </div>
        <button
          className="hud-btn"
          aria-expanded={standings}
          onClick={() => setStandings(!standings)}
        >
          <ListOrdered size={16} />
          {!mobile && 'Standings'}
        </button>
        {standings && (
          <ol className="race-standings">
            {t.leaderboard?.map((row) => (
              <li key={row.id} className={row.isPlayer ? 'self' : ''}>
                <b>{row.rank}</b>
                <span>{row.name}{row.isFinished && ' · Finished'}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="hud-top-right">
        <button
          className="hud-btn"
          aria-expanded={map}
          onClick={() => setMap(!map)}
        >
          <Map size={16} />
          {!mobile && track.name}
        </button>
        {map && (
          <div className="hud-map">
            <RouteMap track={track} racers={t.racerPositions} />
          </div>
        )}
      </div>
      {t.countdownNumber != null && (
        <div className="countdown">{t.countdownNumber || 'GO!'}</div>
      )}
      {(t.isWrongWay || t.miniTurboNotification) && (
        <strong className="race-alert">
          {t.isWrongWay ? 'Wrong way' : t.miniTurboNotification}
        </strong>
      )}
      <div className="speed-panel">
        <div>
          <strong>{Math.round(Math.abs(t.speedKmh))}</strong>
          <small>{t.isReversing ? 'REV' : 'KM/H'}</small>
        </div>
        <div className="nitro-line">
          <Zap size={13} />
          <meter aria-label="Nitro" min={0} max={100} value={t.nitroPercent} />
        </div>
        {t.driftLevel > 0 && <small>Drift · {t.driftLevel}</small>}
      </div>
      {(key || !mobile) && (
        <div className="item-slot">
          <Item size={20} />
          <span>{POWER_UPS[key]?.name || 'No item'}</span>
          {!mobile && <kbd>E</kbd>}
        </div>
      )}
      {!mobile && (
        <div className="drive-keys">
          <span>
            <kbd>WASD</kbd> Drive
          </span>
          <span>
            <kbd>Shift</kbd> Drift
          </span>
          <span>
            <kbd>Space</kbd> Nitro
          </span>
        </div>
      )}
      {mobile && <MobileRaceHUD />}
    </div>
  );
}
