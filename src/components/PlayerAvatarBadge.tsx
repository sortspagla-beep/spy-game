import React from 'react';
import { getAvatarById, getFallbackAvatarColor } from '../utils/avatars.js';

interface PlayerAvatarBadgeProps {
  username: string;
  avatarId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showCrown?: boolean;
}

export function PlayerAvatarBadge({
  username,
  avatarId,
  size = 'md',
  className = '',
}: PlayerAvatarBadgeProps) {
  const avatar = getAvatarById(avatarId);
  const fallbackColor = getFallbackAvatarColor(username);

  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px] rounded-lg',
    sm: 'w-7 h-7 text-xs rounded-xl',
    md: 'w-9 h-9 text-base rounded-2xl',
    lg: 'w-12 h-12 text-2xl rounded-2xl',
    xl: 'w-16 h-16 text-3xl rounded-3xl',
  };

  const isImageUrl =
    typeof avatarId === 'string' &&
    (avatarId.startsWith('http://') ||
      avatarId.startsWith('https://') ||
      avatarId.startsWith('data:image/'));

  if (isImageUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden border-2 border-white/60 dark:border-white/20 shadow-xs select-none bg-slate-200 dark:bg-slate-800 ${sizeClasses[size]} ${className}`}
        title={username}
      >
        <img
          src={avatarId}
          alt={username}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  if (avatar) {
    return (
      <div
        className={`relative shrink-0 flex items-center justify-center bg-gradient-to-br ${avatar.bgGradient} border-2 border-white/60 dark:border-white/20 shadow-xs select-none ${sizeClasses[size]} ${className}`}
        title={`${username} (${avatar.name})`}
      >
        <span className="transform hover:scale-110 transition-transform leading-none drop-shadow-xs">
          {avatar.emoji}
        </span>
      </div>
    );
  }

  // Fallback to first letter with vibrant deterministic color
  return (
    <div
      className={`relative shrink-0 flex items-center justify-center font-game font-black border-2 border-white/60 dark:border-white/20 shadow-xs select-none ${fallbackColor} ${sizeClasses[size]} ${className}`}
      title={username}
    >
      <span className="leading-none uppercase">
        {username ? username.charAt(0).toUpperCase() : '?'}
      </span>
    </div>
  );
}
