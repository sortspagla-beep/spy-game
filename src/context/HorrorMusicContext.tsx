import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { horrorMusic, HorrorMood } from '../utils/horrorMusic.js';

interface HorrorMusicContextType {
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  mood: HorrorMood;
  autoGameAdapt: boolean;
  toggleSound: () => void;
  togglePlay: () => void; // alias for backwards compatibility
  setVolume: (val: number) => void;
  setMood: (mood: HorrorMood) => void;
  setAutoGameAdapt: (adapt: boolean) => void;
  getAnalyser: () => AnalyserNode | null;
  resumeAudio: () => void;
}

const HorrorMusicContext = createContext<HorrorMusicContextType | null>(null);

export function HorrorMusicProvider({ children }: { children: React.ReactNode }) {
  // Always default to auto-playing the music
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    const saved = localStorage.getItem('spy_horror_music_enabled');
    // Default to true (auto play)
    return saved !== null ? saved === 'true' : true;
  });

  // Default to 80% loudness so it is punchy, terrifying, and clear
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem('spy_horror_music_volume');
    const parsed = saved ? parseFloat(saved) : 0.8;
    return parsed < 0.5 ? 0.8 : parsed; // Upgrade if previously set too low
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('spy_horror_music_muted');
    return saved === 'true';
  });

  const [mood, setMoodState] = useState<HorrorMood>(() => {
    const saved = (localStorage.getItem('spy_horror_music_mood') as HorrorMood) || 'dread';
    return ['dread', 'suspense', 'terror'].includes(saved) ? saved : 'dread';
  });

  const [autoGameAdapt, setAutoGameAdaptState] = useState<boolean>(() => {
    const saved = localStorage.getItem('spy_horror_music_auto_adapt');
    return saved !== null ? saved === 'true' : true;
  });

  // Sync mute state and volume to horror audio engine
  useEffect(() => {
    horrorMusic.setMuted(isMuted);
    horrorMusic.setVolume(volume);
  }, [volume, isMuted]);

  // Sync mood to horror audio engine
  useEffect(() => {
    horrorMusic.setMood(mood);
  }, [mood]);

  // Auto-play on mount and handle play/pause
  useEffect(() => {
    if (isPlaying) {
      horrorMusic.setMuted(isMuted);
      horrorMusic.setVolume(volume);
      horrorMusic.start(mood);
    } else {
      horrorMusic.stop();
    }
  }, [isPlaying, isMuted, mood]);

  // Autoplay Unlock Handler:
  // Browsers block AudioContext until ANY user gesture occurs.
  // We attach multiple document-level listeners to auto-resume on first click/touch/keypress.
  useEffect(() => {
    const autoUnlock = () => {
      if (isPlaying) {
        horrorMusic.start(mood);
      }
    };

    // Try immediately on load
    autoUnlock();

    // Also trigger on first interaction
    const events = ['click', 'pointerdown', 'touchstart', 'keydown', 'focus'];
    events.forEach((evt) => {
      window.addEventListener(evt, autoUnlock, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, autoUnlock);
      });
    };
  }, [isPlaying, mood]);

  const toggleSound = () => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      localStorage.setItem('spy_horror_music_muted', String(nextMuted));
      horrorMusic.setMuted(nextMuted);

      // If unmuting, make sure engine is running and volume is audible
      if (!nextMuted) {
        if (!isPlaying) {
          setIsPlaying(true);
          localStorage.setItem('spy_horror_music_enabled', 'true');
        }
        if (volume === 0) {
          setVolumeState(0.8);
          localStorage.setItem('spy_horror_music_volume', '0.8');
          horrorMusic.setVolume(0.8);
        }
        horrorMusic.start(mood);
      }
      return nextMuted;
    });
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1.2, val));
    setVolumeState(clamped);
    localStorage.setItem('spy_horror_music_volume', String(clamped));

    if (clamped > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem('spy_horror_music_muted', 'false');
      horrorMusic.setMuted(false);
    }

    horrorMusic.setVolume(clamped);
    if (!isPlaying) {
      setIsPlaying(true);
      horrorMusic.start(mood);
    }
  };

  const setMood = (newMood: HorrorMood) => {
    setMoodState(newMood);
    localStorage.setItem('spy_horror_music_mood', newMood);
    horrorMusic.setMood(newMood);
  };

  const setAutoGameAdapt = (adapt: boolean) => {
    setAutoGameAdaptState(adapt);
    localStorage.setItem('spy_horror_music_auto_adapt', String(adapt));
  };

  const resumeAudio = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      localStorage.setItem('spy_horror_music_enabled', 'true');
    }
    if (isMuted) {
      setIsMuted(false);
      localStorage.setItem('spy_horror_music_muted', 'false');
      horrorMusic.setMuted(false);
    }
    horrorMusic.start(mood);
  };

  const getAnalyser = () => horrorMusic.getAnalyser();

  return (
    <HorrorMusicContext.Provider
      value={{
        isPlaying,
        volume,
        isMuted,
        mood,
        autoGameAdapt,
        toggleSound,
        togglePlay: toggleSound, // alias
        setVolume,
        setMood,
        setAutoGameAdapt,
        getAnalyser,
        resumeAudio,
      }}
    >
      {children}
    </HorrorMusicContext.Provider>
  );
}

export function useHorrorMusic() {
  const context = useContext(HorrorMusicContext);
  if (!context) {
    throw new Error('useHorrorMusic must be used within a HorrorMusicProvider');
  }
  return context;
}
