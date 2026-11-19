import { Check, Paintbrush } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { Header, navigate } from './Interface';
const models = [
  ['speed_demon', 'Speed Demon'],
  ['cyber_glider', 'Cyber Glider'],
  ['vortex_striker', 'Vortex Striker'],
  ['quantum_leap', 'Quantum Leap'],
  ['hyper_drift', 'Hyper Drift'],
  ['shadow_phantom', 'Shadow Phantom'],
];
const paints = [
  ['Nitro orange', '#ff783d'],
  ['Ocean cyan', '#20d9e8'],
  ['Grid blue', '#1677ff'],
  ['Signal red', '#ed414b'],
  ['Solar gold', '#ffcc39'],
  ['Violet', '#af72ee'],
  ['Palm green', '#29c982'],
  ['Carbon', '#222831'],
];
export const Garage = () => {
  const kart = useGameStore((s) => s.selectedKart),
    paint = useGameStore((s) => s.kartColor);
  const setKart = useGameStore((s) => s.setSelectedKart),
    setPaint = useGameStore((s) => s.setKartColor);
  return (
    <div className="garage-page">
      <Header />
      <main className="content garage-main">
        <div className="garage-title">
          <p className="eyebrow">Vehicle selection</p>
          <h1 className="page-title">The garage</h1>
        </div>
        <div className="garage-selector">
          <label htmlFor="chassis">Chassis</label>
          <select
            id="chassis"
            value={kart}
            onChange={(e) => setKart(e.target.value)}
          >
            {models.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <section className="garage-deck">
          <div>
            <p className="eyebrow">
              <Paintbrush size={15} /> Body finish
            </p>
            <div className="swatches">
              {paints.map(([name, hex]) => (
                <button
                  key={hex}
                  aria-label={name}
                  aria-pressed={paint === hex}
                  title={name}
                  style={{ background: hex }}
                  onClick={() => setPaint(hex)}
                >
                  {paint === hex && <Check size={15} />}
                </button>
              ))}
              <label className="custom-paint" title="Custom paint">
                +
                <input
                  type="color"
                  aria-label="Custom paint"
                  value={paint}
                  onChange={(e) => setPaint(e.target.value)}
                />
              </label>
            </div>
          </div>
          <button className="btn primary" onClick={() => navigate('MENU')}>
            <Check size={17} /> Save & equip
          </button>
        </section>
      </main>
    </div>
  );
};
