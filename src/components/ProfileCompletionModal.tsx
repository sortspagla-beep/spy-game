import React, { useEffect, useState } from 'react';
import {
  Check,
  Sparkles,
  User,
  Upload,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  ShieldCheck,
  AtSign,
  Camera,
} from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { AVATAR_LIST, AvatarItem, getAvatarById } from '../utils/avatars.js';
import { uploadToImgBB } from '../utils/imgbb.js';
import { soundFX } from '../utils/sound.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canCancel?: boolean;
}

export function ProfileCompletionModal({
  isOpen,
  onClose,
  canCancel = false,
}: ProfileCompletionModalProps) {
  const { user, completeProfile, checkUsernameAvailable } = useGame();

  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(
    user?.username && !user.username.startsWith('user_') && !user.username.startsWith('Agent')
      ? user.username
      : ''
  );
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    user?.avatar || 'avatar-spy-classic'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Username validation state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // ImgBB upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      if (user.name) setName(user.name);
      if (user.username && !user.username.startsWith('user_') && !user.username.startsWith('Agent')) {
        setUsername(user.username);
      }
      if (user.avatar) setSelectedAvatar(user.avatar);
    }
  }, [user]);

  // Debounced username availability check
  useEffect(() => {
    const clean = username.trim();
    if (!clean) {
      setUsernameAvailable(null);
      setUsernameError(null);
      setIsCheckingUsername(false);
      return;
    }

    if (clean.length < 3) {
      setUsernameAvailable(false);
      setUsernameError('Username must be at least 3 characters');
      setIsCheckingUsername(false);
      return;
    }

    if (clean.length > 25) {
      setUsernameAvailable(false);
      setUsernameError('Username cannot exceed 25 characters');
      setIsCheckingUsername(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      setUsernameAvailable(false);
      setUsernameError('Only letters, numbers, and underscores are allowed');
      setIsCheckingUsername(false);
      return;
    }

    setUsernameError(null);
    setIsCheckingUsername(true);

    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(clean);
      setIsCheckingUsername(false);
      setUsernameAvailable(available);
      if (!available) {
        setUsernameError('Username is already taken. Try another!');
      } else {
        setUsernameError(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailable]);

  if (!isOpen || !user) return null;

  const categories = [
    { id: 'all', label: 'All Avatars' },
    { id: 'detective', label: 'Detectives' },
    { id: 'animals', label: 'Animals' },
    { id: 'cyber', label: 'Cyber' },
    { id: 'mythic', label: 'Mythic' },
    { id: 'retro', label: 'Retro' },
  ];

  const filteredAvatars =
    selectedCategory === 'all'
      ? AVATAR_LIST
      : AVATAR_LIST.filter((a) => a.category === selectedCategory);

  // Handle image upload from device
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploadingImage(true);
    setUploadSuccess(false);

    const result = await uploadToImgBB(file);
    setIsUploadingImage(false);

    if (result.success && result.url) {
      setSelectedAvatar(result.url);
      setUploadSuccess(true);
      soundFX.playClick();
      setTimeout(() => setUploadSuccess(false), 3000);
    } else {
      setUploadError(result.error || 'Failed to upload image. Please try again.');
    }
  };

  // Submit complete profile
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanUsername = username.trim();

    if (!cleanName || cleanName.length < 2) {
      setFormError('Please enter your full or display name (min 2 characters).');
      return;
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      setFormError('Please choose a unique nickname (min 3 characters).');
      return;
    }

    if (usernameAvailable === false) {
      setFormError('This nickname is already taken. Please choose another.');
      return;
    }

    setIsSubmitting(true);
    const result = await completeProfile({
      name: cleanName,
      username: cleanUsername,
      avatar: selectedAvatar,
    });
    setIsSubmitting(false);

    if (result.success) {
      soundFX.playRoundTransition();
      if (onClose) onClose();
    } else {
      setFormError(result.error || 'Failed to save profile. Please try again.');
    }
  };

  const isCurrentAvatarCustomImage =
    selectedAvatar.startsWith('http://') ||
    selectedAvatar.startsWith('https://') ||
    selectedAvatar.startsWith('data:image/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 dark:bg-black/85 backdrop-blur-md animate-pop-in overflow-y-auto">
      <div className="w-full max-w-xl bg-white dark:bg-[#151B33] border-3 border-indigo-200 dark:border-indigo-900/80 rounded-3xl shadow-2xl overflow-hidden my-auto transition-colors duration-300">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-500/10 via-amber-400/10 to-cyan-400/10 dark:from-rose-500/20 dark:via-amber-400/10 dark:to-cyan-400/20 border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-400 text-white flex items-center justify-center font-game font-bold text-base shadow-sm">
              <Sparkles className="w-4 h-4 text-white fill-current animate-pulse" />
            </div>
            <div>
              <h2 className="font-game font-black text-base sm:text-lg tracking-wide uppercase text-slate-900 dark:text-white">
                {user.isProfileCompleted ? 'EDIT SPY PROFILE' : 'COMPLETE YOUR SPY PROFILE'}
              </h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {user.isProfileCompleted
                  ? 'Update your player name, unique username, and avatar.'
                  : 'Welcome! Set your player name and unique nickname to enter the game.'}
              </p>
            </div>
          </div>

          {canCancel && onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {formError && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* User Preview & Email Info */}
          <div className="p-3.5 bg-indigo-50/60 dark:bg-[#0E1326] border-2 border-indigo-100 dark:border-indigo-950 rounded-2xl flex items-center gap-3">
            <PlayerAvatarBadge
              username={username || name || 'Agent'}
              avatarId={selectedAvatar}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-game font-black text-sm text-slate-900 dark:text-white truncate">
                  {name || 'New Player'}
                </span>
                <span className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                  @{username || 'nickname'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Google: <span className="font-medium text-slate-700 dark:text-slate-300">{user.email}</span>
              </p>
            </div>
          </div>

          {/* Name & Unique Username Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-game font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Your Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-[#0E1326] border-2 border-slate-200 dark:border-indigo-950 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>
            </div>

            {/* Unique Username */}
            <div>
              <label className="block text-xs font-game font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Unique Nickname <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <AtSign className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. shadow_hawk"
                  required
                  className={`w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-[#0E1326] border-2 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all ${
                    usernameError
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-400/20'
                      : usernameAvailable
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20'
                      : 'border-slate-200 dark:border-indigo-950 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
                  }`}
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {isCheckingUsername ? (
                    <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                  ) : usernameAvailable ? (
                    <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                  ) : usernameError ? (
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                  ) : null}
                </div>
              </div>
              {usernameError ? (
                <p className="text-[11px] text-rose-500 font-medium mt-1">{usernameError}</p>
              ) : usernameAvailable ? (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  ✓ Nickname is available!
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Letters, numbers, and _ (3-25 chars)
                </p>
              )}
            </div>
          </div>

          {/* Profile Picture Option: Device Upload or 20+ Preset Avatars */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <label className="text-xs font-game font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-500" />
                <span>Profile Picture (Optional)</span>
              </label>

              {/* Upload from Phone Button (ImgBB) */}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl text-xs font-game font-bold text-amber-800 dark:text-amber-200 cursor-pointer hover:bg-amber-100 transition-colors shadow-xs">
                {isUploadingImage ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    <span>Uploading to ImgBB...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Upload From Phone / Device</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                  onChange={handleImageFileChange}
                  disabled={isUploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            {/* ImgBB upload alerts */}
            {uploadSuccess && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-emerald-700 dark:text-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>Photo uploaded to ImgBB cloud successfully!</span>
              </div>
            )}
            {uploadError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Avatar Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategory(c.id)}
                  className={`px-2.5 py-1 rounded-xl font-game font-bold text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === c.id
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#0E1326] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* 30+ Avatars Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50/50 dark:bg-[#0E1326]/60 rounded-2xl border-2 border-slate-200 dark:border-indigo-950">
              {filteredAvatars.map((item) => {
                const isSelected = selectedAvatar === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(item.id);
                      soundFX.playClick();
                    }}
                    className={`group relative p-1.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border-2 ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/60 ring-2 ring-rose-400/50 scale-105'
                        : 'border-transparent hover:border-cyan-400 hover:scale-102'
                    }`}
                    title={item.name}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xl shadow-xs border border-white/40 bg-gradient-to-br ${item.bgGradient}`}
                    >
                      <span className="leading-none">{item.emoji}</span>
                    </div>
                    <span className="text-[9px] font-game font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">
                      {item.name.split(' ')[0]}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || usernameAvailable === false || isCheckingUsername}
              className="w-full py-3.5 px-4 btn-game-coral font-game font-black text-sm sm:text-base tracking-wider rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SAVING PROFILE...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>{user.isProfileCompleted ? 'SAVE CHANGES' : 'COMPLETE PROFILE & PLAY'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
