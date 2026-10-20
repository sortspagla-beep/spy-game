import React, { useState } from 'react';
import {
  Check,
  X,
  Shield,
  Vote,
  AlertCircle,
  Crown,
  Gamepad2,
  Sparkles,
} from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { isUserHostOrCoHost } from '../utils/hostUtils.js';

export function VotingView() {
  const { room, user, castVote, hostAction } = useGame();
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!room) return null;

  const isHost = isUserHostOrCoHost(user, room);
  const me = room.players.find((p) => p.userId === user?.id);
  const hasVoted = me?.hasVoted;
  const isDisqualified = me?.isDisqualified;

  // Eligible targets: all players in room except yourself (and non-disqualified)
  const eligibleCandidates = room.players.filter((p) => !p.isDisqualified);
  const totalVotes = room.totalVotesCast || 0;
  const totalEligible = room.eligibleVotersCount || eligibleCandidates.length;

  const handleSelectCandidate = (candidateId: string) => {
    if (hasVoted || isDisqualified) return;
    if (candidateId === user?.id) {
      setErrorMsg('You cannot vote for yourself!');
      return;
    }
    setErrorMsg(null);
    setSelectedTargetId(candidateId);
  };

  const handleCancelSelection = () => {
    setSelectedTargetId(null);
  };

  const handleConfirmVote = async () => {
    if (!selectedTargetId) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    const result = await castVote(selectedTargetId);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Failed to submit vote');
    }
  };

  const handleHostCloseVoting = async () => {
    if (!isHost) return;
    if (!confirm('Close voting now and calculate results based on current votes?')) return;
    await hostAction('CLOSE_VOTING');
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-pop-in">
      {/* Cartoon Party Voting Header */}
      <div className="text-center py-6 sm:py-8 bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] relative overflow-hidden transition-colors duration-300">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 rounded-full text-xs font-game font-bold text-rose-600 dark:text-rose-300 mb-2 shadow-xs">
          <Vote className="w-3.5 h-3.5 text-rose-500" />
          <span>Final Verdict</span>
          <span aria-hidden="true">·</span>
          <span className="font-extrabold uppercase">SECRET BALLOT</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-game tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 drop-shadow-xs">
          WHO IS THE SPY?
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Tap a suspect card below and confirm your vote. Ballots remain hidden until all players finish!
        </p>

        {/* Voting Progress Track */}
        <div className="mt-5 max-w-xs mx-auto">
          <div className="flex items-center justify-between text-xs font-game font-bold text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Votes Cast:</span>
            <span className="text-emerald-500 font-extrabold tabular-nums">
              {totalVotes} / {totalEligible}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#0E1326] rounded-full h-3 overflow-hidden border-2 border-slate-200 dark:border-indigo-950 p-0.5">
            <div
              className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalEligible > 0 ? (totalVotes / totalEligible) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Host Early Close */}
        {isHost && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-indigo-950">
            <button
              onClick={handleHostCloseVoting}
              className="py-2.5 px-4 btn-game-slate text-xs font-game font-bold rounded-xl cursor-pointer"
            >
              Force Close Voting & Calculate Results
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-4 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs font-medium animate-shake">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Vote State Banner */}
      {isHost ? (
        <div className="p-5 bg-white dark:bg-[#151B33] border-2 border-amber-300 dark:border-amber-900/60 rounded-3xl text-center space-y-1 shadow-xs transition-colors duration-300">
          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 font-game font-black text-sm uppercase">
            <Crown className="w-4 h-4 fill-amber-400" />
            <span>Host Director · Supervising Vote</span>
          </div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            You do not vote as host. Watch ballot progress or force-close once everyone has decided.
          </p>
        </div>
      ) : hasVoted ? (
        <div className="p-6 bg-white dark:bg-[#151B33] border-2 border-emerald-300 dark:border-emerald-800/80 rounded-3xl text-center space-y-2 shadow-sm transition-colors duration-300">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border-2 border-emerald-300 dark:border-emerald-600 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Check className="w-6 h-6 stroke-[3]" />
          </div>
          <h3 className="text-base font-game font-black text-slate-900 dark:text-white uppercase tracking-wider">
            VOTE SUBMITTED & LOCKED!
          </h3>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Your vote is encrypted. Waiting for remaining players to cast their ballots...
          </p>
        </div>
      ) : isDisqualified ? (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-200 dark:border-rose-800 rounded-3xl text-center space-y-1">
          <h3 className="text-sm font-game font-bold text-rose-700 dark:text-rose-300">
            DISQUALIFIED FROM VOTING
          </h3>
          <p className="text-xs text-rose-600 dark:text-rose-300">
            You were disqualified by the host and cannot vote in this round.
          </p>
        </div>
      ) : null}

      {/* Candidate Cards Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-game font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
          Choose a Suspect
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {eligibleCandidates.map((p) => {
            const isMe = p.userId === user?.id;
            const isSelected = selectedTargetId === p.userId;
            const avatarColor = getAvatarColor(p.username);

            return (
              <div
                key={p.userId}
                onClick={() => !isMe && !hasVoted && !isHost && handleSelectCandidate(p.userId)}
                className={`p-5 rounded-3xl border-2 transition-all relative flex flex-col justify-between gap-4 shadow-xs ${
                  isMe || isHost
                    ? 'border-slate-200 dark:border-indigo-950 bg-slate-100/60 dark:bg-[#0E1326]/60 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/30 ring-3 ring-rose-400 scale-[1.02] shadow-md'
                    : hasVoted
                    ? 'border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#151B33] opacity-60'
                    : 'border-indigo-100 dark:border-indigo-900/60 bg-white dark:bg-[#151B33] hover:border-cyan-400 cursor-pointer active:scale-95'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-game font-black text-sm border-2 border-white/50 shadow-xs ${
                        isSelected ? 'bg-rose-500 text-white' : avatarColor
                      }`}
                    >
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-base font-game font-bold text-slate-900 dark:text-white block">
                        {p.username}
                      </span>
                      {isMe ? (
                        <span className="text-[10px] text-slate-400 font-game font-bold">
                          (Yourself)
                        </span>
                      ) : isHost ? (
                        <span className="text-[10px] text-slate-400 font-game font-bold">
                          (Player)
                        </span>
                      ) : (
                        <span className="text-[10px] font-game font-bold text-slate-400">
                          Suspect
                        </span>
                      )}
                      {p.hasVoted && (
                        <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-game font-bold mt-0.5">
                          ✓ Voted
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Confirm / Cancel Buttons when highlighted */}
                {isSelected && !hasVoted && !isHost && (
                  <div className="pt-3 border-t border-rose-200 dark:border-rose-900/60 flex items-center justify-end gap-2 animate-pop-in">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelSelection();
                      }}
                      className="p-2 btn-game-slate rounded-xl cursor-pointer"
                      title="Cancel Selection"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmVote();
                      }}
                      className="py-2.5 px-4 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{isSubmitting ? 'VOTING...' : 'CONFIRM VOTE'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
