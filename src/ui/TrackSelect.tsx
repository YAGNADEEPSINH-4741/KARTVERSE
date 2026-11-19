import { ArrowRight, Check, Flag, Route } from 'lucide-react';
import { TRACKS } from '../tracks/TrackData';
import { Page, RouteMap, startRace, getRouteDrawing } from './Interface';
import { useGameStore } from '../store/gameStore';

export const TrackSelect = () => {
  const id = useGameStore((s) => s.selectedTrack),
    select = useGameStore((s) => s.setSelectedTrack);
  const active = TRACKS[id] || TRACKS.sunset_coast;
  const length = (getRouteDrawing(active).length / 1000).toFixed(2);
  return (
    <Page title="Circuit guide" eyebrow="Track selection">
      <div className="course-detail">
        <div
          className="course-banner"
          style={{
            backgroundImage: 'url(/assets/circuits/' + active.id + '.webp)',
          }}
        >
          <div className="course-banner-content">
            <span className="feature-label">{active.difficulty} circuit</span>
            <h2>{active.name}</h2>
            <p>{active.tagline}</p>
            <div className="course-facts">
              <span>
                <Route />
                {length} km
              </span>
              <span>
                <Flag />
                {active.laps} laps
              </span>
            </div>
            <button
              className="btn primary"
              onClick={() => startRace('QUICK_RACE', active.id)}
            >
              Race this circuit <ArrowRight size={17} />
            </button>
          </div>
          <RouteMap track={active} />
        </div>
        <div className="course-options">
          {Object.values(TRACKS).map((t) => (
            <button
              className={'course-option ' + (t === active ? 'selected' : '')}
              aria-pressed={t === active}
              key={t.id}
              onClick={() => select(t.id)}
            >
              <RouteMap track={t} />
              <span>
                <small>{t.difficulty}</small>
                <strong>{t.name}</strong>
              </span>
              {t === active && <Check size={16} />}
            </button>
          ))}
        </div>
      </div>
    </Page>
  );
};
