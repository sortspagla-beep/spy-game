import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';
import { FullUserProfileResponse } from '../types.js';
import { soundFX } from '../utils/sound.js';
import {
  X,
  Heart,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  Trophy,
  Flame,
  Zap,
  Percent,
  Gamepad2,
  Crown,
  Loader2,
  Shield,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

interface UserProfileModalProps {
  identifier: string | null;
  onClose: () => void;
  onOpenEditProfile?: () => void;
}

export function UserProfileModal({
  identifier,
  onClose,
  onOpenEditProfile,
}: UserProfileModalProps) {
  const {
    user: currentUser,
    fetchUserProfile,
    likeUserProfile,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
  } = useGame();

  const [profileData, setProfileData] = useState<FullUserProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [likeSuccessAnim, setLikeSuccessAnim] = useState<boolean>(false);
  const [confirmRemoveFriend, setConfirmRemoveFriend] = useState<boolean>(false);

  useEffect(() => {
    if (!identifier) {
      setProfileData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setConfirmRemoveFriend(false);

    fetchUserProfile(identifier)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setProfileData(data);
        } else {
          setError('User profile could not be found.');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Failed to load user profile.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [identifier]);

  if (!identifier) return null;

  const isSelf =
    currentUser &&
    profileData &&
    (currentUser.id === profileData.user.id ||
      currentUser.username.toLowerCase() === profileData.user.username.toLowerCase());

  const formatCooldown = (ms: number) => {
    if (ms <= 0) return 'now';
    const totalMinutes = Math.ceil(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleLike = async () => {
    if (!profileData || isSelf || !profileData.canLike || actionLoading) return;
    setActionLoading(true);
    const res = await likeUserProfile(profileData.user.id);
    setActionLoading(false);
    if (res.success) {
      setLikeSuccessAnim(true);
      setTimeout(() => setLikeSuccessAnim(false), 2000);
      setProfileData({
        ...profileData,
        likesCount: res.likesCount ?? profileData.likesCount + 1,
        canLike: false,
        likeCooldownMs: 24 * 60 * 60 * 1000,
      });
    } else {
      setError(res.error || 'Failed to like profile.');
    }
  };

  const handleSendFriendRequest = async () => {
    if (!profileData || isSelf || actionLoading) return;
    setActionLoading(true);
    const res = await sendFriendRequest(profileData.user.id);
    setActionLoading(false);
    if (res.success) {
      setProfileData({
        ...profileData,
        friendshipStatus: 'REQUEST_SENT',
      });
    } else {
      setError(res.error || 'Failed to send friend request.');
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!profileData || !profileData.pendingRequestId || actionLoading) return;
    setActionLoading(true);
    const res = await acceptFriendRequest(profileData.pendingRequestId);
    setActionLoading(false);
    if (res.success) {
      setProfileData({
        ...profileData,
        friendshipStatus: 'FRIENDS',
        pendingRequestId: undefined,
      });
    } else {
      setError(res.error || 'Failed to accept friend request.');
    }
  };

  const handleRemoveFriend = async () => {
    if (!profileData || isSelf || actionLoading) return;
    setActionLoading(true);
    const res = await removeFriend(profileData.user.id);
    setActionLoading(false);
    if (res.success) {
      setConfirmRemoveFriend(false);
      setProfileData({
        ...profileData,
        friendshipStatus: 'NONE',
      });
    } else {
      setError(res.error || 'Failed to remove friend.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#141A33] border-2 border-indigo-200 dark:border-indigo-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative animate-pop-in">
        {/* Header background banner */}
        <div className="h-28 bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-500 relative flex items-start justify-end p-3">
          <button
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Content Area */}
        <div className="px-6 pb-6 pt-0 relative">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <span className="font-game font-bold text-xs">LOADING PLAYER PROFILE...</span>
            </div>
          ) : error || !profileData ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="font-game font-bold text-sm text-slate-700 dark:text-slate-300">
                {error || 'Player profile not found'}
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2 btn-game-coral font-game font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Avatar + Main Info Floating over Banner */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 -mt-12">
                <div className="flex items-end gap-3.5">
                  <div className="p-1 bg-white dark:bg-[#141A33] rounded-3xl shadow-md border-2 border-indigo-100 dark:border-indigo-900">
                    <PlayerAvatarBadge
                      username={profileData.user.username}
                      avatarId={profileData.user.avatar}
                      size="xl"
                      className="border-2 border-white dark:border-indigo-800"
                    />
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-xl font-black font-game text-slate-900 dark:text-white leading-tight">
                        {profileData.user.name || profileData.user.username}
                      </h2>
                      {profileData.user.role === 'HOST' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-game font-black bg-amber-400 text-amber-950 shadow-xs">
                          <Crown className="w-3 h-3 fill-current" />
                          HOST
                        </span>
                      )}
                      {profileData.user.role === 'ADMIN' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-game font-black bg-purple-500 text-white shadow-xs">
                          <Shield className="w-3 h-3 fill-current" />
                          ADMIN
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      @{profileData.user.username}
                    </span>
                  </div>
                </div>

                {/* Total Likes Badge */}
                <div className="self-start sm:self-end flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-900 px-3 py-1.5 rounded-2xl shadow-xs">
                  <Heart
                    className={`w-4 h-4 text-rose-500 fill-rose-500 ${
                      likeSuccessAnim ? 'animate-ping' : ''
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-game font-bold text-rose-600 dark:text-rose-400 uppercase leading-none">
                      Total Likes
                    </span>
                    <span className="text-sm font-black font-game text-rose-700 dark:text-rose-300 leading-tight">
                      {profileData.likesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statistics Grid - 5 Critical Stats from Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-game font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Game Statistics (খেলার পরিসংখ্যান)</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* 1. Total Matches Played */}
                  <div className="p-3 bg-slate-50 dark:bg-[#10152B] border-2 border-slate-200 dark:border-indigo-950 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-indigo-500">
                      <Gamepad2 className="w-4 h-4" />
                      <span className="text-[10px] font-game font-bold text-slate-400">MATCHES</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xl font-black font-game text-slate-800 dark:text-slate-100">
                        {profileData.stats.gamesPlayed}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        মোট ম্যাচ খেলেছে
                      </div>
                    </div>
                  </div>

                  {/* 2. Matches Won in Own Role */}
                  <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                      <Trophy className="w-4 h-4" />
                      <span className="text-[10px] font-game font-bold text-emerald-600 dark:text-emerald-400">WON</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xl font-black font-game text-emerald-700 dark:text-emerald-300">
                        {profileData.stats.gamesWon}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        রোলে জয়
                      </div>
                    </div>
                  </div>

                  {/* 3. Winning Rate % */}
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-900/60 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                      <Percent className="w-4 h-4" />
                      <span className="text-[10px] font-game font-bold text-amber-600 dark:text-amber-400">RATE</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xl font-black font-game text-amber-700 dark:text-amber-300">
                        {profileData.stats.winRate}%
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        উইনিং রেট
                      </div>
                    </div>
                  </div>

                  {/* 4. Best Win Streak */}
                  <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-900/60 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-rose-500">
                      <Flame className="w-4 h-4" />
                      <span className="text-[10px] font-game font-bold text-rose-500">BEST STREAK</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xl font-black font-game text-rose-700 dark:text-rose-300">
                        {profileData.stats.highestStreak}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        টানা সর্বোচ্চ জয়
                      </div>
                    </div>
                  </div>

                  {/* 5. Current Win Streak */}
                  <div className="p-3 bg-cyan-50/70 dark:bg-cyan-950/30 border-2 border-cyan-200 dark:border-cyan-900/60 rounded-2xl flex flex-col justify-between col-span-2 sm:col-span-2">
                    <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
                      <Zap className="w-4 h-4" />
                      <span className="text-[10px] font-game font-bold text-cyan-600 dark:text-cyan-400">ACTIVE STREAK</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <div>
                        <div className="text-xl font-black font-game text-cyan-700 dark:text-cyan-300">
                          {profileData.stats.currentStreak}{' '}
                          <span className="text-xs font-bold text-slate-500">matches in a row</span>
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          বর্তমান টানা জয়ের সংখ্যা
                        </div>
                      </div>
                      {profileData.stats.currentStreak >= 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-white font-game font-bold text-[10px] animate-pulse">
                          ON FIRE 🔥
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Like Button & Friend Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-indigo-950 space-y-3">
                {isSelf ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenEditProfile) onOpenEditProfile();
                      }}
                      className="flex-1 py-3 px-4 btn-game-coral font-game font-bold text-xs tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>EDIT MY PROFILE &amp; AVATAR</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {/* Row 1: Like Profile Button (24-Hour Cooldown) */}
                    <div>
                      {profileData.canLike ? (
                        <button
                          type="button"
                          onClick={handleLike}
                          disabled={actionLoading}
                          className="w-full py-3 px-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-game font-black text-xs tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Heart className="w-4 h-4 fill-white" />
                          <span>LIKE THIS PROFILE ❤️ (+1)</span>
                        </button>
                      ) : (
                        <div className="w-full py-2.5 px-4 bg-slate-100 dark:bg-[#10152B] border-2 border-slate-200 dark:border-indigo-950 rounded-2xl flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-game font-bold">
                          <Heart className="w-4 h-4 text-rose-400 fill-rose-400/40" />
                          <span>Liked! Next like in:</span>
                          <span className="font-mono text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatCooldown(profileData.likeCooldownMs)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Row 2: Friend Request Actions */}
                    <div>
                      {profileData.friendshipStatus === 'NONE' && (
                        <button
                          type="button"
                          onClick={handleSendFriendRequest}
                          disabled={actionLoading}
                          className="w-full py-3 px-4 btn-game-teal font-game font-black text-xs tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                          <span>SEND FRIEND REQUEST (ফ্রেন্ড রিকোয়েস্ট পাঠাও)</span>
                        </button>
                      )}

                      {profileData.friendshipStatus === 'REQUEST_SENT' && (
                        <div className="w-full py-2.5 px-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl flex items-center justify-center gap-2 font-game font-bold text-xs">
                          <Clock className="w-4 h-4 text-amber-600" />
                          <span>Friend Request Sent (পেন্ডিং রিকোয়েস্ট পাঠানো হয়েছে)</span>
                        </div>
                      )}

                      {profileData.friendshipStatus === 'REQUEST_RECEIVED' && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleAcceptFriendRequest}
                            disabled={actionLoading}
                            className="flex-1 py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-game font-black text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>ACCEPT FRIEND REQUEST</span>
                          </button>
                        </div>
                      )}

                      {profileData.friendshipStatus === 'FRIENDS' && (
                        <div>
                          {confirmRemoveFriend ? (
                            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex items-center justify-between gap-2">
                              <span className="text-[11px] font-game font-bold text-rose-800 dark:text-rose-200">
                                Remove as friend?
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleRemoveFriend}
                                  disabled={actionLoading}
                                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-game font-bold text-xs rounded-xl cursor-pointer"
                                >
                                  Yes, Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemoveFriend(false)}
                                  className="px-3 py-1 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-game font-bold text-xs rounded-xl cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl">
                              <span className="flex items-center gap-1.5 font-game font-black text-xs text-emerald-800 dark:text-emerald-300">
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                                <span>YOU ARE FRIENDS (বন্ধু)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setConfirmRemoveFriend(true)}
                                className="text-[11px] font-game font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
