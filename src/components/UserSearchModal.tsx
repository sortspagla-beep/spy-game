import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';
import { soundFX } from '../utils/sound.js';
import {
  Search,
  X,
  User,
  Trophy,
  Heart,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (identifier: string) => void;
}

export function UserSearchModal({
  isOpen,
  onClose,
  onSelectUser,
}: UserSearchModalProps) {
  const { searchUsers } = useGame();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const users = await searchUsers(trimmed);
      setResults(users);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-16 sm:pt-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#151B33] border-2 border-indigo-200 dark:border-indigo-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#10152B] border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-500 flex items-center justify-center">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-game font-black text-sm uppercase text-slate-800 dark:text-white leading-tight">
                Search Players
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ইউজারনেম লিখে প্লেয়ার খুঁজুন ও প্রোফাইল দেখুন
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 border-b border-indigo-100 dark:border-indigo-950 bg-white dark:bg-[#151B33]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type username (e.g. Nafiul, Player1)..."
              className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-[#0E1326] border-2 border-indigo-100 dark:border-indigo-900 rounded-2xl text-sm font-game font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 max-h-[380px] overflow-y-auto space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
              <span className="text-xs font-game font-bold">SEARCHING USERS...</span>
            </div>
          ) : !query.trim() ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <User className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs font-game font-bold">Search for any player by username</p>
              <p className="text-[11px]">Type at least one character to view instant matching profiles</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 space-y-1">
              <p className="text-xs font-game font-bold">No players found matching "{query}"</p>
              <p className="text-[11px]">Check the username spelling and try again.</p>
            </div>
          ) : (
            results.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#10152B] hover:bg-indigo-50/50 dark:hover:bg-[#192140] border-2 border-indigo-100 dark:border-indigo-950/70 rounded-2xl transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatarBadge
                    username={player.username}
                    avatarId={player.avatar}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-game font-black text-sm text-slate-900 dark:text-white truncate">
                        {player.name || player.username}
                      </span>
                      {player.role === 'HOST' && (
                        <span className="text-[9px] font-game font-black px-1.5 py-0.2 rounded-md bg-amber-400 text-amber-950">
                          HOST
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block leading-tight">
                      @{player.username}
                    </span>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3 text-amber-500" />
                        {player.stats?.winRate ?? 0}% Win Rate
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                        {player.likesCount ?? 0} Likes
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    onSelectUser(player.username);
                  }}
                  className="px-3.5 py-2 btn-game-coral font-game font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  <span>View Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
