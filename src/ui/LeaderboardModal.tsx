// ============================================================================
// KARTVERSE — Global Leaderboard & Record Times Screen (Supabase)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { LeaderboardService, LeaderboardEntry } from '../supabase/leaderboard';
import { TRACKS } from '../tracks/TrackData';
import { audio } from '../audio/AudioManager';

export const LeaderboardModal: React.FC = () => {
  const setScreen = useGameStore(state => state.setScreen);
  const [selectedTrack, setSelectedTrack] = useState('sunset_coast');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    LeaderboardService.getTrackLeaderboard(selectedTrack, 10)
      .then(data => {
        if (isMounted) {
          setEntries(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTrack]);

  const formatTime = (secs: number) => {
    if (!secs) return '--:--.--';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 100);
    return `${mins}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-8 md:p-12 z-10 select-none overflow-hidden bg-slate-950/80 backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center w-full">
        <div>
          <button
            onClick={() => setScreen('MENU')}
            className="text-xs uppercase font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-2"
          >
            ← BACK TO MENU
          </button>
          <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400">
            CIRCUIT HALL OF FAME
          </h1>
        </div>
      </div>

      {/* Main Container */}
      <div className="my-auto max-w-4xl w-full mx-auto bg-slate-900/85 backdrop-blur-md border border-slate-700/80 rounded-3xl p-8 shadow-2xl">
        {/* Track Selection Tabs */}
        <div className="flex flex-wrap gap-2 pb-6 border-b border-slate-800">
          {Object.values(TRACKS).map(t => (
            <button
              key={t.id}
              onClick={() => {
                audio.playMenuClick();
                setSelectedTrack(t.id);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black italic tracking-wider uppercase transition-all cursor-pointer ${
                selectedTrack === t.id
                  ? 'bg-yellow-400 text-slate-950 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Results Table */}
        <div className="mt-6 overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-slate-400 font-bold">
              Fetching Supabase Leaderboard Data...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-slate-500 font-bold">
              No lap times recorded for this circuit yet. Be the first champion!
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-black uppercase text-slate-400">
                  <th className="py-3 px-4">RANK</th>
                  <th className="py-3 px-4">RACER</th>
                  <th className="py-3 px-4">KART</th>
                  <th className="py-3 px-4">BEST LAP</th>
                  <th className="py-3 px-4 text-right">TOTAL TIME</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.id || index}
                    className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-black italic text-lg text-yellow-400">
                      {index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `${index + 1}th`}
                    </td>
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <span>🏎️</span> {entry.username}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase">
                      {entry.kart_id.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-sm font-semibold text-green-400">
                      {formatTime(entry.best_lap_time)}
                    </td>
                    <td className="py-3 px-4 font-mono text-base font-black text-white text-right">
                      {formatTime(entry.finish_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        Live database synchronization via Supabase PostgreSQL & RLS.
      </div>
    </div>
  );
};

