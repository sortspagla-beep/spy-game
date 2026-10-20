import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  Send,
  Shield,
  Sparkles,
  History,
  CheckCircle,
  ChevronRight,
  Crown,
  Eye,
  AlertCircle,
  Gamepad2,
  HelpCircle,
  Flame,
  Mic,
} from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { isUserHostOrCoHost } from '../utils/hostUtils.js';
import { VoiceHintSession } from './VoiceHintSession.js';

interface RoundHintsViewProps {
  roundNumber: number; // 1, 2, 3
}

export function RoundHintsView({ roundNumber }: RoundHintsViewProps) {
  const {
    room,
    user,
    hostAction,
    submitHint,
    hintTypingUser,
    sendHintTyping,
    voiceSpeakerStatus,
    flashingRedLights,
    triggerRedLightSignal,
  } = useGame();
  const [hintInput, setHintInput] = useState('');
  const [isSubmittingHint, setIsSubmittingHint] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!room) return null;

  const isHost = isUserHostOrCoHost(user, room);
  const isMyTurn = room.activeHintTurnUserId === user?.id;
  const me = room.players.find((p) => p.userId === user?.id);

  // Clean up typing indicator on unmount or when my turn finishes/closes
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendHintTyping(false);
    };
  }, []);

  useEffect(() => {
    if (!isMyTurn) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendHintTyping(false);
    }
  }, [isMyTurn]);

  // Filter hints for current round
  const currentRoundHints = room.hints.filter((h) => h.round === roundNumber);
  const previousHints = room.hints.filter((h) => h.round < roundNumber);

  // Active / eligible players
  const eligiblePlayers = room.players.filter((p) => !p.isDisqualified);
  const allHintsSubmitted =
    eligiblePlayers.length > 0 &&
    eligiblePlayers.every((p) => p.hasSubmittedHintCurrentRound);

  const handleSelectPlayerCard = (playerId: string) => {
    if (!isHost) return;
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    } else {
      setSelectedPlayerId(playerId);
    }
  };

  const handleOpenHintBox = async () => {
    if (!isHost || !selectedPlayerId) return;
    await hostAction('SELECT_HINT_PLAYER', { targetUserId: selectedPlayerId });
  };

  const handleDeselect = async () => {
    if (!isHost) return;
    setSelectedPlayerId(null);
    await hostAction('SELECT_HINT_PLAYER', { targetUserId: null });
  };

  const handleNextPlayer = async () => {
    if (!isHost) return;
    // Find next player who hasn't submitted
    const unsubmitted = eligiblePlayers.filter((p) => !p.hasSubmittedHintCurrentRound);
    if (unsubmitted.length > 0) {
      const nextP = unsubmitted[0];
      setSelectedPlayerId(nextP.userId);
      await hostAction('SELECT_HINT_PLAYER', { targetUserId: nextP.userId });
    }
  };

  const handleMarkSubmitted = async (targetUserId: string) => {
    if (!isHost) return;
    await hostAction('MARK_HINT_SUBMITTED', { targetUserId });
  };

  const handleToggleDisqualification = async (targetUserId: string, currentlyDisqualified: boolean) => {
    if (!isHost) return;
    await hostAction('SET_DISQUALIFICATION', {
      targetUserId,
      disqualified: !currentlyDisqualified,
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setHintInput(val);

    // Only active turn player emits typing status
    if (isMyTurn && !me?.hasSubmittedHintCurrentRound && !me?.isDisqualified) {
      if (val.trim().length > 0) {
        sendHintTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        // Auto-stop typing after 2.5 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          sendHintTyping(false);
        }, 2500);
      } else {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        sendHintTyping(false);
      }
    }
  };

  const handleSubmitMyHint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hintInput.trim()) return;

    // Immediately stop typing indicator on submission
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendHintTyping(false);

    setIsSubmittingHint(true);
    const result = await submitHint(hintInput.trim());
    setIsSubmittingHint(false);

    if (result.success) {
      setHintInput('');
    } else {
      alert(result.error || 'Failed to submit hint');
    }
  };

  const handleStartDiscussionManual = async () => {
    if (!isHost) return;
    const nextDiscussionPhase =
      roundNumber === 1
        ? 'ROUND_1_DISCUSSION'
        : roundNumber === 2
        ? 'ROUND_2_DISCUSSION'
        : 'ROUND_3_DISCUSSION';
    await hostAction('TRIGGER_PHASE', { phase: nextDiscussionPhase });
  };

  const roundTitles: Record<number, { title: string; subtitle: string; color: string }> = {
    1: {
      title: 'ROUND 1: FIRST CLUES',
      subtitle: 'Drop your first subtle clue without tipping off the secret spy!',
      color: 'from-cyan-500 via-indigo-500 to-purple-500',
    },
    2: {
      title: 'ROUND 2: DEEPER SECRETS',
      subtitle: 'Tension rises! Watch out for suspicious answers and impostors!',
      color: 'from-amber-500 via-rose-500 to-purple-600',
    },
    3: {
      title: 'ROUND 3: FINAL CLUES',
      subtitle: 'Last chance before the final deliberation and voting begins!',
      color: 'from-rose-500 via-red-500 to-amber-500',
    },
  };

  const avatarColors = [
    'bg-rose-500 text-white',
    'bg-amber-400 text-slate-900',
    'bg-cyan-400 text-slate-900',
    'bg-violet-500 text-white',
    'bg-emerald-400 text-slate-900',
    'bg-fuchsia-500 text-white',
  ];

  const getAvatarColor = (name: string) => {
    const idx =
      name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % avatarColors.length;
    return avatarColors[idx];
  };

  const roundConfig = roundTitles[roundNumber] || {
    title: `ROUND ${roundNumber}`,
    subtitle: 'Submit your hints and outsmart the spy!',
    color: 'from-rose-500 to-amber-500',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-pop-in">
      {/* Cartoon Party Round Header */}
      <div className="text-center py-6 sm:py-8 bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] relative overflow-hidden transition-colors duration-300">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-indigo-50 dark:bg-[#1C2344] border-2 border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-game font-bold text-indigo-600 dark:text-indigo-300 mb-2 shadow-xs">
          <Gamepad2 className="w-3.5 h-3.5 text-cyan-500" />
          <span>Party Clue Stage</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-500 font-extrabold uppercase">ROUND {roundNumber} OF 3</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-game tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 drop-shadow-xs">
          {roundConfig.title}
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          {roundConfig.subtitle}
        </p>

        {/* Private Role Secret Box */}
        <div className="mt-5 max-w-lg mx-auto">
          {isHost ? (
            <div className="p-4 bg-amber-50/90 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl text-center shadow-xs">
              <span className="block text-[11px] uppercase tracking-wider font-game font-bold text-amber-700 dark:text-amber-300 mb-1">
                HOST GAME DIRECTOR · {room.spyMode === 'SPY_MODE_2' ? 'DOUBLE WORD INTEL' : 'SECRET WORD'}
              </span>
              {room.spyMode === 'SPY_MODE_2' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div className="bg-white dark:bg-[#0E1326] px-3.5 py-2 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider font-game font-bold text-emerald-600 dark:text-emerald-400 block">
                      Citizens' Word
                    </span>
                    <span className="font-game text-xl sm:text-2xl font-black tracking-widest text-emerald-600 dark:text-emerald-400">
                      {room.secretWord || 'CLASSIFIED'}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-[#0E1326] px-3.5 py-2 rounded-2xl border-2 border-rose-400 dark:border-rose-600 shadow-xs">
                    <span className="text-[10px] uppercase tracking-wider font-game font-bold text-rose-600 dark:text-rose-400 block">
                      Spy's Word
                    </span>
                    <span className="font-game text-xl sm:text-2xl font-black tracking-widest text-rose-600 dark:text-rose-400">
                      {room.spyWord || 'CLASSIFIED'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="inline-block bg-white dark:bg-[#0E1326] px-5 py-2 rounded-2xl border-2 border-amber-400 dark:border-amber-600 shadow-sm">
                  <span className="font-game text-2xl sm:text-3xl font-black tracking-widest text-amber-600 dark:text-amber-400">
                    {room.secretWord || 'CLASSIFIED'}
                  </span>
                </div>
              )}
              <p className="mt-2 text-xs font-medium text-amber-800/90 dark:text-amber-300/80">
                {room.spyMode === 'SPY_MODE_2'
                  ? 'Citizens hold their word and Spy holds the spy word. Neither knows who the spy is!'
                  : 'Pick a player below or click "Next Unsubmitted" to open their hint box.'}
              </p>
            </div>
          ) : room.myRole === 'SPY' && room.spyMode !== 'SPY_MODE_2' ? (
            <div className="p-4 bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700/80 rounded-2xl text-center shadow-xs">
              <span className="block text-[11px] uppercase tracking-wider font-game font-bold text-rose-700 dark:text-rose-300 mb-1">
                TOP SECRET ROLE
              </span>
              <div className="inline-block bg-white dark:bg-[#0E1326] px-5 py-2 rounded-2xl border-2 border-rose-400 dark:border-rose-600 shadow-sm">
                <span className="font-game text-2xl sm:text-3xl font-black tracking-widest text-rose-600 dark:text-rose-400">
                  YOU ARE THE SPY!
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-rose-700/90 dark:text-rose-300/80">
                You do NOT know the secret word. Listen to clues, bluff convincingly, and stay hidden!
              </p>
            </div>
          ) : room.myRole === 'PLAYER' || room.spyMode === 'SPY_MODE_2' ? (
            <div className="p-4 bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700/80 rounded-2xl text-center shadow-xs">
              <span className="block text-[11px] uppercase tracking-wider font-game font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                {room.spyMode === 'SPY_MODE_2' ? 'YOUR SECRET WORD' : 'YOUR SECRET CITIZEN WORD'}
              </span>
              <div className="inline-block bg-white dark:bg-[#0E1326] px-5 py-2 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 shadow-sm">
                <span className="font-game text-2xl sm:text-3xl font-black tracking-widest text-emerald-600 dark:text-emerald-400">
                  {room.myWord || 'CLASSIFIED'}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-emerald-800/90 dark:text-emerald-300/80">
                {room.spyMode === 'SPY_MODE_2'
                  ? 'Give a clever clue about your word. Listen closely to figure out who has a different word!'
                  : 'The spy is guessing. Give a clever hint only fellow citizens will recognize!'}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Voice Mode: Active Live Voice Studio (for speaker) or Receiver (for listeners) */}
      {room.gameMode === 'VOICE' && room.activeHintTurnUserId && (
        <VoiceHintSession roundNumber={roundNumber} />
      )}

      {/* Text Mode: Selected Player's Active Hint Submission Box */}
      {room.gameMode !== 'VOICE' && isMyTurn && !me?.hasSubmittedHintCurrentRound && !me?.isDisqualified && (
        <div className="p-6 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-[#1E2545] dark:via-[#161B33] dark:to-[#151B33] border-4 border-amber-400 dark:border-amber-500 rounded-3xl shadow-xl animate-bounce-subtle transition-colors duration-300">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400 animate-spin" />
              <h2 className="text-base sm:text-lg font-black font-game text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                IT'S YOUR TURN TO SUBMIT A CLUE!
              </h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/90 dark:bg-[#0E1326]/90 rounded-full border border-amber-300 dark:border-amber-700 shadow-xs">
              <span className="text-xs font-game font-bold text-slate-800 dark:text-slate-200">
                {user?.username}
              </span>
              <button
                type="button"
                onClick={triggerRedLightSignal}
                title="Tap your red light to signal"
                className="inline-flex items-center justify-center p-0.5 rounded-full cursor-pointer hover:scale-125 active:scale-95 transition-all"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
                    user && flashingRedLights.has(user.id)
                      ? 'bg-red-500 ring-4 ring-red-500/70 shadow-[0_0_12px_#ef4444,0_0_20px_#dc2626] scale-125 animate-pulse'
                      : 'bg-red-900/40 border border-red-500/50 dark:bg-red-950 dark:border-red-700/60'
                  }`}
                />
              </button>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-3">
            Type your clue for everyone in the room. Be subtle and playful so the Spy stays in the dark!
          </p>

          <form onSubmit={handleSubmitMyHint} className="space-y-3">
            <textarea
              value={hintInput}
              onChange={handleTextareaChange}
              placeholder="Type your clever clue here..."
              rows={3}
              autoFocus
              className="w-full p-4 bg-white dark:bg-[#0E1326] border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingHint || !hintInput.trim()}
                className="py-3 px-6 btn-game-coral font-game font-black text-xs tracking-wider uppercase rounded-2xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span>{isSubmittingHint ? 'SENDING...' : 'SEND CLUE'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Host Controls Section */}
      {isHost && (
        <div className="bg-white dark:bg-[#151B33] border-2 border-amber-300 dark:border-amber-900/60 rounded-3xl p-5 sm:p-6 shadow-[0_12px_24px_rgba(245,158,11,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] space-y-3 transition-colors duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-indigo-950">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
              <h3 className="text-xs font-game font-black text-slate-900 dark:text-white uppercase tracking-wider">
                HOST HINT TURN CONTROLLER
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedPlayerId && (
                <>
                  <button
                    onClick={handleOpenHintBox}
                    className="py-2 px-3.5 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl cursor-pointer"
                  >
                    OPEN HINT BOX
                  </button>
                  <button
                    onClick={handleDeselect}
                    className="py-2 px-3 btn-game-slate font-game font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Cancel Selection
                  </button>
                </>
              )}
              <button
                onClick={handleNextPlayer}
                className="py-2 px-3.5 btn-game-amber font-game font-black text-xs tracking-wider rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <span>NEXT UNPROMPTED</span>
                <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tap any player card below to select them, then tap <strong className="text-rose-500">"OPEN HINT BOX"</strong> to give them the floor {room.gameMode === 'VOICE' ? 'for live microphone speaking' : 'to submit their clue'}.
          </p>
        </div>
      )}

      {/* Real-Time Player Hint Typing Indicator Banner (Text Mode Only) */}
      {room.gameMode !== 'VOICE' && hintTypingUser && (
        <div className="flex items-center justify-center gap-3 px-5 py-3.5 bg-gradient-to-r from-amber-400/25 via-cyan-400/20 to-rose-400/25 dark:from-amber-950/70 dark:via-cyan-950/50 dark:to-rose-950/50 border-2 border-amber-400 dark:border-amber-500 rounded-3xl shadow-lg text-amber-900 dark:text-amber-200 font-game text-xs sm:text-sm font-black tracking-wide animate-bounce-subtle">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
          </span>
          <span className="text-base sm:text-lg">✍️</span>
          <span>{hintTypingUser.username} is typing a hint...</span>
          <span className="inline-flex gap-1 ml-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      )}

      {/* Active Players Cards Grid */}
      <div className="bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] space-y-4 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-game font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>Players & Turn Status</span>
          </div>
          <span className="text-[11px] font-game font-bold text-slate-500 bg-slate-100 dark:bg-[#1C2344] px-2.5 py-1 rounded-full border border-slate-200 dark:border-indigo-950">
            {eligiblePlayers.filter((p) => p.hasSubmittedHintCurrentRound).length} /{' '}
            {eligiblePlayers.length} Clues In
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {room.players.map((p) => {
            const isSelected = selectedPlayerId === p.userId;
            const isTurnActive = room.activeHintTurnUserId === p.userId;
            const isPlayerTyping = hintTypingUser?.userId === p.userId;
            const isPlayerSpeaking =
              room.gameMode === 'VOICE' &&
              voiceSpeakerStatus.isSpeaking &&
              voiceSpeakerStatus.speakerUserId === p.userId;
            const hasSubmitted = p.hasSubmittedHintCurrentRound;
            const isDisqualified = p.isDisqualified;
            const avatarColor = getAvatarColor(p.username);

            return (
              <div
                key={p.userId}
                onClick={() => isHost && handleSelectPlayerCard(p.userId)}
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 shadow-xs ${
                  isHost ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-2 ring-amber-400 scale-[1.02]'
                    : isPlayerSpeaking
                    ? 'border-rose-400 bg-rose-50/70 dark:bg-rose-950/30 ring-2 ring-rose-400 animate-pulse-subtle'
                    : isPlayerTyping && room.gameMode !== 'VOICE'
                    ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/30 ring-2 ring-amber-400/80 animate-pulse-subtle'
                    : isTurnActive
                    ? 'border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 animate-pulse-subtle'
                    : hasSubmitted
                    ? 'border-slate-200 dark:border-indigo-950 bg-slate-50/80 dark:bg-[#0E1326]'
                    : isDisqualified
                    ? 'border-rose-200 dark:border-rose-950 bg-rose-50/50 dark:bg-rose-950/10 opacity-50'
                    : 'border-indigo-100 dark:border-indigo-950/80 bg-white dark:bg-[#161B33] hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-full ${avatarColor} font-game font-bold text-xs flex items-center justify-center border border-white/50 shadow-xs`}
                    >
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-game font-bold text-slate-900 dark:text-white block">
                          {p.username}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.userId === user?.id && isMyTurn && !p.isDisqualified) {
                              triggerRedLightSignal();
                            }
                          }}
                          disabled={p.userId !== user?.id || !isMyTurn || p.isDisqualified}
                          title={
                            p.userId === user?.id && isMyTurn && !p.isDisqualified
                              ? 'Tap your red light to signal'
                              : `${p.username}'s indicator light`
                          }
                          className={`inline-flex items-center justify-center p-0.5 rounded-full transition-all ${
                            p.userId === user?.id && isMyTurn && !p.isDisqualified
                              ? 'cursor-pointer hover:scale-125 active:scale-95'
                              : 'cursor-default pointer-events-none'
                          }`}
                        >
                          <span
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
                              flashingRedLights.has(p.userId)
                                ? 'bg-red-500 ring-4 ring-red-500/70 shadow-[0_0_12px_#ef4444,0_0_20px_#dc2626] scale-125 animate-pulse'
                                : 'bg-red-900/40 border border-red-500/50 dark:bg-red-950 dark:border-red-700/60'
                            }`}
                          />
                        </button>
                        {room.gameMode === 'VOICE' && isTurnActive && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-game font-black ${
                              isPlayerSpeaking
                                ? 'bg-rose-500/25 text-rose-600 dark:text-rose-300 border-rose-400 animate-pulse'
                                : 'bg-amber-400/25 text-amber-700 dark:text-amber-300 border-amber-400'
                            }`}
                          >
                            <Mic className="w-3 h-3 stroke-[2.5]" />
                            <span>{isPlayerSpeaking ? 'Speaking Live...' : 'Voice Turn'}</span>
                            {isPlayerSpeaking && (
                              <span className="flex items-end gap-0.5 h-2.5 ml-0.5">
                                <span className="w-0.5 bg-rose-500 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                                <span className="w-0.5 bg-rose-500 rounded-full animate-bounce h-2.5" style={{ animationDelay: '150ms' }} />
                                <span className="w-0.5 bg-rose-500 rounded-full animate-bounce h-2" style={{ animationDelay: '300ms' }} />
                              </span>
                            )}
                          </span>
                        )}
                        {room.gameMode !== 'VOICE' && isPlayerTyping && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/25 text-amber-700 dark:text-amber-300 border border-amber-400/60 text-[10px] font-game font-black animate-pulse">
                            <span>✍️ typing...</span>
                            <span className="inline-flex gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          </span>
                        )}
                        {p.userId === user?.id && (
                          <span className="text-[10px] text-slate-400 font-bold">(You)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isDisqualified ? (
                      <span className="text-[10px] font-game font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-full">
                        OUT
                      </span>
                    ) : hasSubmitted ? (
                      <span className="text-[10px] font-game font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        SUBMITTED
                      </span>
                    ) : isPlayerTyping ? (
                      <span className="text-[10px] font-game font-black text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 border border-amber-400 dark:border-amber-600 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        TYPING CLUE...
                      </span>
                    ) : isTurnActive ? (
                      <span className="text-[10px] font-game font-bold text-cyan-800 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800 px-2 py-0.5 rounded-full animate-pulse">
                        WRITING...
                      </span>
                    ) : (
                      <span className="text-[10px] font-game font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1C2344] border border-slate-200 dark:border-indigo-950 px-2 py-0.5 rounded-full">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>

                {/* Host Card Actions */}
                {isHost && (
                  <div className="pt-2 border-t border-slate-100 dark:border-indigo-950 flex items-center justify-between text-xs">
                    {!hasSubmitted && !isDisqualified && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkSubmitted(p.userId);
                        }}
                        className="text-[11px] font-game font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer"
                      >
                        ✓ Mark In
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleDisqualification(p.userId, isDisqualified);
                      }}
                      className={`text-[11px] font-game font-bold ml-auto cursor-pointer ${
                        isDisqualified
                          ? 'text-emerald-600 hover:text-emerald-500'
                          : 'text-rose-500 hover:text-rose-400'
                      }`}
                    >
                      {isDisqualified ? 'Reinstate' : 'Disqualify'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submitted Hints Feed */}
      <div className="bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] space-y-4 transition-colors duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-game font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <MessageSquare className="w-4 h-4 text-cyan-500" />
            <span>Round {roundNumber} Clue Feed ({currentRoundHints.length})</span>
          </div>

          {previousHints.length > 0 && (
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="text-xs font-game font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistoryDrawer ? 'Hide Previous Hints' : 'View Previous Hints'}</span>
            </button>
          )}
        </div>

        {/* Previous Hints collapsible */}
        {showHistoryDrawer && previousHints.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-[#0E1326] border-2 border-slate-200 dark:border-indigo-950 rounded-2xl space-y-3">
            <h4 className="text-[11px] font-game font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Clue History (Rounds 1–{roundNumber - 1})
            </h4>
            <div className="divide-y divide-slate-200 dark:divide-indigo-950 space-y-2">
              {previousHints.map((ph) => {
                const avatarColor = getAvatarColor(ph.username);
                return (
                  <div key={ph.id} className="pt-2 text-xs flex items-start gap-2.5">
                    <div
                      className={`w-6 h-6 rounded-full shrink-0 ${avatarColor} font-game font-bold text-[10px] flex items-center justify-center border border-white/40 shadow-xs mt-0.5`}
                    >
                      {ph.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-0.5">
                        <span className="font-game font-bold text-slate-800 dark:text-slate-300">
                          {ph.username}{' '}
                          <span className="text-[10px] text-indigo-500 font-game">
                            (Round {ph.round})
                          </span>
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                          {new Date(ph.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic font-medium">
                        "{ph.content}"
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Round Hints List */}
        {currentRoundHints.length === 0 ? (
          <div className="py-8 text-center text-xs font-game font-medium text-slate-400 dark:text-slate-500">
            No clues submitted for Round {roundNumber} yet. Players are thinking...
          </div>
        ) : (
          <div className="space-y-3">
            {currentRoundHints.map((hint) => {
              const avatarColor = getAvatarColor(hint.username);
              return (
                <div
                  key={hint.id}
                  className="p-4 bg-slate-50 dark:bg-[#0E1326] border-2 border-indigo-100 dark:border-indigo-950 rounded-2xl flex items-start gap-3 shadow-xs"
                >
                  <div
                    className={`w-8 h-8 rounded-full shrink-0 ${avatarColor} font-game font-bold text-xs flex items-center justify-center border border-white/40 shadow-xs mt-0.5`}
                  >
                    {hint.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-game font-black text-slate-900 dark:text-white">
                        {hint.username}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                        {new Date(hint.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                      "{hint.content}"
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Discussion Trigger Button */}
        {(allHintsSubmitted || isHost) && (
          <div className="pt-4 border-t border-slate-100 dark:border-indigo-950 flex justify-end">
            <button
              onClick={handleStartDiscussionManual}
              className="py-3.5 px-6 btn-game-emerald font-game font-black text-xs tracking-wider uppercase rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              <span>START GROUP DISCUSSION</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
