import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Home, Trophy, Skull, Users, Shield, ArrowRight, Vote, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { isUserHostOrCoHost } from '../utils/hostUtils.js';

export function WinnerResultView() {
  const { room, leaveRoom, user } = useGame();

  if (!room || !room.winner) return null;

  const winner = room.winner;
  const isCitizenWin = winner.team === 'CITIZENS';
  const isHost = isUserHostOrCoHost(user, room);

  // Trigger confetti burst on victory
  useEffect(() => {
    try {
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: isCitizenWin ? ['#2ED573', '#00D2D3', '#FFA502'] : ['#FF4757', '#FF6B81', '#8854D0'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: isCitizenWin ? ['#2ED573', '#00D2D3', '#FFA502'] : ['#FF4757', '#FF6B81', '#8854D0'],
        });

        if (Date.now() < animationEnd) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } catch {
      // Confetti fallback
    }
  }, [isCitizenWin]);

  const handleBackToHome = () => {
    leaveRoom();
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
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6 animate-pop-in">
      <div
        className={`rounded-3xl p-6 sm:p-10 border-3 backdrop-blur-xl shadow-2xl text-center space-y-6 relative overflow-hidden transition-colors duration-300 ${
          isCitizenWin
            ? 'bg-gradient-to-b from-emerald-50 via-white to-teal-50 dark:from-[#112423] dark:via-[#151B33] dark:to-[#0C1021] border-emerald-400 dark:border-emerald-500/60 shadow-emerald-200/50 dark:shadow-emerald-950/40'
            : 'bg-gradient-to-b from-rose-50 via-white to-pink-50 dark:from-[#26101B] dark:via-[#151B33] dark:to-[#0C1021] border-rose-400 dark:border-rose-500/60 shadow-rose-200/50 dark:shadow-rose-950/40'
        }`}
      >
        {/* Victory Cartoon Emblem */}
        <div
          className={`w-24 h-24 mx-auto rounded-3xl flex items-center justify-center border-4 shadow-xl transform -rotate-3 hover:rotate-0 transition-transform ${
            isCitizenWin
              ? 'bg-emerald-100 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-100 dark:bg-rose-950/90 border-rose-300 dark:border-rose-500 text-rose-600 dark:text-rose-400'
          }`}
        >
          {isCitizenWin ? (
            <Trophy className="w-12 h-12 animate-bounce-subtle fill-current" />
          ) : (
            <Skull className="w-12 h-12 animate-pulse fill-current" />
          )}
        </div>

        {/* Big Verdict Headline */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-game font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span
              className={isCitizenWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
            >
              Match Complete
            </span>
          </div>

          <h1
            className={`text-4xl sm:text-5xl md:text-6xl font-black font-game tracking-wider uppercase drop-shadow-xs ${
              isCitizenWin ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isCitizenWin ? 'CITIZENS WIN!' : 'SPY WINS!'}
          </h1>

          <p className="mt-3 text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
            {winner.reason}
          </p>
        </div>

        {/* Revealed Intel Box */}
        <div className="bg-white dark:bg-[#0E1326] border-2 border-indigo-100 dark:border-indigo-950 rounded-3xl p-6 text-left max-w-lg mx-auto space-y-4 shadow-sm transition-colors duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-indigo-950">
            <span className="text-xs uppercase tracking-wider font-game font-bold text-slate-500 dark:text-slate-400">
              The Secret Spy:
            </span>
            <span className="text-lg font-game font-black text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Skull className="w-4 h-4" />
              {winner.spyUsername}
            </span>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-indigo-950">
            <span className="text-xs uppercase tracking-wider font-game font-bold text-slate-500 dark:text-slate-400">
              {room.spyMode === 'SPY_MODE_2' ? "Citizens' Word:" : 'The Secret Word Was:'}
            </span>
            <span className="text-lg font-game font-black tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800">
              {room.secretWord || room.myWord || 'CLASSIFIED'}
            </span>
          </div>

          {room.spyMode === 'SPY_MODE_2' && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-indigo-950">
              <span className="text-xs uppercase tracking-wider font-game font-bold text-slate-500 dark:text-slate-400">
                Spy's Secret Word:
              </span>
              <span className="text-lg font-game font-black tracking-widest text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-xl border border-rose-300 dark:border-rose-800">
                {room.spyWord || 'CLASSIFIED'}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-game font-bold text-slate-500 dark:text-slate-400">
              Total Ballots Cast:
            </span>
            <span className="text-sm font-game font-bold text-slate-900 dark:text-white">
              {winner.totalVotes} Votes
            </span>
          </div>

          {/* Vote Counts Breakdown */}
          {winner.voteCounts && (
            <div className="pt-3 border-t border-slate-100 dark:border-indigo-950 space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-game font-bold text-slate-500 block">
                Tally Breakdown
              </span>
              <div className="space-y-1.5">
                {Object.entries(winner.voteCounts).map(([uid, item]) => (
                  <div key={uid} className="flex items-center justify-between text-xs">
                    <span className="font-game font-bold text-slate-800 dark:text-slate-300">
                      {item.username}
                      {item.username === winner.spyUsername && (
                        <span className="text-rose-500 text-[10px] ml-1.5 font-black">
                          (The Spy)
                        </span>
                      )}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {item.count} {item.count === 1 ? 'vote' : 'votes'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WHO VOTED FOR WHOM - PROMINENT BALLOT AUDIT */}
        <div className="bg-white dark:bg-[#0E1326] border-2 border-indigo-100 dark:border-indigo-950 rounded-3xl p-6 text-left max-w-lg mx-auto space-y-3 shadow-md transition-colors duration-300">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-indigo-950">
            <div className="flex items-center gap-2">
              <Vote className="w-4 h-4 text-rose-500" />
              <span className="text-xs uppercase tracking-wider font-game font-black text-slate-900 dark:text-white">
                WHO VOTED FOR WHOM
              </span>
            </div>
            <span className="text-[10px] font-game font-bold text-slate-400">
              Ballot Record
            </span>
          </div>

          {winner.voteAudit && winner.voteAudit.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-indigo-950">
              {winner.voteAudit.map((vote, index) => {
                const isTargetSpy = vote.targetUsername === winner.spyUsername;
                const voterAvatar = getAvatarColor(vote.voterUsername);

                return (
                  <div key={index} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-full ${voterAvatar} font-game font-bold text-[10px] flex items-center justify-center border border-white/40 shadow-xs shrink-0`}
                      >
                        {vote.voterUsername.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-game font-bold text-slate-900 dark:text-slate-100 truncate">
                        {vote.voterUsername}
                      </span>
                      <span className="text-slate-400 text-[11px] shrink-0 font-medium">
                        ➔ voted for
                      </span>
                      <span
                        className={`font-game font-bold truncate ${
                          isTargetSpy
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {vote.targetUsername}
                      </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isTargetSpy ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-game font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Caught Spy!</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-game font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#1E2545] border border-slate-200 dark:border-indigo-900/60 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>Citizen</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs font-game text-slate-400">
              No ballots were recorded in this match.
            </div>
          )}
        </div>

        {/* Navigation Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleBackToHome}
            className="w-full sm:w-auto py-4 px-8 btn-game-coral font-game font-black text-sm tracking-wider uppercase rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4 stroke-[2.5]" />
            <span>BACK TO HOME LOBBY</span>
          </button>
        </div>
      </div>
    </div>
  );
}
