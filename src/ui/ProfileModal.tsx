// ============================================================================
// KARTVERSE — Racer Identity & Profile Customization Modal
// Allows updating username in Supabase database in real-time
// ============================================================================

import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AuthService } from '../supabase/auth';
import { audio } from '../audio/AudioManager';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const profile = useGameStore(state => state.profile);
  const setProfile = useGameStore(state => state.setProfile);
  const selectedKart = useGameStore(state => state.selectedKart);

  const [username, setUsername] = useState(profile.username);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleRandomize = () => {
    audio.playMenuClick();
    const randomName = AuthService.generateRandomName();
    setUsername(randomName);
    setStatusMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    audio.playMenuClick();
    setIsSaving(true);
    setStatusMsg(null);

    const res = await AuthService.updateUsername(username, selectedKart);
    setProfile(res.profile);
    setIsSaving(false);

    if (res.success) {
      setStatusMsg({ type: 'success', text: `Racer identity updated to "${res.profile.username}" in Supabase!` });
      setTimeout(() => {
        onClose();
      }, 1400);
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Failed to update name in Supabase' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md p-6 md:p-8 rounded-3xl bg-slate-900/95 border-2 border-cyan-400/80 shadow-[0_0_50px_rgba(0,240,255,0.4)] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            audio.playMenuClick();
            onClose();
          }}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-bold"
        >
          ✕
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 via-pink-500 to-cyan-400 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(217,70,239,0.5)]">
            🏎️
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-cyan-400">
              RACER PROFILE
            </h2>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400">
              SUPABASE IDENTITY & CLOUD SYNC
            </p>
          </div>
        </div>

        {/* Level & XP Info Card */}
        <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 mb-6 flex justify-between items-center">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">RACER TIER</div>
            <div className="text-lg font-black text-yellow-400 flex items-center gap-2 mt-0.5">
              <span>★ LVL {profile.level}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-cyan-300 font-mono">{profile.xp} TOTAL XP</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">ACTIVE KART</div>
            <div className="text-xs font-black text-white uppercase tracking-wider mt-0.5">
              {profile.selected_kart.replace('_', ' ')}
            </div>
          </div>
        </div>

        {/* Edit Name Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs uppercase font-extrabold tracking-wider text-slate-300 mb-2">
              RACER HANDLE (IN-GAME NAME)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                placeholder="Enter racer name..."
                className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-cyan-500/50 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 font-bold text-white tracking-wide text-sm placeholder-slate-600 transition-all"
              />
              <button
                type="button"
                onClick={handleRandomize}
                title="Randomize Name"
                className="px-3.5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-lg transition-all cursor-pointer active:scale-95"
              >
                🎲
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Changes update your identity in Supabase database (`kart_users` table) and live multiplayer immediately.
            </p>
          </div>

          {/* Status Message */}
          {statusMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${
              statusMsg.type === 'success' 
                ? 'bg-green-500/20 border border-green-500/50 text-green-300' 
                : 'bg-red-500/20 border border-red-500/50 text-red-300'
            }`}>
              {statusMsg.text}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                audio.playMenuClick();
                onClose();
              }}
              className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSaving || !username.trim()}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 disabled:opacity-50 text-slate-950 font-black italic text-xs uppercase tracking-wider shadow-[0_0_20px_#00f0ff] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSaving ? 'SAVING...' : 'SAVE TO CLUSTER 💾'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

