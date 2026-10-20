export type UserRole = 'HOST' | 'ADMIN' | 'PLAYER';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  highestStreak: number;
  currentStreak: number;
  winRate: number; // percentage (e.g. 66.7)
}

export interface UserProfile {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: UserRole;
  createdAt: number;
  avatar?: string;
  isProfileCompleted?: boolean;
  stats?: UserStats;
  likesCount?: number;
}

export type FriendshipStatus = 'SELF' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  fromName?: string;
  toUserId: string;
  toUsername: string;
  toAvatar?: string;
  toName?: string;
  createdAt: number;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
}

export interface FriendItem {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  role: UserRole;
  stats?: UserStats;
  likesCount?: number;
  since?: number;
}

export interface FullUserProfileResponse {
  user: UserProfile;
  stats: UserStats;
  likesCount: number;
  canLike: boolean;
  likeCooldownMs: number;
  friendshipStatus: FriendshipStatus;
  pendingRequestId?: string;
}


export interface ChatMessage {
  id: string;
  roomId?: string; // empty or 'global' for global chat
  senderId: string;
  senderUsername: string;
  senderAvatar?: string;
  content: string;
  timestamp: number;
}

export type PlayerGameRole = 'PLAYER' | 'SPY';

export interface RoomPlayer {
  userId: string;
  username: string;
  avatar?: string;
  isHost: boolean;
  isSecondHost?: boolean;
  isDisqualified: boolean;
  assignedRole?: PlayerGameRole; // stored on server, masked on client for unauthorized
  hasSubmittedHintCurrentRound: boolean;
  hasVoted: boolean;
  votedForUserId?: string; // private on server
  isOnline: boolean;
}

export type GamePhase =
  | 'LOBBY'
  | 'ROUND_1_HINTS'
  | 'ROUND_1_DISCUSSION'
  | 'ROUND_2_HINTS'
  | 'ROUND_2_DISCUSSION'
  | 'ROUND_3_HINTS'
  | 'ROUND_3_DISCUSSION'
  | 'VOTING'
  | 'TIE_RESULT'
  | 'RESULTS';

export interface HintItem {
  id: string;
  round: number; // 1, 2, or 3
  userId: string;
  username: string;
  userAvatar?: string;
  content: string;
  timestamp: number;
}

export interface VoteRecord {
  voterId: string;
  voterUsername: string;
  targetId: string;
  targetUsername: string;
  roundNumber?: number;
}

export type GameMode = 'TEXT' | 'VOICE';
export type SpyGameMode = 'SPY_MODE_1' | 'SPY_MODE_2';

export interface RoomState {
  code: string;
  createdAt: number;
  hostId: string;
  hostUsername: string;
  hostAvatar?: string;
  secondHostId?: string;
  secondHostUsername?: string;
  secondHostAvatar?: string;
  isOpenJoining: boolean;
  isClosed: boolean;
  hasPassword?: boolean;
  phase: GamePhase;
  currentRound: number; // 1, 2, 3
  gameMode: GameMode; // 'TEXT' or 'VOICE'
  spyMode: SpyGameMode; // 'SPY_MODE_1' (Classic) or 'SPY_MODE_2' (Double Word)
  secretWord?: string; // masked to normal players and spies
  spyWord?: string; // Spy's word in SPY_MODE_2 (masked until results or host)
  activeHintTurnUserId?: string | null; // who currently has the hint input open
  timerSecondsRemaining: number;
  timerIsRunning: boolean;
  hints: HintItem[];
  tieCandidates?: string[]; // userIds of tied players in tiebreaker
  tieVoteAudit?: {
    voterUsername: string;
    targetUsername: string;
    voterId: string;
    targetId: string;
  }[];
  winner?: {
    team: 'CITIZENS' | 'SPY';
    spyUsername: string;
    spyUserId: string;
    totalVotes: number;
    voteCounts: Record<string, { username: string; count: number }>;
    voteAudit?: {
      voterUsername: string;
      targetUsername: string;
      voterId: string;
      targetId: string;
    }[];
    reason: string;
  };
  // Client-customized properties (masked before sending)
  myRole?: PlayerGameRole;
  myWord?: string | null;
  players: {
    userId: string;
    username: string;
    avatar?: string;
    isHost: boolean;
    isSecondHost?: boolean;
    isDisqualified: boolean;
    assignedRole?: PlayerGameRole; // only revealed to Host or at RESULTS
    hasSubmittedHintCurrentRound: boolean;
    hasVoted: boolean;
    isOnline: boolean;
  }[];
  totalVotesCast?: number;
  eligibleVotersCount?: number;
}

export type WebRTCSignalData =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit };

export type WebSocketClientMessage =
  | { type: 'AUTH'; token: string }
  | { type: 'JOIN_ROOM'; roomCode: string }
  | { type: 'LEAVE_ROOM'; roomCode: string }
  | { type: 'GLOBAL_CHAT_SEND'; content: string }
  | { type: 'GLOBAL_CHAT_DELETE'; messageId: string }
  | { type: 'GLOBAL_CHAT_CLEAR' }
  | { type: 'ROOM_CHAT_SEND'; roomCode: string; content: string }
  | { type: 'ROOM_CHAT_TYPING'; roomCode: string; isTyping: boolean }
  | { type: 'SUBMIT_HINT'; roomCode: string; content: string }
  | { type: 'CAST_VOTE'; roomCode: string; targetUserId: string }
  | { type: 'HINT_TYPING'; roomCode: string; isTyping: boolean }
  | {
      type: 'VOICE_SIGNAL';
      roomCode: string;
      targetUserId: string;
      signal: WebRTCSignalData;
    }
  | {
      type: 'VOICE_SPEAKING_STATUS';
      roomCode: string;
      isSpeaking: boolean;
    }
  | {
      type: 'RED_LIGHT_SIGNAL';
      roomCode: string;
    };

export type WebSocketServerMessage =
  | { type: 'AUTH_SUCCESS'; user: UserProfile }
  | { type: 'ERROR'; message: string }
  | { type: 'GLOBAL_CHAT_HISTORY'; messages: ChatMessage[] }
  | { type: 'GLOBAL_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'GLOBAL_CHAT_DELETED'; messageId: string }
  | { type: 'GLOBAL_CHAT_CLEARED' }
  | { type: 'FORCE_LOGOUT'; reason: string }
  | { type: 'ROOM_STATE'; room: RoomState }
  | { type: 'ROOM_CHAT_MESSAGE'; roomCode: string; message: ChatMessage }
  | {
      type: 'ROOM_CHAT_TYPING_UPDATE';
      roomCode: string;
      typingUsers: { userId: string; username: string }[];
    }
  | { type: 'ROOM_CLOSED'; roomCode: string; message: string }
  | {
      type: 'HINT_TYPING_UPDATE';
      roomCode: string;
      userId: string;
      username: string;
      isTyping: boolean;
    }
  | {
      type: 'USER_AVATAR_UPDATE';
      userId: string;
      username: string;
      avatar: string;
    }
  | {
      type: 'VOICE_SIGNAL';
      roomCode: string;
      senderUserId: string;
      signal: WebRTCSignalData;
    }
  | {
      type: 'VOICE_SPEAKER_STATUS';
      roomCode: string;
      speakerUserId: string;
      isSpeaking: boolean;
    }
  | {
      type: 'VOICE_SESSION_ENDED';
      roomCode: string;
    }
  | {
      type: 'RED_LIGHT_FLASH';
      roomCode: string;
      userId: string;
      timestamp: number;
    };

