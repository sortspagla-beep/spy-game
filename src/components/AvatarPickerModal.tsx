import React, { useState } from 'react';
import { X, Check, Sparkles, Upload, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { AVATAR_LIST, AvatarItem, getAvatarById } from '../utils/avatars.js';
import { uploadToImgBB } from '../utils/imgbb.js';
import { soundFX } from '../utils/sound.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AvatarPickerModal({ isOpen, onClose }: AvatarPickerModalProps) {
  const { user, updateUserAvatar } = useGame();
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    user?.avatar || 'avatar-spy-classic'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ImgBB upload state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  if (!isOpen || !user) return null;

  const currentSelectedAvatar = getAvatarById(selectedAvatarId);
  const isCustomImage =
    selectedAvatarId.startsWith('http://') ||
    selectedAvatarId.startsWith('https://') ||
    selectedAvatarId.startsWith('data:image/');

  const categories = [
    { id: 'all', label: `All (${AVATAR_LIST.length})` },
    { id: 'detective', label: 'Detectives' },
    { id: 'animals', label: 'Animal Agents' },
    { id: 'cyber', label: 'Cyber & Sci-Fi' },
    { id: 'mythic', label: 'Mythic' },
    { id: 'retro', label: 'Retro' },
  ];

  const filteredAvatars =
    selectedCategory === 'all'
      ? AVATAR_LIST
      : AVATAR_LIST.filter((a) => a.category === selectedCategory);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploadingImage(true);
    setUploadSuccess(false);

    const result = await uploadToImgBB(file);
    setIsUploadingImage(false);

    if (result.success && result.url) {
      setSelectedAvatarId(result.url);
      setUploadSuccess(true);
      soundFX.playClick();
      setTimeout(() => setUploadSuccess(false), 3000);
    } else {
      setUploadError(result.error || 'Failed to upload image. Please try again.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await updateUserAvatar(selectedAvatarId);
    setIsSaving(false);
    if (res.success) {
      soundFX.playClick();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-pop-in transition-colors duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white dark:bg-[#151B33] border-3 border-indigo-200 dark:border-indigo-900/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">
        {/* Header */}
        <div className="px-6 py-4 bg-indigo-50/70 dark:bg-[#10152B] border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-game font-bold text-base shadow-xs">
              <Sparkles className="w-4 h-4 text-slate-950 fill-current" />
            </div>
            <div>
              <h2 className="font-game font-black text-sm sm:text-base tracking-wide uppercase text-slate-900 dark:text-white">
                CHOOSE YOUR AVATAR
              </h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Pick a character icon or upload a custom photo from your phone/device!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Active Preview Spotlight Card */}
          <div className="p-4 bg-slate-50 dark:bg-[#0E1326] border-2 border-slate-200 dark:border-indigo-950 rounded-2xl flex items-center gap-4">
            <PlayerAvatarBadge
              username={user.username}
              avatarId={selectedAvatarId}
              size="lg"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-game font-black text-base text-slate-900 dark:text-white truncate">
                  {currentSelectedAvatar?.name || (isCustomImage ? 'Custom Photo' : 'Chosen Avatar')}
                </span>
                <span className="text-[10px] font-game font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 shrink-0">
                  {isCustomImage ? 'ImgBB Cloud' : currentSelectedAvatar?.tag || 'Game Icon'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Player: <span className="font-bold text-slate-700 dark:text-slate-200">{user.username}</span>
              </p>
            </div>

            {/* Upload Button */}
            <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl text-xs font-game font-bold text-amber-800 dark:text-amber-200 cursor-pointer hover:bg-amber-100 transition-colors shadow-xs shrink-0">
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploadingImage}
                className="hidden"
              />
            </label>
          </div>

          {/* Upload Status Alerts */}
          {uploadSuccess && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs text-emerald-700 dark:text-emerald-200 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Image uploaded to ImgBB and selected!</span>
            </div>
          )}
          {uploadError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 rounded-xl text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Filter Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-xl font-game font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
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
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 max-h-60 overflow-y-auto p-1">
            {filteredAvatars.map((item) => {
              const isSelected = selectedAvatarId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedAvatarId(item.id);
                    soundFX.playClick();
                  }}
                  className={`group relative p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border-2 ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 ring-3 ring-rose-400/50 scale-105 shadow-md'
                      : 'border-slate-200 dark:border-indigo-950 bg-slate-50/60 dark:bg-[#0E1326] hover:border-cyan-400 hover:scale-102'
                  }`}
                  title={`${item.name} (${item.tag})`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-xs border border-white/40 bg-gradient-to-br ${item.bgGradient}`}
                  >
                    <span className="leading-none drop-shadow-xs transform group-hover:scale-115 transition-transform">
                      {item.emoji}
                    </span>
                  </div>

                  <span className="text-[10px] font-game font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">
                    {item.name}
                  </span>

                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#10152B] border-t-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 btn-game-slate font-game font-bold text-xs tracking-wider rounded-xl cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="py-3 px-6 btn-game-emerald font-game font-black text-xs tracking-wider uppercase rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {saveSuccess ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>SAVED!</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isSaving ? 'SAVING...' : 'SAVE AVATAR'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
