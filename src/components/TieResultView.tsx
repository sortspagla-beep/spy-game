import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Check, X, Users, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { isUserHostOrCoHost } from '../utils/hostUtils.js';

export function TieResultView() {
  const { room, user, hostAction, castVote } = useGame();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!room) return null;

  const isHost = isUserHostOrCoHost(user, room);
  const me = room.players.find((p) => p.userId === user?.id);
  const hasVoted = me?.hasVoted;
  const tieCandidates = room.tieCandidates || [];

  const handleStartTiebreaker = async () => {
    if (!isHost) return;
    await hostAction('START_TIEBREAKER');
  };

  const handleSelectCandidate = (candidateId: string) => {
    if (hasVoted || me?.isDisqualified || candidateId === user?.id || isHost) return;
    setSelectedCandidateId(candidateId);
  };

  const handleConfirmVote = async () => {
    if (!selectedCandidateId) return;
    setIsSubmitting(true);
    await castVote(selectedCandidateId);
    setIsSubmitting(false);
  };

  const candidatePlayers = room.players.filter((p) => tieCandidates.includes(p.userId));

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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-pop-in">
      <div className="bg-white dark:bg-[#151B33] border-2 border-amber-300 dark:border-amber-900/70 rounded-3xl p-6 sm:p-8 text-center shadow-[0_12px_24px_rgba(245,158,11,0.08)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] space-y-4 transition-colors duration-300">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-400 dark:border-amber-600 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm animate-bounce-subtle">
          <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black font-game tracking-wider text-amber-700 dark:text-amber-300 uppercase">
          TIEBREAKER ROUND!
        </h1>

        <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
          The vote resulted in a deadlock! The following suspects received the highest suspicion votes:
        </p>

        {/* Tied Candidates List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-2">
          {candidatePlayers.map((p) => {
            const isSelected = selectedCandidateId === p.userId;
            const isMe = p.userId === user?.id;
            const avatarColor = getAvatarColor(p.username);

            return (
              <div
                key={p.userId}
                onClick={() => !isMe && !hasVoted && !isHost && handleSelectCandidate(p.userId)}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-3 ${
                  isMe || isHost
                    ? 'border-slate-200 dark:border-indigo-950 bg-slate-100/60 dark:bg-[#0E1326]/60 opacity-50 cursor-not-allowed'
                    : isSelected
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 ring-2 ring-amber-400 shadow-md'
                    : hasVoted
                    ? 'border-slate-200 dark:border-indigo-950 bg-white dark:bg-[#151B33]'
                    : 'border-amber-200 dark:border-amber-900/60 bg-white dark:bg-[#151B33] hover:border-amber-400 cursor-pointer shadow-xs active:scale-95'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-full ${avatarColor} font-game font-bold text-xs flex items-center justify-center border border-white/50 shadow-xs`}
                    >
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-game font-bold text-slate-900 dark:text-white text-base">
                      {p.username}
                    </span>
                  </div>

                  {isSelected && !hasVoted && !isHost && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCandidateId(null);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
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
                        className="py-1 px-3 btn-game-amber text-xs font-game font-bold rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-40"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>VOTE</span>
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-game font-bold text-amber-600 dark:text-amber-400">
                  Tied Suspect
                </span>
              </div>
            );
          })}
        </div>

        {/* Who Voted for Whom in Previous Round */}
        {room.tieVoteAudit && room.tieVoteAudit.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-indigo-950 text-left max-w-md mx-auto">
            <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-game font-bold block mb-2">
              Who Voted For Whom (Deadlock Audit):
            </span>
            <div className="space-y-1.5 bg-slate-50 dark:bg-[#0E1326] p-3 rounded-2xl border border-slate-200 dark:border-indigo-950">
              {room.tieVoteAudit.map((audit, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 border-b last:border-b-0 border-slate-100 dark:border-indigo-950"
                >
                  <span className="font-game font-bold text-slate-800 dark:text-slate-200">
                    {audit.voterUsername}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>➔ voted for</span>
                    <span className="font-game font-bold text-amber-600 dark:text-amber-400">
                      {audit.targetUsername}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasVoted && (
          <p className="text-xs font-game font-bold text-emerald-500 pt-2">
            ✓ Your tiebreaker vote has been cast. Waiting for resolution...
          </p>
        )}

        {/* Host Re-vote Button */}
        {isHost && (
          <div className="pt-4 border-t border-slate-100 dark:border-indigo-950 flex justify-center">
            <button
              onClick={handleStartTiebreaker}
              className="py-3.5 px-6 btn-game-amber font-game font-black text-xs tracking-wider uppercase rounded-2xl shadow-md flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              <span>START TIEBREAKER ROUND</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
