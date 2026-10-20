import React, { useState } from 'react';
import { useGame } from '../context/GameContext.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';
import { soundFX } from '../utils/sound.js';
import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  X,
  Check,
  ArrowRight,
  Trophy,
  Heart,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (identifier: string) => void;
}

export function FriendsModal({
  isOpen,
  onClose,
  onSelectUser,
}: FriendsModalProps) {
  const {
    friends,
    friendRequests,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
  } = useGame();

  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'REQUESTS'>('FRIENDS');
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async (requestId: string) => {
    setActionError(null);
    setLoadingActionId(requestId);
    const res = await acceptFriendRequest(requestId);
    setLoadingActionId(null);
    if (!res.success) {
      setActionError(res.error || 'Failed to accept request');
    }
  };

  const handleDecline = async (requestId: string) => {
    setActionError(null);
    setLoadingActionId(requestId);
    const res = await declineFriendRequest(requestId);
    setLoadingActionId(null);
    if (!res.success) {
      setActionError(res.error || 'Failed to decline request');
    }
  };

  const handleRemove = async (friendUserId: string) => {
    setActionError(null);
    setLoadingActionId(friendUserId);
    const res = await removeFriend(friendUserId);
    setLoadingActionId(null);
    setConfirmRemoveId(null);
    if (!res.success) {
      setActionError(res.error || 'Failed to remove friend');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#151B33] border-2 border-indigo-200 dark:border-indigo-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-pop-in">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-[#10152B] border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-game font-black text-sm uppercase text-slate-800 dark:text-white leading-tight">
                Friends Hub (বন্ধু)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage your friendships and incoming requests
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

        {/* Tab Switcher */}
        <div className="flex border-b-2 border-indigo-100 dark:border-indigo-950 bg-slate-50/50 dark:bg-[#0D1224] p-1.5 gap-1.5">
          {/* Tab 1: Friend List */}
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setActiveTab('FRIENDS');
              setActionError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-game font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'FRIENDS'
                ? 'bg-white dark:bg-[#151B33] text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Friend List</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {friends.length}
            </span>
          </button>

          {/* Tab 2: Requests */}
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              setActiveTab('REQUESTS');
              setActionError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-game font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'REQUESTS'
                ? 'bg-white dark:bg-[#151B33] text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-900'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Requests</span>
            {friendRequests.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                {friendRequests.length}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                0
              </span>
            )}
          </button>
        </div>

        {actionError && (
          <div className="m-3 p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 max-h-[400px] overflow-y-auto space-y-2.5">
          {activeTab === 'FRIENDS' ? (
            friends.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-30" />
                <p className="font-game font-bold text-xs">No friends added yet.</p>
                <p className="text-[11px] max-w-xs mx-auto">
                  Click on any player's name in the lobby chat or use the search bar to find and add friends!
                </p>
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3 bg-slate-50 dark:bg-[#10152B] border-2 border-indigo-100 dark:border-indigo-950/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerAvatarBadge
                      username={friend.username}
                      avatarId={friend.avatar}
                      size="md"
                    />
                    <div className="min-w-0">
                      <span className="font-game font-black text-sm text-slate-900 dark:text-white block truncate leading-tight">
                        {friend.name || friend.username}
                      </span>
                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block leading-tight">
                        @{friend.username}
                      </span>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-amber-500" />
                          {friend.stats?.winRate ?? 0}% Win Rate
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                          {friend.likesCount ?? 0} Likes
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundFX.playClick();
                        onSelectUser(friend.username);
                      }}
                      className="px-3 py-1.5 btn-game-coral font-game font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                      title="View Profile"
                    >
                      <span>Profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    {confirmRemoveId === friend.id ? (
                      <div className="flex items-center gap-1 bg-rose-100 dark:bg-rose-950/80 px-2 py-1 rounded-xl border border-rose-300 dark:border-rose-800">
                        <button
                          type="button"
                          onClick={() => handleRemove(friend.id)}
                          disabled={loadingActionId === friend.id}
                          className="px-2 py-0.5 bg-rose-600 text-white font-game font-bold text-[10px] rounded-lg cursor-pointer"
                        >
                          {loadingActionId === friend.id ? '...' : 'Remove'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-2 py-0.5 text-slate-600 dark:text-slate-300 font-game font-bold text-[10px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveId(friend.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                        title="Remove Friend"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          ) : friendRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <Clock className="w-10 h-10 mx-auto opacity-30" />
              <p className="font-game font-bold text-xs">No pending friend requests.</p>
              <p className="text-[11px]">When other players send you friend requests, they will show up here.</p>
            </div>
          ) : (
            friendRequests.map((req) => (
              <div
                key={req.id}
                className="p-3 bg-slate-50 dark:bg-[#10152B] border-2 border-indigo-100 dark:border-indigo-950/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatarBadge
                    username={req.fromUsername}
                    avatarId={req.fromAvatar}
                    size="md"
                  />
                  <div className="min-w-0">
                    <span className="font-game font-black text-sm text-slate-900 dark:text-white block truncate leading-tight">
                      {req.fromName || req.fromUsername}
                    </span>
                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 block leading-tight">
                      @{req.fromUsername}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Wants to be your friend
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      onSelectUser(req.fromUsername);
                    }}
                    className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-game font-bold cursor-pointer"
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAccept(req.id)}
                    disabled={loadingActionId === req.id}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-game font-black text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loadingActionId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    )}
                    <span>Accept</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecline(req.id)}
                    disabled={loadingActionId === req.id}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    title="Decline"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
