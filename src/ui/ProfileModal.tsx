import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { AuthService } from '../supabase/auth';
import { Modal } from './Interface';
export function ProfileModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const s = useGameStore.getState(),
    [name, setName] = useState(s.profile.username),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  if (!isOpen) return null;
  return (
    <Modal title="Driver profile" onClose={onClose}>
      <p>
        Level {s.profile.level} · {s.profile.xp} XP
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          try {
            const result = await AuthService.updateUsername(
              name,
              s.selectedKart,
            );
            useGameStore.getState().setProfile(result.profile);
            if (result.error)
              setMessage('Saved on this device. Cloud sync is unavailable.');
            else onClose();
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="handle">Driver name</label>
        <div className="input-row">
          <input
            id="handle"
            autoFocus
            maxLength={24}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Generate driver name"
            onClick={() => setName(AuthService.generateRandomName())}
          >
            <Shuffle size={18} />
          </button>
        </div>
        {message && <p role="status">{message}</p>}
        <button className="btn primary" disabled={busy || !name.trim()}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </Modal>
  );
}
