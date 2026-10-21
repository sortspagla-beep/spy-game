import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Radio, Plus, Minus } from 'lucide-react';
import { useHorrorMusic } from '../context/HorrorMusicContext.js';

interface HorrorAudioButtonProps {
  className?: string;
}

export function HorrorAudioButton({ className = '' }: HorrorAudioButtonProps) {
  const { volume, isMuted, toggleSound, setVolume } = useHorrorMusic();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSoundOn = !isMuted && volume > 0;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleVolumeStep = (delta: number) => {
    const next = Math.max(0, Math.min(1, Math.round((volume + delta) * 10) / 10));
    setVolume(next);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      {/* Top-Right Sci-Fi Ambient Audio Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-300 focus:outline-none cursor-pointer border ${
          isSoundOn
            ? 'bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border-cyan-500/50 shadow-[0_0_14px_rgba(6,182,212,0.35)]'
            : 'bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 shadow-sm'
        }`}
        title={isSoundOn ? `Dark Sci-Fi Ambient (80 BPM): ON (${Math.round(volume * 100)}%) - Click to adjust volume or turn off` : 'Dark Sci-Fi Ambient: OFF - Click to turn on'}
        aria-label="Dark Sci-Fi Ambient background music volume control"
      >
        <div className="relative w-5 h-5 flex items-center justify-center">
          {isSoundOn ? (
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-400" />
          )}

          {isSoundOn && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          )}
        </div>
      </button>

      {/* Compact Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-68 bg-slate-950/95 dark:bg-black/95 text-slate-100 border border-cyan-900/60 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-cyan-950/80">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              Dark Sci-Fi Ambient
            </span>
            <span className="text-[10px] font-mono text-cyan-300/80 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
              80 BPM
            </span>
          </div>

          {/* Sound On / Off Toggle */}
          <div className="py-2.5">
            <button
              type="button"
              onClick={toggleSound}
              className={`w-full py-2 px-3 rounded-xl flex items-center justify-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer border ${
                isSoundOn
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {isSoundOn ? (
                <>
                  <Volume2 className="w-4 h-4 text-slate-950" />
                  <span>SOUND: ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-cyan-400" />
                  <span>SOUND: OFF</span>
                </>
              )}
            </button>
          </div>

          {/* Volume Up / Down Slider */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400 uppercase">Volume</span>
              <span className="text-cyan-400 font-bold">
                {isMuted ? 'OFF' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            {/* Slider with +/- buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleVolumeStep(-0.1)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                title="Volume Down"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                title="Volume: Low to High"
              />

              <button
                type="button"
                onClick={() => handleVolumeStep(0.1)}
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
                title="Volume Up"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick volume presets */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              <button
                type="button"
                onClick={() => setVolume(0)}
                className={`py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                  isMuted || volume === 0
                    ? 'bg-indigo-950 border-indigo-500 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                OFF
              </button>
              <button
                type="button"
                onClick={() => setVolume(0.35)}
                className={`py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                  !isMuted && Math.abs(volume - 0.35) < 0.1
                    ? 'bg-indigo-950 border-indigo-500 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                LOW
              </button>
              <button
                type="button"
                onClick={() => setVolume(0.75)}
                className={`py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                  !isMuted && Math.abs(volume - 0.75) < 0.1
                    ? 'bg-indigo-950 border-indigo-500 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                MED
              </button>
              <button
                type="button"
                onClick={() => setVolume(1.0)}
                className={`py-1 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                  !isMuted && volume >= 0.95
                    ? 'bg-indigo-950 border-indigo-500 text-cyan-300'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
              >
                LOUD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
