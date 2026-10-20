import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Minus,
  Send,
  Square,
  AlertTriangle,
  History,
  Crown,
  Gamepad2,
  Sparkles,
} from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { isUserHostOrCoHost } from '../utils/hostUtils.js';

interface RoundDiscussionViewProps {
  roundNumber: number; // 1, 2, 3
}

export function RoundDiscussionView({ roundNumber }: RoundDiscussionViewProps) {
  const { room, user, hostAction, sendRoomChat, roomChat } = useGame();
  const [inputText, setInputText] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  if (!room) return null;

  const isHost = isUserHostOrCoHost(user, room);
  const isFinalDiscussion = roundNumber === 3;
  const timerExpired = room.timerSecondsRemaining <= 0;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomChat]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || timerExpired) return;
    sendRoomChat(inputText);
    setInputText('');
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimerAction = async (timerAction: 'ADD' | 'SUB' | 'PAUSE' | 'RESUME' | 'END') => {
    if (!isHost) return;
    await hostAction('TIMER_ADJUST', { timerAction });
  };

  const hintsSoFar = room.hints;

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
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6 animate-pop-in">
      {/* Cartoon Party Discussion Header with Server Synced Timer */}
      <div className="bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 sm:p-7 shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] flex flex-col md:flex-row items-center justify-between gap-6 transition-colors duration-300">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-[#1C2344] border-2 border-indigo-200 dark:border-indigo-800 rounded-full text-xs font-game font-bold text-indigo-600 dark:text-indigo-300 mb-2 shadow-xs">
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-500" />
            <span>Room Code: {room.code}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-500 font-extrabold uppercase">
              {isFinalDiscussion ? 'FINAL DEBATE' : `ROUND ${roundNumber} CHAT`}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black font-game tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 drop-shadow-xs">
            ROUND {roundNumber} DISCUSSION
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
            Debate the submitted clues! When time is up,{' '}
            {isFinalDiscussion ? 'the final Spy Voting Poll unlocks!' : `Round ${roundNumber + 1} will begin!`}
          </p>
        </div>

        {/* Big Cartoon Synced Countdown Clock */}
        <div className="flex flex-col items-center">
          <div
            className={`px-6 py-3 rounded-3xl border-3 flex items-center gap-3 shadow-md ${
              timerExpired
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 text-rose-600 dark:text-rose-400 animate-shake'
                : room.timerSecondsRemaining <= 15
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-600 dark:text-amber-400 animate-pulse'
                : 'bg-emerald-50 dark:bg-[#0E1326] border-emerald-400 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            <Clock className="w-7 h-7 shrink-0 stroke-[2.5]" />
            <span className="font-game text-4xl sm:text-5xl font-black tracking-wider tabular-nums">
              {formatTimer(room.timerSecondsRemaining)}
            </span>
          </div>
          <span className="text-[11px] font-game font-bold text-slate-400 dark:text-slate-500 mt-1">
            {room.timerIsRunning ? '⚡ LIVE SYNCHRONIZED' : '⏸️ PAUSED BY HOST'}
          </span>
        </div>
      </div>

      {/* Host Timer Controls */}
      {isHost && (
        <div className="bg-white dark:bg-[#151B33] border-2 border-amber-300 dark:border-amber-900/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs transition-colors duration-300">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span className="text-xs font-game font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Host Timer Command
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleTimerAction(room.timerIsRunning ? 'PAUSE' : 'RESUME')}
              className="py-1.5 px-3 btn-game-slate text-xs font-game font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              {room.timerIsRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleTimerAction('ADD')}
              className="py-1.5 px-3 btn-game-slate text-xs font-game font-bold rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+30s</span>
            </button>
            <button
              onClick={() => handleTimerAction('SUB')}
              className="py-1.5 px-3 btn-game-slate text-xs font-game font-bold rounded-xl flex items-center gap-1 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>-30s</span>
            </button>
            <button
              onClick={() => handleTimerAction('END')}
              className="py-1.5 px-3 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border-b-2 border-rose-300 dark:border-rose-800 text-xs font-game font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>End Timer</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Discussion Layout: Left Clues Drawer, Right Live Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hints Sidebar */}
        <div className="lg:col-span-1 bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-5 flex flex-col max-h-[550px] overflow-hidden shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] transition-colors duration-300">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-indigo-950 text-xs font-game font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <History className="w-4 h-4 text-amber-500" />
            <span>Clue Dossier ({hintsSoFar.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {hintsSoFar.length === 0 ? (
              <p className="text-xs font-game text-slate-400 dark:text-slate-500 py-6 text-center">
                No clues recorded yet.
              </p>
            ) : (
              hintsSoFar.map((h) => {
                const avatarColor = getAvatarColor(h.username);
                return (
                  <div
                    key={h.id}
                    className="p-3 bg-slate-50 dark:bg-[#0E1326] border border-slate-200 dark:border-indigo-950 rounded-2xl space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-5 h-5 rounded-full ${avatarColor} font-game font-bold text-[9px] flex items-center justify-center border border-white/40 shadow-xs`}
                        >
                          {h.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-game font-black text-slate-900 dark:text-white">
                          {h.username}
                        </span>
                      </div>
                      <span className="text-[10px] font-game font-bold text-indigo-500">
                        R{h.round}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">
                      "{h.content}"
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Shared Chat Box */}
        <div className="lg:col-span-2 bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl flex flex-col overflow-hidden shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.35)] max-h-[550px] min-h-[400px] transition-colors duration-300">
          {/* Chat Header */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#10152B] border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-game font-black text-slate-800 dark:text-slate-200">
              <MessageSquare className="w-4 h-4 text-rose-500" />
              <span>ROUND {roundNumber} DEBATE</span>
            </div>
            {timerExpired && (
              <div className="flex items-center gap-1.5 text-xs font-game font-bold text-rose-600 dark:text-rose-400 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Timer Expired</span>
              </div>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {roomChat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-12">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-game font-bold">
                  Discussion open! Who sounds like they don't know the word?
                </p>
              </div>
            ) : (
              roomChat.map((msg) => {
                const isMe = msg.senderId === user?.id;
                const isMsgHost = msg.senderUsername.toLowerCase() === 'nafiul';
                const avatarColor = getAvatarColor(msg.senderUsername);

                return (
                  <div
                    key={msg.id}
                    className={`group flex items-end gap-2 ${
                      isMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full shrink-0 ${avatarColor} font-game font-bold text-xs flex items-center justify-center border border-white/40 shadow-xs mb-0.5`}
                    >
                      {msg.senderUsername.charAt(0).toUpperCase()}
                    </div>

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%]`}>
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-xs">
                        <span
                          className={`font-game font-bold ${
                            isMsgHost
                              ? 'text-amber-600 dark:text-amber-400 flex items-center gap-1'
                              : isMe
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isMsgHost && <Crown className="w-3 h-3 fill-current inline" />}
                          {msg.senderUsername}
                          {isMsgHost && ' (Host)'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`px-4 py-2.5 rounded-3xl text-sm leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-br-sm'
                            : isMsgHost
                            ? 'bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 rounded-bl-sm'
                            : 'bg-slate-100 dark:bg-[#1E2545] border border-slate-200 dark:border-indigo-900/60 text-slate-800 dark:text-slate-100 rounded-bl-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 sm:p-4 bg-slate-50 dark:bg-[#10152B] border-t-2 border-indigo-100 dark:border-indigo-950 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={timerExpired}
              placeholder={
                timerExpired
                  ? 'Discussion time has ended.'
                  : 'Debate with other agents in this room...'
              }
              className="flex-1 px-4 py-2.5 bg-white dark:bg-[#161B33] border-2 border-slate-200 dark:border-indigo-950 disabled:opacity-40 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || timerExpired}
              className="py-2.5 px-4 btn-game-coral font-game font-black text-xs tracking-wider rounded-2xl flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">SEND</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
