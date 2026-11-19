import { useGameStore, GraphicsQuality } from '../store/gameStore';
import { audio } from '../audio/AudioManager';
import { Page } from './Interface';
export function SettingsModal() {
  const s = useGameStore();
  function volume(
    key: 'masterVolume' | 'sfxVolume' | 'musicVolume',
    value: number,
  ) {
    s.setSettings({ [key]: value });
    const next = useGameStore.getState();
    audio.setVolumes(next.masterVolume, next.musicVolume, next.sfxVolume);
  }
  return (
    <Page title="Settings" eyebrow="Driver preferences">
      <div className="lobby-grid">
        <section className="panel">
          <h2>Audio mix</h2>
          {(
            [
              ['masterVolume', 'Master'],
              ['musicVolume', 'Music'],
              ['sfxVolume', 'Sound effects'],
            ] as const
          ).map(([key, name]) => (
            <label className="slider" key={key}>
              {name}
              <strong>{Math.round(s[key] * 100)}%</strong>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={s[key]}
                onChange={(e) => volume(key, Number(e.target.value))}
              />
            </label>
          ))}
        </section>
        <section className="panel">
          <h2>Race setup</h2>
          <label htmlFor="quality">Graphics quality</label>
          <select
            id="quality"
            value={s.graphicsQuality}
            onChange={(e) =>
              s.setGraphicsQuality(e.target.value as GraphicsQuality)
            }
          >
            {['low', 'medium', 'high', 'ultra'].map((q) => (
              <option key={q} value={q}>
                {q[0].toUpperCase() + q.slice(1)}
              </option>
            ))}
          </select>
          <label htmlFor="difficulty">AI difficulty</label>
          <select
            id="difficulty"
            value={s.aiDifficulty}
            onChange={(e) =>
              s.setAIDifficulty(e.target.value as typeof s.aiDifficulty)
            }
          >
            {['EASY', 'MEDIUM', 'HARD'].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </section>
      </div>
    </Page>
  );
}
