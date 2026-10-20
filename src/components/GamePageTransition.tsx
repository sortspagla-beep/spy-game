import React, { useEffect, useState, useRef } from 'react';
import { Gamepad2, Sparkles, Zap, Shield, Flame } from 'lucide-react';
import { useGame } from '../context/GameContext.js';

export function GamePageTransition() {
  const { room } = useGame();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTitle, setTransitionTitle] = useState('LOADING MISSION...');
  const prevPhaseRef = useRef<string | null>(null);
  const prevRoomCodeRef = useRef<string | null>(null);

  const phaseTitles: Record<string, string> = {
    LOBBY: 'ENTERING PARTY ROOM LOBBY...',
    ROUND_1_HINTS: 'ROUND 1: CLUE SUBMISSION TIME!',
    ROUND_1_DISCUSSION: 'ROUND 1: GROUP DEBATE COMMENCING!',
    ROUND_2_HINTS: 'ROUND 2: DEEPER SECRETS AWAIT...',
    ROUND_2_DISCUSSION: 'ROUND 2: SUSPICIONS RISING!',
    ROUND_3_HINTS: 'ROUND 3: FINAL HINTS STAGE!',
    ROUND_3_DISCUSSION: 'ROUND 3: FINAL DELIBERATION!',
    VOTING: 'SECRET VOTING POLL OPENED!',
    TIE_RESULT: 'DEADLOCK! TIEBREAKER ACTIVATED!',
    RESULTS: 'REVEALING THE SECRET SPY...',
  };

  useEffect(() => {
    const currentPhase = room?.phase || 'HOME';
    const currentCode = room?.code || null;

    const phaseChanged = prevPhaseRef.current !== null && prevPhaseRef.current !== currentPhase;
    const roomChanged = prevRoomCodeRef.current !== currentCode;

    if (phaseChanged || roomChanged) {
      const title = room?.phase ? phaseTitles[room.phase] || 'UPDATING PARTY GAME...' : 'RETURNING TO HOME LOBBY...';
      setTransitionTitle(title);
      setIsTransitioning(true);

      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 500);

      prevPhaseRef.current = currentPhase;
      prevRoomCodeRef.current = currentCode;

      return () => clearTimeout(timer);
    }

    prevPhaseRef.current = currentPhase;
    prevRoomCodeRef.current = currentCode;
  }, [room?.phase, room?.code]);

  if (!isTransitioning) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#151B33] border-3 border-amber-400 dark:border-amber-500 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-3 text-center max-w-sm mx-4 transform scale-100 animate-pop-in">
        {/* Animated Game Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 via-amber-400 to-cyan-400 p-0.5 shadow-lg animate-bounce-subtle">
          <div className="w-full h-full bg-[#10152B] rounded-[14px] flex items-center justify-center text-white">
            <Gamepad2 className="w-8 h-8 text-amber-400 animate-pulse" />
          </div>
        </div>

        <div>
          <span className="font-game font-black text-xs uppercase tracking-widest text-amber-400 flex items-center justify-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>GAME STAGE SHIFT</span>
          </span>
          <h3 className="font-game font-black text-sm sm:text-base text-white tracking-wide uppercase">
            {transitionTitle}
          </h3>
        </div>

        {/* Animated Arcade Progress Strip */}
        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/20 p-0.5 mt-1">
          <div className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 rounded-full animate-[progress_0.5s_ease-out_forwards] w-full" />
        </div>
      </div>
    </div>
  );
}
