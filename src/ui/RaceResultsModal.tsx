import { Flag, RotateCw, Trophy } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { TRACKS } from '../tracks/TrackData';
import { formatTime } from './Interface';
export function RaceResultsModal({
  onRestart,
  onExit,
  tourPoints,
}: {
  onRestart: () => void;
  onExit: () => void;
  tourPoints: number;
}) {
  const { telemetry: t, selectedTrack, raceMode } = useGameStore.getState();
  const tour = raceMode === 'GRAND_PRIX',
    round = Object.keys(TRACKS).indexOf(selectedTrack) + 1;
  const final = round === Object.keys(TRACKS).length;
  return (
    <div className="results-overlay">
      <section
        className="panel results"
        role="dialog"
        aria-label="Race results"
      >
        <Trophy className="section-icon" />
        <p className="eyebrow">{TRACKS[selectedTrack]?.name}</p>
        <h1 className="page-title">
          {t.position === 1 ? 'Victory' : 'Race complete'}
        </h1>
        <div className="result-stats">
          <div>
            <small>Position</small>
            <strong>
              {t.position} / {t.totalRacers}
            </strong>
          </div>
          <div>
            <small>Race time</small>
            <strong>{formatTime(t.raceTime)}</strong>
          </div>
          <div>
            <small>Best lap</small>
            <strong>
              {t.bestLapTime > 0 ? formatTime(t.bestLapTime) : '—'}
            </strong>
          </div>
        </div>
        {tour && (
          <p>
            Round {round} of {Object.keys(TRACKS).length} ·{' '}
            {tourPoints + Math.max(0, 9 - t.position)} championship points
          </p>
        )}
        <div className="action-row">
          <button className="btn secondary" onClick={onExit}>
            Race hub
          </button>
          {raceMode !== 'MULTIPLAYER' && (
            <button className="btn primary" onClick={onRestart}>
              {tour && !final ? <Flag size={16} /> : <RotateCw size={16} />}
              {tour ? (final ? 'Restart tour' : 'Next circuit') : 'Race again'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
