import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ChatMessage,
  GameMode,
  GamePhase,
  PlayerGameRole,
  RoomState,
  SpyGameMode,
  UserProfile,
  WebRTCSignalData,
  WebSocketServerMessage,
  FriendItem,
  FriendRequest,
  FullUserProfileResponse,
} from '../types.js';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { soundFX } from '../utils/sound.js';

interface GameContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  globalChat: ChatMessage[];
  room: RoomState | null;
  roomChat: ChatMessage[];
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (googleUser: {
    uid: string;
    email: string;
    displayName?: string | null;
    photoURL?: string | null;
  }) => Promise<{ success: boolean; needsProfileCompletion?: boolean; error?: string }>;
  completeProfile: (data: {
    name: string;
    username: string;
    avatar?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  showProfileCompletion: boolean;
  setShowProfileCompletion: (show: boolean) => void;
  logout: () => void;
  sendGlobalChat: (content: string) => void;
  deleteGlobalChat: (messageId: string) => Promise<boolean>;
  clearGlobalChat: () => Promise<boolean>;
  deleteUserAccount: (userId: string) => Promise<{ success: boolean; error?: string }>;
  updateUserRole: (userId: string, role: 'HOST' | 'ADMIN' | 'PLAYER') => Promise<{ success: boolean; error?: string }>;
  updateUserAvatar: (avatarId: string) => Promise<{ success: boolean; error?: string }>;
  createRoom: (roomCode: string, gameMode?: GameMode, password?: string, spyMode?: SpyGameMode) => Promise<{ success: boolean; error?: string }>;
  joinRoom: (roomCode: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  sendRoomChat: (content: string) => void;
  submitHint: (content: string) => Promise<{ success: boolean; error?: string }>;
  castVote: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  hostAction: (action: string, payload?: any) => Promise<{ success: boolean; error?: string }>;
  fetchRoomState: () => Promise<void>;
  hintTypingUser: { userId: string; username: string } | null;
  sendHintTyping: (isTyping: boolean) => void;
  roomChatTypingUsers: { userId: string; username: string }[];
  sendRoomChatTyping: (isTyping: boolean) => void;
  voiceSpeakerStatus: { speakerUserId: string | null; isSpeaking: boolean };
  sendVoiceSignal: (targetUserId: string, signal: WebRTCSignalData) => void;
  sendVoiceSpeakingStatus: (isSpeaking: boolean) => void;
  onVoiceSignal: (callback: (senderUserId: string, signal: WebRTCSignalData) => void) => () => void;
  onVoiceSessionEnded: (callback: () => void) => () => void;
  flashingRedLights: Set<string>;
  triggerRedLightSignal: () => void;
  // New Friends, Profile & Likes
  friends: FriendItem[];
  friendRequests: FriendRequest[];
  loadFriends: () => Promise<void>;
  loadFriendRequests: () => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<{ success: boolean; error?: string }>;
  acceptFriendRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  declineFriendRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>;
  removeFriend: (friendUserId: string) => Promise<{ success: boolean; error?: string }>;
  likeUserProfile: (targetUserId: string) => Promise<{
    success: boolean;
    likesCount?: number;
    nextLikeAllowedAt?: number;
    error?: string;
  }>;
  searchUsers: (query: string) => Promise<any[]>;
  fetchUserProfile: (identifier: string) => Promise<FullUserProfileResponse | null>;
  viewedProfileIdentifier: string | null;
  setViewedProfileIdentifier: (identifier: string | null) => void;
  openUserProfile: (identifier: string) => void;
  isFriendsModalOpen: boolean;
  setIsFriendsModalOpen: (open: boolean) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('spy_game_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showProfileCompletion, setShowProfileCompletion] = useState<boolean>(false);
  const [globalChat, setGlobalChat] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomChat, setRoomChat] = useState<ChatMessage[]>([]);
  const [hintTypingUser, setHintTypingUser] = useState<{ userId: string; username: string } | null>(null);
  const [roomChatTypingUsers, setRoomChatTypingUsers] = useState<{ userId: string; username: string }[]>([]);
  const [flashingRedLights, setFlashingRedLights] = useState<Set<string>>(new Set());
  const redLightTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [voiceSpeakerStatus, setVoiceSpeakerStatus] = useState<{
    speakerUserId: string | null;
    isSpeaking: boolean;
  }>({
    speakerUserId: null,
    isSpeaking: false,
  });

  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [viewedProfileIdentifier, setViewedProfileIdentifier] = useState<string | null>(null);
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hintTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const voiceSignalListenersRef = useRef<Set<(senderUserId: string, signal: WebRTCSignalData) => void>>(new Set());
  const voiceSessionEndedListenersRef = useRef<Set<() => void>>(new Set());

  // Keep roomRef in sync with room state
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Authenticate session on boot and auto-restore active room on refresh
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.user && !data.user.isProfileCompleted) {
            setShowProfileCompletion(true);
          } else {
            setShowProfileCompletion(false);
          }

          // Restore active room if user refreshed while in a room
          const urlParams = new URLSearchParams(window.location.search);
          const savedCode = (urlParams.get('room') || localStorage.getItem('spy_game_current_room') || '').trim().toUpperCase();
          if (savedCode) {
            try {
              const savedPwd = localStorage.getItem(`spy_room_pwd_${savedCode}`) || undefined;
              const joinRes = await fetch(`/api/rooms/${savedCode}/join`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ password: savedPwd }),
              });
              if (joinRes.ok) {
                const joinData = await joinRes.json();
                if (joinData.room && !joinData.room.isClosed) {
                  setRoom(joinData.room);
                  roomRef.current = joinData.room;
                  localStorage.setItem('spy_game_current_room', savedCode);
                  const newUrl = `${window.location.pathname}?room=${savedCode}`;
                  window.history.replaceState(null, '', newUrl);

                  // Fetch active room chat
                  const chatRes = await fetch(`/api/rooms/${savedCode}/chat`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (chatRes.ok) {
                    const chatData = await chatRes.json();
                    setRoomChat(chatData.messages || []);
                  }
                } else {
                  localStorage.removeItem('spy_game_current_room');
                  localStorage.removeItem(`spy_room_pwd_${savedCode}`);
                  window.history.replaceState(null, '', window.location.pathname);
                }
              } else {
                localStorage.removeItem('spy_game_current_room');
                localStorage.removeItem(`spy_room_pwd_${savedCode}`);
                window.history.replaceState(null, '', window.location.pathname);
              }
            } catch (err) {
              console.error('Failed to restore active room on refresh', err);
            }
          }
        } else {
          localStorage.removeItem('spy_game_token');
          localStorage.removeItem('spy_game_current_room');
          setToken(null);
          setUser(null);
          setRoom(null);
          roomRef.current = null;
        }
      } catch (err) {
        console.error('Failed to authenticate token', err);
      } finally {
        setIsLoading(false);
      }
    }
    verifyToken();
  }, [token]);

  // Load initial global chat
  useEffect(() => {
    if (!user) return;
    fetch('/api/global-chat', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.messages) {
          setGlobalChat(data.messages);
        }
      })
      .catch((e) => console.error('Error fetching global chat:', e));
  }, [user, token]);

  // WebSocket Connection
  useEffect(() => {
    if (!token || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    function connectWs() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'AUTH', token }));
        const activeRoomCode = roomRef.current?.code || localStorage.getItem('spy_game_current_room');
        if (activeRoomCode) {
          ws.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: activeRoomCode }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketServerMessage = JSON.parse(event.data);

          if (data.type === 'GLOBAL_CHAT_MESSAGE') {
            setGlobalChat((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            soundFX.playMessage();
          } else if (data.type === 'GLOBAL_CHAT_DELETED') {
            setGlobalChat((prev) => prev.filter((m) => m.id !== data.messageId));
          } else if (data.type === 'GLOBAL_CHAT_CLEARED') {
            setGlobalChat([]);
          } else if (data.type === 'FORCE_LOGOUT') {
            alert(data.reason || 'Your account was deleted by the host.');
            localStorage.removeItem('spy_game_token');
            setUser(null);
            setToken(null);
            setRoom(null);
          } else if (data.type === 'ROOM_STATE') {
            setRoom((prev) => {
              // Trigger audio/visual cues on state changes
              if (prev?.phase !== data.room.phase) {
                if (data.room.phase === 'RESULTS') {
                  soundFX.playVictory();
                } else if (
                  data.room.phase.startsWith('ROUND_') ||
                  data.room.phase === 'VOTING'
                ) {
                  soundFX.playRoundTransition();
                }
              }
              if (
                user &&
                data.room.activeHintTurnUserId === user.id &&
                prev?.activeHintTurnUserId !== user.id
              ) {
                soundFX.playTurnAlert();
              }
              if (prev?.activeHintTurnUserId !== data.room.activeHintTurnUserId) {
                setHintTypingUser(null);
                if (hintTypingTimeoutRef.current) {
                  clearTimeout(hintTypingTimeoutRef.current);
                }
                setVoiceSpeakerStatus({ speakerUserId: null, isSpeaking: false });
              }
              return data.room;
            });
          } else if (data.type === 'ROOM_CHAT_MESSAGE') {
            setRoomChat((prev) => {
              if (prev.some((m) => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            soundFX.playMessage();
          } else if (data.type === 'ROOM_CHAT_TYPING_UPDATE') {
            setRoomChatTypingUsers((data.typingUsers || []).filter((u) => u.userId !== user?.id));
          } else if (data.type === 'HINT_TYPING_UPDATE') {
            if (data.isTyping) {
              setHintTypingUser({ userId: data.userId, username: data.username });
              if (hintTypingTimeoutRef.current) {
                clearTimeout(hintTypingTimeoutRef.current);
              }
              // Hide after 3 seconds if no further typing events received
              hintTypingTimeoutRef.current = setTimeout(() => {
                setHintTypingUser((curr) => (curr?.userId === data.userId ? null : curr));
              }, 3000);
            } else {
              if (hintTypingTimeoutRef.current) {
                clearTimeout(hintTypingTimeoutRef.current);
              }
              setHintTypingUser((curr) => (curr?.userId === data.userId ? null : curr));
            }
          } else if (data.type === 'VOICE_SIGNAL') {
            for (const listener of voiceSignalListenersRef.current) {
              listener(data.senderUserId, data.signal);
            }
          } else if (data.type === 'VOICE_SPEAKER_STATUS') {
            setVoiceSpeakerStatus({
              speakerUserId: data.isSpeaking ? data.speakerUserId : null,
              isSpeaking: data.isSpeaking,
            });
          } else if (data.type === 'VOICE_SESSION_ENDED') {
            setVoiceSpeakerStatus({ speakerUserId: null, isSpeaking: false });
            for (const listener of voiceSessionEndedListenersRef.current) {
              listener();
            }
          } else if (data.type === 'RED_LIGHT_FLASH') {
            const senderUserId = data.userId;
            const existingTimer = redLightTimersRef.current.get(senderUserId);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }
            setFlashingRedLights((prev) => new Set(prev).add(senderUserId));
            const timer = setTimeout(() => {
              redLightTimersRef.current.delete(senderUserId);
              setFlashingRedLights((prev) => {
                const next = new Set(prev);
                next.delete(senderUserId);
                return next;
              });
            }, 1000);
            redLightTimersRef.current.set(senderUserId, timer);
          } else if (data.type === 'ROOM_CLOSED') {
            alert(data.message);
            localStorage.removeItem('spy_game_current_room');
            if (roomRef.current?.code) {
              localStorage.removeItem(`spy_room_pwd_${roomRef.current.code}`);
            }
            window.history.replaceState(null, '', window.location.pathname);
            setRoom(null);
            roomRef.current = null;
            setHintTypingUser(null);
            setRoomChatTypingUsers([]);
            redLightTimersRef.current.forEach((t) => clearTimeout(t));
            redLightTimersRef.current.clear();
            setFlashingRedLights(new Set());
            setVoiceSpeakerStatus({ speakerUserId: null, isSpeaking: false });
            for (const listener of voiceSessionEndedListenersRef.current) {
              listener();
            }
          }
        } catch (err) {
          console.error('Error handling WS event', err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (hintTypingTimeoutRef.current) clearTimeout(hintTypingTimeoutRef.current);
      setRoomChatTypingUsers([]);
      redLightTimersRef.current.forEach((t) => clearTimeout(t));
      redLightTimersRef.current.clear();
      setFlashingRedLights(new Set());
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, user]);

  // Polling fallback sync for rooms (ensures 100% reliability)
  useEffect(() => {
    if (!room?.code || !token) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${room.code}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRoom(data.room);
        }
      } catch (err) {
        // quiet fallback
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [room?.code, token]);

  const loginWithGoogle = async (googleUser: {
    uid: string;
    email: string;
    displayName?: string | null;
    photoURL?: string | null;
  }) => {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleUser),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Google login failed' };
      }

      localStorage.setItem('spy_game_token', data.token);
      setToken(data.token);
      setUser(data.user);
      if (data.needsProfileCompletion || !data.user.isProfileCompleted) {
        setShowProfileCompletion(true);
      } else {
        setShowProfileCompletion(false);
      }
      soundFX.playClick();
      return {
        success: true,
        needsProfileCompletion: data.needsProfileCompletion || !data.user.isProfileCompleted,
      };
    } catch {
      return { success: false, error: 'Network error connecting to game server. Please try again.' };
    }
  };

  const completeProfile = async (data: {
    name: string;
    username: string;
    avatar?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      const respData = await res.json();
      if (!res.ok) {
        return { success: false, error: respData.error || 'Failed to complete profile' };
      }
      setUser(respData.user);
      setShowProfileCompletion(false);
      soundFX.playClick();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error completing profile' };
    }
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 3) return false;
    try {
      const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(trimmed)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        return Boolean(data.available);
      }
      return false;
    } catch {
      return false;
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      localStorage.setItem('spy_game_token', data.token);
      setToken(data.token);
      setUser(data.user);
      if (!data.user.isProfileCompleted) {
        setShowProfileCompletion(true);
      } else {
        setShowProfileCompletion(false);
      }
      soundFX.playClick();
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    try {
      signOut(auth).catch(() => {});
    } catch {}
    localStorage.removeItem('spy_game_token');
    localStorage.removeItem('spy_game_current_room');
    if (roomRef.current?.code) {
      localStorage.removeItem(`spy_room_pwd_${roomRef.current.code}`);
    }
    window.history.replaceState(null, '', window.location.pathname);
    setToken(null);
    setUser(null);
    setShowProfileCompletion(false);
    setRoom(null);
    roomRef.current = null;
    setRoomChatTypingUsers([]);
    redLightTimersRef.current.forEach((t) => clearTimeout(t));
    redLightTimersRef.current.clear();
    setFlashingRedLights(new Set());
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const sendGlobalChat = (content: string) => {
    if (!content.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'GLOBAL_CHAT_SEND', content }));
    } else {
      // HTTP fallback
      fetch('/api/global-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
    }
  };

  const deleteGlobalChat = async (messageId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/global-chat/${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const clearGlobalChat = async (): Promise<boolean> => {
    // Notify via WS first for immediate response
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'GLOBAL_CHAT_CLEAR' }));
    }
    try {
      const res = await fetch('/api/global-chat/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGlobalChat([]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteUserAccount = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/host/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to delete user' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error deleting user' };
    }
  };

  const updateUserRole = async (
    userId: string,
    role: 'HOST' | 'ADMIN' | 'PLAYER'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/host/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update user role' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error updating user role' };
    }
  };

  const updateUserAvatar = async (
    avatarId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/users/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar: avatarId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to update avatar' };
      }
      if (data.user) {
        setUser(data.user);
      } else if (user) {
        setUser({ ...user, avatar: avatarId });
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error updating avatar' };
    }
  };

  const createRoom = async (
    roomCode: string,
    gameMode: GameMode = 'TEXT',
    password?: string,
    spyMode: SpyGameMode = 'SPY_MODE_1'
  ) => {
    try {
      const cleanPassword = password?.trim() || undefined;
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomCode,
          gameMode,
          password: cleanPassword,
          spyMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create room' };
      }
      setRoom(data.room);
      roomRef.current = data.room;
      localStorage.setItem('spy_game_current_room', data.room.code);
      if (cleanPassword) {
        localStorage.setItem(`spy_room_pwd_${data.room.code}`, cleanPassword);
      }
      const newUrl = `${window.location.pathname}?room=${data.room.code}`;
      window.history.replaceState(null, '', newUrl);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: data.room.code }));
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error creating room' };
    }
  };

  const joinRoom = async (roomCode: string, password?: string) => {
    try {
      const code = roomCode.trim().toUpperCase();
      const cleanPassword = password?.trim() || undefined;
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: cleanPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to join room' };
      }
      setRoom(data.room);
      roomRef.current = data.room;
      localStorage.setItem('spy_game_current_room', code);
      if (cleanPassword) {
        localStorage.setItem(`spy_room_pwd_${code}`, cleanPassword);
      }
      const newUrl = `${window.location.pathname}?room=${code}`;
      window.history.replaceState(null, '', newUrl);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'JOIN_ROOM', roomCode: code }));
      }
      // Load room chat
      const chatRes = await fetch(`/api/rooms/${code}/chat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setRoomChat(chatData.messages || []);
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error joining room' };
    }
  };

  const leaveRoom = () => {
    if (room && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'LEAVE_ROOM', roomCode: room.code }));
    }
    localStorage.removeItem('spy_game_current_room');
    if (room) {
      localStorage.removeItem(`spy_room_pwd_${room.code}`);
    }
    window.history.replaceState(null, '', window.location.pathname);
    setRoom(null);
    roomRef.current = null;
    setRoomChat([]);
    setHintTypingUser(null);
    if (hintTypingTimeoutRef.current) {
      clearTimeout(hintTypingTimeoutRef.current);
    }
    setRoomChatTypingUsers([]);
    redLightTimersRef.current.forEach((t) => clearTimeout(t));
    redLightTimersRef.current.clear();
    setFlashingRedLights(new Set());
    setVoiceSpeakerStatus({ speakerUserId: null, isSpeaking: false });
    for (const listener of voiceSessionEndedListenersRef.current) {
      listener();
    }
  };

  const sendRoomChatTyping = (isTyping: boolean) => {
    if (!room || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'ROOM_CHAT_TYPING',
        roomCode: room.code,
        isTyping,
      })
    );
  };

  const triggerRedLightSignal = () => {
    if (!room || !user) return;
    if (room.activeHintTurnUserId !== user.id) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'RED_LIGHT_SIGNAL',
          roomCode: room.code,
        })
      );
    } else {
      fetch(`/api/rooms/${room.code}/red-light`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
  };

  const sendVoiceSignal = (targetUserId: string, signal: WebRTCSignalData) => {
    if (!room || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'VOICE_SIGNAL',
        roomCode: room.code,
        targetUserId,
        signal,
      })
    );
  };

  const sendVoiceSpeakingStatus = (isSpeaking: boolean) => {
    if (!room || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'VOICE_SPEAKING_STATUS',
        roomCode: room.code,
        isSpeaking,
      })
    );
  };

  const onVoiceSignal = (callback: (senderUserId: string, signal: WebRTCSignalData) => void) => {
    voiceSignalListenersRef.current.add(callback);
    return () => {
      voiceSignalListenersRef.current.delete(callback);
    };
  };

  const onVoiceSessionEnded = (callback: () => void) => {
    voiceSessionEndedListenersRef.current.add(callback);
    return () => {
      voiceSessionEndedListenersRef.current.delete(callback);
    };
  };

  const sendHintTyping = (isTyping: boolean) => {
    if (!room || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'HINT_TYPING',
        roomCode: room.code,
        isTyping,
      })
    );
  };

  const sendRoomChat = (content: string) => {
    if (!room || !content.trim()) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: 'ROOM_CHAT_SEND', roomCode: room.code, content })
      );
    }
  };

  const submitHint = async (content: string) => {
    if (!room) return { success: false, error: 'No active room' };
    try {
      const res = await fetch(`/api/rooms/${room.code}/submit-hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to submit hint' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error submitting hint' };
    }
  };

  const castVote = async (targetUserId: string) => {
    if (!room) return { success: false, error: 'No active room' };
    try {
      const res = await fetch(`/api/rooms/${room.code}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to cast vote' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error submitting vote' };
    }
  };

  const hostAction = async (action: string, payload?: any) => {
    if (!room) return { success: false, error: 'No active room' };
    try {
      const res = await fetch(`/api/rooms/${room.code}/host-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Host action failed' };
      }
      return { success: true };
    } catch {
      return { success: false, error: 'Network error executing host action' };
    }
  };

  const fetchRoomState = async () => {
    if (!room?.code || !token) return;
    try {
      const res = await fetch(`/api/rooms/${room.code}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
      }
    } catch {}
  };

  // --- FRIENDS & PROFILE IMPLEMENTATION ---
  const loadFriends = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/friends', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
      }
    } catch {}
  };

  const loadFriendRequests = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/friends/requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data.requests || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (user && token) {
      loadFriends();
      loadFriendRequests();
      const interval = setInterval(() => {
        loadFriends();
        loadFriendRequests();
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [user?.id, token]);

  const sendFriendRequest = async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch(`/api/friends/request/${targetUserId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to send friend request' };
      }
      soundFX.playClick();
      await loadFriends();
      await loadFriendRequests();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error sending friend request' };
    }
  };

  const acceptFriendRequest = async (requestId: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch(`/api/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to accept friend request' };
      }
      soundFX.playClick();
      await loadFriends();
      await loadFriendRequests();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error accepting friend request' };
    }
  };

  const declineFriendRequest = async (requestId: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch(`/api/friends/requests/${requestId}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to decline friend request' };
      }
      soundFX.playClick();
      await loadFriendRequests();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error declining friend request' };
    }
  };

  const removeFriend = async (friendUserId: string): Promise<{ success: boolean; error?: string }> => {
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
      const res = await fetch(`/api/friends/${friendUserId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to remove friend' };
      }
      soundFX.playClick();
      await loadFriends();
      return { success: true };
    } catch {
      return { success: false, error: 'Network error removing friend' };
    }
  };

  const likeUserProfile = async (targetUserId: string): Promise<{
    success: boolean;
    likesCount?: number;
    nextLikeAllowedAt?: number;
    error?: string;
  }> => {
    if (!token) return { success: false, error: 'Unauthorized: Please log in to like profiles' };
    try {
      const res = await fetch(`/api/users/${targetUserId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to like profile' };
      }
      soundFX.playClick();
      return { success: true, likesCount: data.likesCount, nextLikeAllowedAt: data.nextLikeAllowedAt };
    } catch {
      return { success: false, error: 'Network error liking profile' };
    }
  };

  const searchUsers = async (query: string): Promise<any[]> => {
    if (!token || !query.trim()) return [];
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
      return [];
    } catch {
      return [];
    }
  };

  const fetchUserProfile = async (identifier: string): Promise<FullUserProfileResponse | null> => {
    if (!token || !identifier) return null;
    try {
      const res = await fetch(`/api/users/profile/${encodeURIComponent(identifier)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  };

  const openUserProfile = (identifier: string) => {
    if (!identifier) return;
    soundFX.playClick();
    setViewedProfileIdentifier(identifier);
  };

  return (
    <GameContext.Provider
      value={{
        user,
        token,
        isLoading,
        globalChat,
        room,
        roomChat,
        login,
        loginWithGoogle,
        completeProfile,
        checkUsernameAvailable,
        showProfileCompletion,
        setShowProfileCompletion,
        logout,
        sendGlobalChat,
        deleteGlobalChat,
        clearGlobalChat,
        deleteUserAccount,
        updateUserRole,
        updateUserAvatar,
        createRoom,
        joinRoom,
        leaveRoom,
        sendRoomChat,
        submitHint,
        castVote,
        hostAction,
        fetchRoomState,
        hintTypingUser,
        sendHintTyping,
        roomChatTypingUsers,
        sendRoomChatTyping,
        voiceSpeakerStatus,
        sendVoiceSignal,
        sendVoiceSpeakingStatus,
        onVoiceSignal,
        onVoiceSessionEnded,
        flashingRedLights,
        triggerRedLightSignal,
        friends,
        friendRequests,
        loadFriends,
        loadFriendRequests,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        removeFriend,
        likeUserProfile,
        searchUsers,
        fetchUserProfile,
        viewedProfileIdentifier,
        setViewedProfileIdentifier,
        openUserProfile,
        isFriendsModalOpen,
        setIsFriendsModalOpen,
        isSearchModalOpen,
        setIsSearchModalOpen,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
