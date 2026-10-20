import React from 'react';
import { LogOut, Crown, ArrowLeft, Gamepad2, Sparkles, UserPen, Search, Users } from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { HorrorAudioButton } from './HorrorAudioButton.js';
import { ThemeToggle } from './ThemeToggle.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';
import { isMainAdmin } from '../utils/hostUtils.js';
import { soundFX } from '../utils/sound.js';

interface NavbarProps {
  onOpenHostDashboard?: () => void;
  onOpenProfileModal?: () => void;
}

export function Navbar({ onOpenHostDashboard, onOpenProfileModal }: NavbarProps) {
  const {
    user,
    logout,
    room,
    leaveRoom,
    friendRequests,
    setIsFriendsModalOpen,
    setIsSearchModalOpen,
  } = useGame();

  if (!user) return null;

  const isMain = isMainAdmin(user);
  const isHost =
    isMain ||
    user.role === 'HOST' ||
    user.role === 'ADMIN' ||
    user.username.toLowerCase() === 'admin' ||
    user.username.toLowerCase() === 'nafiul';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0F1426]/95 backdrop-blur-md border-b-2 border-indigo-100 dark:border-indigo-950/80 shadow-xs transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* Zone 1: Cartoon Game Wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-sm border-2 border-white/40 dark:border-white/20 transform -rotate-3 hover:rotate-0 transition-transform">
            <Gamepad2 className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-game text-xl sm:text-2xl font-black tracking-wide uppercase bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 drop-shadow-xs">
              SPY GAME
            </span>

            {/* Main Admin / Host Panel Trigger */}
            {isHost && (
              <button
                type="button"
                onClick={onOpenHostDashboard}
                className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-game font-bold tracking-wider px-2.5 py-1 rounded-full cursor-pointer shadow-xs active:scale-95 transition-all ${
                  isMain
                    ? 'text-amber-950 dark:text-amber-200 bg-amber-400 hover:bg-amber-300 dark:bg-amber-900/90 dark:hover:bg-amber-800 border-2 border-amber-500 dark:border-amber-600'
                    : 'text-amber-900 dark:text-amber-300 bg-amber-300 hover:bg-amber-200 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-700/80'
                }`}
                title="Open Host & Admin Dashboard"
              >
                <Crown className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300 fill-current" />
                <span>{isMain ? 'MAIN ADMIN' : 'HOST PANEL'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Zone 2: Room Game Status / Center Display */}
        <div className="flex items-center gap-3">
          {room ? (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-[#161C33] border-2 border-indigo-200 dark:border-indigo-800/80 px-3 py-1 rounded-2xl shadow-xs">
              <span className="text-[10px] font-game uppercase font-bold text-indigo-500 dark:text-indigo-400">
                ROOM
              </span>
              <span className="font-mono text-xs sm:text-sm font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                {room.code}
              </span>
              <button
                onClick={leaveRoom}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer ml-1 text-xs font-semibold"
                title="Leave Room"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Exit</span>
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 text-xs font-game font-semibold text-indigo-600/80 dark:text-indigo-400/80 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Multiplayer Party Lobby</span>
            </div>
          )}
        </div>

        {/* Zone 3: Search + Friends + Audio + Theme + Player Profile Button + Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Search User Button */}
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setIsSearchModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#161C33] dark:hover:bg-[#1E2540] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-game font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Search user by username"
          >
            <Search className="w-3.5 h-3.5 text-cyan-500" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Friend Hub Button */}
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setIsFriendsModalOpen(true);
            }}
            className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#161C33] dark:hover:bg-[#1E2540] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-game font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            title="Friend list & requests"
          >
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Friend</span>
            {friendRequests.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce-subtle shadow-xs">
                {friendRequests.length}
              </span>
            )}
          </button>

          <HorrorAudioButton />
          <ThemeToggle />

          {/* Player Profile & Avatar Button (Click to edit profile & photo) */}
          <button
            type="button"
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#161C33] dark:hover:bg-[#1E2540] border border-slate-200 dark:border-slate-800/80 pl-1 pr-2.5 py-1 rounded-full transition-all cursor-pointer shadow-xs group"
            title="Edit profile & avatar"
          >
            <PlayerAvatarBadge
              username={user.username}
              avatarId={user.avatar}
              size="sm"
            />
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 max-w-[80px] sm:max-w-[120px] truncate leading-tight">
                {user.name || user.username}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono leading-none flex items-center gap-0.5">
                @{user.username}
                <UserPen className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-cyan-500 transition-opacity ml-0.5" />
              </span>
            </div>
          </button>

          <button
            onClick={logout}
            className="p-2 sm:px-3 sm:py-1.5 text-xs font-game font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-100 hover:bg-rose-50 dark:bg-[#161C33] dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 rounded-xl transition-all cursor-pointer shadow-xs"
            title="Log out of game"
          >
            <LogOut className="w-3.5 h-3.5 inline sm:mr-1.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>
    </header>
  );
}
