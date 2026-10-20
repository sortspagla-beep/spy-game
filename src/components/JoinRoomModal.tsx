import React, { useState } from 'react';
import { X, LogIn, AlertCircle, Key, Gamepad2, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext.js';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinRoomModal({ isOpen, onClose }: JoinRoomModalProps) {
  const { joinRoom } = useGame();
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanCode.length !== 5) {
      setError('Room code must be exactly 5 alphanumeric characters.');
      return;
    }

    setError(null);
    setIsJoining(true);
    const result = await joinRoom(cleanCode, password.trim() || undefined);
    setIsJoining(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Failed to join room. Verify the code.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    setRoomCode(val);
    if (error) setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-pop-in transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-[#151B33] border-3 border-indigo-200 dark:border-indigo-900/80 rounded-3xl shadow-2xl overflow-hidden transition-colors duration-300">
        {/* Header */}
        <div className="px-6 py-4 bg-indigo-50/70 dark:bg-[#10152B] border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-game font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            <Gamepad2 className="w-4 h-4 text-rose-500" />
            <span>JOIN PARTY ROOM</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs font-medium animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-game font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Enter 5-Character Passcode
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={handleChange}
              placeholder="e.g. SPY01"
              maxLength={5}
              autoFocus
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0E1326] border-2 border-slate-200 dark:border-indigo-950 rounded-2xl text-center font-mono text-3xl font-black tracking-[0.25em] text-cyan-600 dark:text-cyan-400 placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:border-cyan-400 transition-colors uppercase shadow-inner"
            />
            <p className="mt-2 text-xs font-medium text-slate-500 text-center">
              Ask your host for the 5-character room code.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-game font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Room Password (If Required)
              </label>
              <span className="text-[10px] font-game font-semibold text-cyan-600 dark:text-cyan-400">
                Optional
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Leave blank if room has no password"
                maxLength={24}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0E1326] border-2 border-slate-200 dark:border-indigo-950 rounded-2xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
              />
              <Key className="w-4 h-4 text-cyan-500 absolute left-3.5 top-3" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Only required if the host set a password when creating this room.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 btn-game-slate font-game font-bold text-xs tracking-wider rounded-2xl cursor-pointer"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={roomCode.length !== 5 || isJoining}
              className="flex-1 py-3 px-4 btn-game-coral font-game font-black text-xs tracking-wider rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>{isJoining ? 'JOINING...' : 'JOIN ROOM'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
