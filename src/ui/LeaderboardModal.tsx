import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { LeaderboardService, LeaderboardEntry } from '../supabase/leaderboard';
import { TRACKS } from '../tracks/TrackData';
import { useGameStore } from '../store/gameStore';
import { Page, formatTime } from './Interface';
export function LeaderboardModal() {
  const [track, setTrack] = useState(useGameStore.getState().selectedTrack);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]),
    [status, setStatus] = useState('loading'),
    [attempt, setAttempt] = useState(0);
  const [device, setDevice] = useState(false);
  const rows = device
    ? LeaderboardService.getDeviceLeaderboard(track)
    : entries;
  useEffect(() => {
    let live = true;
    setStatus('loading');
    LeaderboardService.getTrackLeaderboard(track, 10)
      .then((rows) => {
        if (live) {
          setEntries(rows);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (live) setStatus('offline');
      });
    return () => {
      live = false;
    };
  }, [track, attempt]);
  return (
    <Page title="Leaderboard" eyebrow="Circuit records">
      <section className="panel">
        <div className="records-head">
          <h2>Fastest finishes</h2>
          <div className="record-scope" aria-label="Record source">
            <button
              className="btn secondary"
              aria-pressed={!device}
              onClick={() => setDevice(false)}
            >
              Cloud
            </button>
            <button
              className="btn secondary"
              aria-pressed={device}
              onClick={() => setDevice(true)}
            >
              This device
            </button>
          </div>
          <label>
            Circuit
            <select value={track} onChange={(e) => setTrack(e.target.value)}>
              {Object.values(TRACKS).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {(device || status === 'ready') && rows.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Driver</th>
                <th>Finish time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.username}</td>
                  <td>{formatTime(r.completion_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" role="status">
            <Timer />
            <p>
              {device
                ? 'No finishes saved on this device for this circuit yet.'
                : status === 'loading'
                  ? 'Loading circuit records…'
                  : status === 'offline'
                    ? 'Circuit records are unavailable.'
                    : 'No finishes recorded for this circuit yet.'}
            </p>
            {!device && status === 'offline' && (
              <button
                className="btn secondary"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </section>
    </Page>
  );
}
