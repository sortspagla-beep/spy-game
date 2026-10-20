import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Users, ChevronDown, Sparkles, MessageSquare } from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';

export function FloatingRoomChat() {
  const { room, user, roomChat, sendRoomChat, openUserProfile } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadMsgCountRef = useRef(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // If outside a room, this extra room chat box does not appear
  if (!room) return null;

  // Track unread messages when minimized
  useEffect(() => {
    if (isOpen) {
      lastReadMsgCountRef.current = roomChat.length;
      setUnreadCount(0);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      const diff = roomChat.length - lastReadMsgCountRef.current;
      if (diff > 0) {
        setUnreadCount(diff);
      }
    }
  }, [roomChat, isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
        lastReadMsgCountRef.current = roomChat.length;
      }
      return next;
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendRoomChat(inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {/* Floating Chat Box Window */}
      {isOpen && (
        <div className="mb-3 w-[320px] sm:w-[380px] h-[450px] max-h-[75vh] flex flex-col bg-white dark:bg-[#151B33] border-3 border-indigo-200 dark:border-indigo-900/90 rounded-3xl shadow-2xl overflow-hidden animate-pop-in transition-colors duration-300">
          {/* Header */}
          <div className="px-4 py-3 bg-indigo-50/80 dark:bg-[#10152B] border-b-2 border-indigo-100 dark:border-indigo-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-cyan-400 text-slate-900 flex items-center justify-center font-bold shadow-xs">
                <MessageSquare className="w-4 h-4 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-game font-black text-xs sm:text-sm tracking-wide uppercase text-slate-900 dark:text-white">
                    ROOM CHAT
                  </span>
                  <span className="font-mono text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-300 dark:border-cyan-800">
                    {room.code}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-500">
                  {room.players.length} players in room
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Minimize Room Chat"
              >
                <ChevronDown className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {roomChat.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 py-8 px-4">
                <MessageCircle className="w-8 h-8 mb-1.5 opacity-40 text-cyan-500" />
                <p className="text-xs font-game font-bold">Party Room Chat</p>
                <p className="text-[11px] text-slate-400">
                  Send a message to other players in room {room.code}!
                </p>
              </div>
            ) : (
              roomChat.map((msg) => {
                const isMe = msg.senderId === user?.id;
                const isHost = msg.senderUsername.toLowerCase() === 'nafiul';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <button
                      type="button"
                      onClick={() => openUserProfile(msg.senderUsername)}
                      className="cursor-pointer focus:outline-none hover:scale-105 transition-transform"
                      title={`View @${msg.senderUsername}'s profile`}
                    >
                      <PlayerAvatarBadge
                        username={msg.senderUsername}
                        avatarId={msg.senderAvatar}
                        size="sm"
                      />
                    </button>

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                      <div className="flex items-center gap-1 px-1 mb-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => openUserProfile(msg.senderUsername)}
                          className={`font-game font-bold hover:underline cursor-pointer text-left ${
                            isMe
                              ? 'text-rose-500'
                              : isHost
                              ? 'text-amber-500 font-black'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                          title={`View @${msg.senderUsername}'s profile`}
                        >
                          {msg.senderUsername}
                          {isHost && ' 👑'}
                        </button>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div
                        className={`px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-rose-500 text-white rounded-br-none'
                            : 'bg-slate-100 dark:bg-[#0E1326] border border-slate-200 dark:border-indigo-950 text-slate-800 dark:text-slate-100 rounded-bl-none'
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

          {/* Send Input Form */}
          <form
            onSubmit={handleSend}
            className="p-2.5 bg-slate-50 dark:bg-[#10152B] border-t-2 border-indigo-100 dark:border-indigo-950 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Chat in this room..."
              className="flex-1 px-3 py-2 bg-white dark:bg-[#161B33] border-2 border-slate-200 dark:border-indigo-950 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 btn-game-coral rounded-xl cursor-pointer disabled:opacity-40"
              title="Send room message"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative group p-3.5 btn-game-coral rounded-full shadow-2xl flex items-center justify-center cursor-pointer transform hover:scale-105 active:scale-95 transition-all"
        title="Open Extra Room Chat"
        aria-label="Toggle Room Chat"
      >
        <MessageCircle className="w-6 h-6 stroke-[2.5]" />

        {/* Unread Badge */}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-game font-black text-[11px] flex items-center justify-center border-2 border-white dark:border-[#0C1021] animate-bounce-subtle shadow-md">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}

        {/* Small floating Room code indicator */}
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-full border border-white/20 whitespace-nowrap shadow-xs pointer-events-none">
          #{room.code}
        </span>
      </button>
    </div>
  );
}
