import crypto from 'node:crypto';
import { db } from './db.js';
import {
  ChatMessage,
  GameMode,
  GamePhase,
  HintItem,
  PlayerGameRole,
  RoomPlayer,
  RoomState,
  SpyGameMode,
  UserProfile,
  VoteRecord,
} from '../src/types.js';

interface InternalRoom extends Omit<RoomState, 'players'> {
  players: RoomPlayer[];
  votes: VoteRecord[];
  roomChat: ChatMessage[];
  secretWord: string;
  spyWord?: string;
  password?: string;
}

export class GameManager {
  private rooms: Map<string, InternalRoom> = new Map();
  private timerInterval: NodeJS.Timeout | null = null;
  private onStateChangeCallback: ((roomCode: string) => void) | null = null;

  constructor() {
    this.startGlobalTimer();
  }

  public setOnStateChange(callback: (roomCode: string) => void) {
    this.onStateChangeCallback = callback;
  }

  private notify(roomCode: string) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(roomCode);
    }
  }

  private startGlobalTimer() {
    this.timerInterval = setInterval(() => {
      let changed = false;
      for (const [code, room] of this.rooms.entries()) {
        if (room.timerIsRunning && room.timerSecondsRemaining > 0) {
          room.timerSecondsRemaining -= 1;
          changed = true;
          if (room.timerSecondsRemaining <= 0) {
            room.timerIsRunning = false;
            this.handleTimerExpired(room);
          }
          this.notify(code);
        }
      }
    }, 1000);
  }

  private handleTimerExpired(room: InternalRoom) {
    // When discussion timer hits 0
    if (room.phase === 'ROUND_1_DISCUSSION') {
      this.transitionToNextPhase(room, 'ROUND_2_HINTS');
    } else if (room.phase === 'ROUND_2_DISCUSSION') {
      this.transitionToNextPhase(room, 'ROUND_3_HINTS');
    } else if (room.phase === 'ROUND_3_DISCUSSION') {
      this.transitionToNextPhase(room, 'VOTING');
    }
  }

  public createRoom(
    hostUser: UserProfile,
    customCode: string,
    gameMode: GameMode = 'TEXT',
    password?: string,
    spyMode: SpyGameMode = 'SPY_MODE_1'
  ): { room?: RoomState; error?: string } {
    const code = customCode.trim().toUpperCase();
    if (code.length !== 5 || !/^[A-Z0-9]{5}$/.test(code)) {
      return { error: 'Room code must be exactly 5 alphanumeric characters' };
    }

    if (this.rooms.has(code) && !this.rooms.get(code)?.isClosed) {
      return { error: `Room ${code} already exists and is active` };
    }

    const cleanPassword = password?.trim() || undefined;

    const newRoom: InternalRoom = {
      code,
      createdAt: Date.now(),
      hostId: hostUser.id,
      hostUsername: hostUser.username,
      hostAvatar: hostUser.avatar,
      isOpenJoining: true,
      isClosed: false,
      password: cleanPassword,
      phase: 'LOBBY',
      currentRound: 1,
      gameMode: gameMode === 'VOICE' ? 'VOICE' : 'TEXT',
      spyMode: spyMode === 'SPY_MODE_2' ? 'SPY_MODE_2' : 'SPY_MODE_1',
      secretWord: '',
      spyWord: '',
      activeHintTurnUserId: null,
      timerSecondsRemaining: 60,
      timerIsRunning: false,
      hints: [],
      votes: [],
      roomChat: [],
      players: [],
    };

    this.rooms.set(code, newRoom);
    this.notify(code);
    return { room: this.getMaskedRoomState(code, hostUser.id, true)! };
  }

  public setSpyMode(roomCode: string, hostUserId: string, mode: SpyGameMode): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (room.phase !== 'LOBBY') return false;
    room.spyMode = mode === 'SPY_MODE_2' ? 'SPY_MODE_2' : 'SPY_MODE_1';
    this.notify(room.code);
    return true;
  }

  public setGameMode(roomCode: string, hostUserId: string, mode: GameMode): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    // Only allow mode changes before game starts
    if (room.phase !== 'LOBBY') return false;
    room.gameMode = mode === 'VOICE' ? 'VOICE' : 'TEXT';
    this.notify(room.code);
    return true;
  }

  public getRoom(roomCode: string): InternalRoom | undefined {
    return this.rooms.get(roomCode.toUpperCase());
  }

  public joinRoom(
    roomCode: string,
    user: UserProfile,
    password?: string
  ): { success: boolean; error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found. Check the 5-character code.' };
    }

    if (room.isClosed) {
      return { success: false, error: 'This room has been closed by the host.' };
    }

    const existingPlayer = room.players.find((p) => p.userId === user.id);
    if (existingPlayer) {
      existingPlayer.isOnline = true;
      existingPlayer.username = user.username;
      if (user.avatar) existingPlayer.avatar = user.avatar;
      this.notify(room.code);
      return { success: true };
    }

    const isSystemAdmin =
      user.email?.toLowerCase() === 'obyda.cmch@gmail.com' ||
      user.role === 'HOST' ||
      (user.role as string) === 'ADMIN' ||
      user.username.toLowerCase() === 'admin' ||
      user.username.toLowerCase() === 'nafiul';

    const isRoomHost = user.id === room.hostId || isSystemAdmin;

    // Password validation for password-protected rooms
    if (!isRoomHost && room.password && room.password.length > 0) {
      if (!password || password.trim() !== room.password) {
        return {
          success: false,
          error: 'Password required or incorrect. Please enter the room password set by the host.',
        };
      }
    }

    // Room Host is the game director and manages the lobby, not a contestant
    if (user.id === room.hostId || isSystemAdmin) {
      this.notify(room.code);
      return { success: true };
    }

    if (!room.isOpenJoining) {
      return { success: false, error: 'Joining is currently disabled by the host.' };
    }

    if (room.phase !== 'LOBBY') {
      return { success: false, error: 'Game is already in progress. Joining not allowed.' };
    }

    room.players.push({
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      isHost: false,
      isDisqualified: false,
      hasSubmittedHintCurrentRound: false,
      hasVoted: false,
      isOnline: true,
    });

    this.notify(room.code);
    return { success: true };
  }

  public leaveRoom(roomCode: string, userId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room) return false;

    // If the room host leaves, automatically close the room!
    if (room.hostId === userId) {
      room.isClosed = true;
      room.timerIsRunning = false;
      this.notify(room.code);
      return true; // indicates room was closed
    }

    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      player.isOnline = false;
      this.notify(room.code);
    }
    return false;
  }

  public canActAsHost(room: InternalRoom, userId: string): boolean {
    if (room.hostId === userId) return true;
    if (room.secondHostId === userId) return true;
    const player = room.players.find((p) => p.userId === userId);
    return Boolean(player?.isHost || player?.isSecondHost);
  }

  // Host Actions
  public setSecondHost(
    roomCode: string,
    hostUserId: string,
    targetUserId: string,
    isSecondHost: boolean
  ): { success: boolean; error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { success: false, error: 'Room not found' };
    if (!this.canActAsHost(room, hostUserId)) {
      return { success: false, error: 'Host permissions required' };
    }

    const targetPlayer = room.players.find((p) => p.userId === targetUserId);
    if (!targetPlayer) {
      return { success: false, error: 'Target player not found in room' };
    }

    if (targetPlayer.userId === room.hostId) {
      return { success: false, error: 'Primary room host cannot be modified' };
    }

    if (isSecondHost) {
      room.players.forEach((p) => {
        if (p.userId === targetUserId) {
          p.isHost = true;
          p.isSecondHost = true;
        } else if (p.userId !== room.hostId && p.isSecondHost) {
          p.isHost = false;
          p.isSecondHost = false;
        }
      });
      room.secondHostId = targetPlayer.userId;
      room.secondHostUsername = targetPlayer.username;
    } else {
      targetPlayer.isHost = false;
      targetPlayer.isSecondHost = false;
      if (room.secondHostId === targetUserId) {
        room.secondHostId = undefined;
        room.secondHostUsername = undefined;
      }
    }

    this.notify(room.code);
    return { success: true };
  }

  public setJoiningStatus(roomCode: string, hostUserId: string, isOpen: boolean): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    room.isOpenJoining = isOpen;
    this.notify(room.code);
    return true;
  }

  public closeRoom(roomCode: string, hostUserId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    room.isClosed = true;
    room.timerIsRunning = false;
    this.notify(room.code);
    return true;
  }

  public removePlayer(roomCode: string, hostUserId: string, targetUserId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (targetUserId === room.hostId) return false;

    room.players = room.players.filter((p) => p.userId !== targetUserId);
    if (room.secondHostId === targetUserId) {
      room.secondHostId = undefined;
      room.secondHostUsername = undefined;
    }
    this.notify(room.code);
    return true;
  }

  public removeUserFromAllRooms(userId: string): void {
    for (const [code, room] of this.rooms.entries()) {
      const prevCount = room.players.length;
      room.players = room.players.filter((p) => p.userId !== userId);
      if (room.secondHostId === userId) {
        room.secondHostId = undefined;
        room.secondHostUsername = undefined;
      }
      if (room.players.length !== prevCount) {
        this.notify(code);
      }
    }
  }

  public updatePlayerRole(
    roomCode: string,
    hostUserId: string,
    targetUserId: string,
    role: PlayerGameRole
  ): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (room.phase !== 'LOBBY') return false;

    const player = room.players.find((p) => p.userId === targetUserId);
    if (!player) return false;

    player.assignedRole = role;
    this.notify(room.code);
    return true;
  }

  public setSecretWord(
    roomCode: string,
    hostUserId: string,
    word: string,
    spyWord?: string
  ): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (room.phase !== 'LOBBY') return false;
    room.secretWord = word.trim().toUpperCase();
    if (typeof spyWord === 'string') {
      room.spyWord = spyWord.trim().toUpperCase();
    }
    this.notify(room.code);
    return true;
  }

  public setSpyWord(roomCode: string, hostUserId: string, spyWord: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (room.phase !== 'LOBBY') return false;
    room.spyWord = spyWord.trim().toUpperCase();
    this.notify(room.code);
    return true;
  }

  public startGame(roomCode: string, hostUserId: string): { success: boolean; error?: string } {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) {
      return { success: false, error: 'Unauthorized or room not found' };
    }

    if (room.players.length < 2) {
      return { success: false, error: 'At least 2 players required to start' };
    }

    if (room.spyMode === 'SPY_MODE_2') {
      const normalWord = (room.secretWord || '').trim().toUpperCase();
      const spyWord = (room.spyWord || '').trim().toUpperCase();

      if (!normalWord || normalWord.length < 2) {
        return {
          success: false,
          error: "Please enter the Citizens' Secret Word (at least 2 letters)",
        };
      }

      if (!spyWord || spyWord.length < 2) {
        return {
          success: false,
          error: "Please enter the Spy's Secret Word (at least 2 letters)",
        };
      }

      if (normalWord === spyWord) {
        return {
          success: false,
          error: "In Double Word Mode, the Citizens' Word and Spy's Word must be different!",
        };
      }
    } else {
      if (!room.secretWord || room.secretWord.length < 2) {
        return { success: false, error: 'Please enter a Secret Word before starting' };
      }
    }

    // Check if at least one Spy is assigned
    const spies = room.players.filter((p) => p.assignedRole === 'SPY');
    if (spies.length === 0) {
      return { success: false, error: 'Please assign at least one SPY role to a player' };
    }

    // Default unassigned to PLAYER
    room.players.forEach((p) => {
      if (!p.assignedRole) {
        p.assignedRole = 'PLAYER';
      }
      p.isDisqualified = false;
      p.hasSubmittedHintCurrentRound = false;
      p.hasVoted = false;
    });

    room.phase = 'ROUND_1_HINTS';
    room.currentRound = 1;
    room.activeHintTurnUserId = null;
    room.isOpenJoining = false;

    this.notify(room.code);
    return { success: true };
  }

  // Round Management
  public selectPlayerForHint(
    roomCode: string,
    hostUserId: string,
    targetUserId: string | null
  ): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    room.activeHintTurnUserId = targetUserId;
    this.notify(room.code);
    return true;
  }

  public submitHint(
    roomCode: string,
    userId: string,
    content: string
  ): { success: boolean; error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { success: false, error: 'Room not found' };

    const player = room.players.find((p) => p.userId === userId);
    if (!player) return { success: false, error: 'Player not in room' };

    if (player.isDisqualified) {
      return { success: false, error: 'Disqualified players cannot submit hints' };
    }

    if (player.hasSubmittedHintCurrentRound) {
      return { success: false, error: 'You have already submitted a hint for this round' };
    }

    const hintText = content.trim();
    if (!hintText) {
      return { success: false, error: 'Hint cannot be empty' };
    }

    const newHint: HintItem = {
      id: `hint-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      round: room.currentRound,
      userId: player.userId,
      username: player.username,
      content: hintText,
      timestamp: Date.now(),
    };

    room.hints.push(newHint);
    player.hasSubmittedHintCurrentRound = true;

    if (room.activeHintTurnUserId === userId) {
      room.activeHintTurnUserId = null;
    }

    // Check if all active non-disqualified players submitted hints
    const eligiblePlayers = room.players.filter((p) => !p.isDisqualified);
    const allSubmitted = eligiblePlayers.every((p) => p.hasSubmittedHintCurrentRound);

    if (allSubmitted) {
      // Transition to discussion automatically
      if (room.phase === 'ROUND_1_HINTS') {
        this.transitionToNextPhase(room, 'ROUND_1_DISCUSSION');
      } else if (room.phase === 'ROUND_2_HINTS') {
        this.transitionToNextPhase(room, 'ROUND_2_DISCUSSION');
      } else if (room.phase === 'ROUND_3_HINTS') {
        this.transitionToNextPhase(room, 'ROUND_3_DISCUSSION');
      }
    }

    this.notify(room.code);
    return { success: true };
  }

  public markHintSubmitted(roomCode: string, hostUserId: string, targetUserId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    const player = room.players.find((p) => p.userId === targetUserId);
    if (!player) return false;

    player.hasSubmittedHintCurrentRound = true;
    if (room.activeHintTurnUserId === targetUserId) {
      room.activeHintTurnUserId = null;
    }

    const eligible = room.players.filter((p) => !p.isDisqualified);
    if (eligible.every((p) => p.hasSubmittedHintCurrentRound)) {
      if (room.phase === 'ROUND_1_HINTS') this.transitionToNextPhase(room, 'ROUND_1_DISCUSSION');
      else if (room.phase === 'ROUND_2_HINTS') this.transitionToNextPhase(room, 'ROUND_2_DISCUSSION');
      else if (room.phase === 'ROUND_3_HINTS') this.transitionToNextPhase(room, 'ROUND_3_DISCUSSION');
    }

    this.notify(room.code);
    return true;
  }

  public setPlayerDisqualification(
    roomCode: string,
    hostUserId: string,
    targetUserId: string,
    disqualified: boolean
  ): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    const player = room.players.find((p) => p.userId === targetUserId);
    if (!player) return false;

    player.isDisqualified = disqualified;
    this.notify(room.code);
    return true;
  }

  public transitionToNextPhase(room: InternalRoom, nextPhase: GamePhase) {
    room.phase = nextPhase;
    room.activeHintTurnUserId = null;

    if (
      nextPhase === 'ROUND_1_DISCUSSION' ||
      nextPhase === 'ROUND_2_DISCUSSION' ||
      nextPhase === 'ROUND_3_DISCUSSION'
    ) {
      room.timerSecondsRemaining = 60;
      room.timerIsRunning = true;
    } else if (nextPhase === 'ROUND_2_HINTS') {
      room.currentRound = 2;
      room.timerIsRunning = false;
      room.players.forEach((p) => (p.hasSubmittedHintCurrentRound = false));
    } else if (nextPhase === 'ROUND_3_HINTS') {
      room.currentRound = 3;
      room.timerIsRunning = false;
      room.players.forEach((p) => (p.hasSubmittedHintCurrentRound = false));
    } else if (nextPhase === 'VOTING') {
      room.timerIsRunning = false;
      room.players.forEach((p) => {
        p.hasVoted = false;
        p.votedForUserId = undefined;
      });
      room.votes = [];
    }
  }

  public hostTriggerPhase(roomCode: string, hostUserId: string, nextPhase: GamePhase): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    this.transitionToNextPhase(room, nextPhase);
    this.notify(room.code);
    return true;
  }

  // Timer controls
  public adjustTimer(
    roomCode: string,
    hostUserId: string,
    action: 'ADD' | 'SUB' | 'PAUSE' | 'RESUME' | 'END'
  ): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;

    if (action === 'ADD') {
      room.timerSecondsRemaining = Math.min(300, room.timerSecondsRemaining + 30);
    } else if (action === 'SUB') {
      room.timerSecondsRemaining = Math.max(5, room.timerSecondsRemaining - 30);
    } else if (action === 'PAUSE') {
      room.timerIsRunning = false;
    } else if (action === 'RESUME') {
      room.timerIsRunning = true;
    } else if (action === 'END') {
      room.timerSecondsRemaining = 0;
      room.timerIsRunning = false;
      this.handleTimerExpired(room);
    }

    this.notify(room.code);
    return true;
  }

  // Voting
  public castVote(
    roomCode: string,
    voterUserId: string,
    targetUserId: string
  ): { success: boolean; error?: string } {
    const room = this.getRoom(roomCode);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.phase !== 'VOTING' && room.phase !== 'TIE_RESULT') {
      return { success: false, error: 'Voting is not active' };
    }

    const voter = room.players.find((p) => p.userId === voterUserId);
    if (!voter) return { success: false, error: 'Voter not found in room' };
    if (voter.isDisqualified) return { success: false, error: 'Disqualified players cannot vote' };
    if (voter.hasVoted) return { success: false, error: 'You have already voted' };
    if (voterUserId === targetUserId) return { success: false, error: 'You cannot vote for yourself' };

    // In tiebreaker, can only vote for tied candidates
    if (room.phase === 'TIE_RESULT' && room.tieCandidates && room.tieCandidates.length > 0) {
      if (!room.tieCandidates.includes(targetUserId)) {
        return { success: false, error: 'You can only vote for the tied candidates' };
      }
    }

    const target = room.players.find((p) => p.userId === targetUserId);
    if (!target) return { success: false, error: 'Selected target player not found' };

    voter.hasVoted = true;
    voter.votedForUserId = targetUserId;

    room.votes.push({
      voterId: voter.userId,
      voterUsername: voter.username,
      targetId: target.userId,
      targetUsername: target.username,
      roundNumber: room.currentRound,
    });

    // Check if all eligible players have voted
    const eligibleVoters = room.players.filter((p) => !p.isDisqualified);
    const allVoted = eligibleVoters.every((p) => p.hasVoted);

    if (allVoted) {
      this.calculateResults(room);
    }

    this.notify(room.code);
    return { success: true };
  }

  public hostCloseVoting(roomCode: string, hostUserId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (room.phase !== 'VOTING' && room.phase !== 'TIE_RESULT') return false;

    this.calculateResults(room);
    this.notify(room.code);
    return true;
  }

  public startTiebreaker(roomCode: string, hostUserId: string): boolean {
    const room = this.getRoom(roomCode);
    if (!room || !this.canActAsHost(room, hostUserId)) return false;
    if (room.phase !== 'TIE_RESULT') return false;

    // Reset votes for tiebreaker round
    room.votes = [];
    room.players.forEach((p) => {
      p.hasVoted = false;
      p.votedForUserId = undefined;
    });

    this.notify(room.code);
    return true;
  }

  private calculateResults(room: InternalRoom) {
    const tally: Record<string, { username: string; count: number; userId: string }> = {};

    // Only count candidates from active players
    room.players.forEach((p) => {
      tally[p.userId] = {
        userId: p.userId,
        username: p.username,
        count: 0,
      };
    });

    for (const v of room.votes) {
      if (tally[v.targetId]) {
        tally[v.targetId].count += 1;
      }
    }

    // If tiebreaker was active, filter tally to tie candidates
    let candidateEntries = Object.values(tally);
    if (room.phase === 'TIE_RESULT' && room.tieCandidates && room.tieCandidates.length > 0) {
      candidateEntries = candidateEntries.filter((c) => room.tieCandidates!.includes(c.userId));
    }

    candidateEntries.sort((a, b) => b.count - a.count);

    if (candidateEntries.length === 0 || candidateEntries[0].count === 0) {
      // Default fallback if no votes cast
      candidateEntries = Object.values(tally).sort((a, b) => b.count - a.count);
    }

    const highestVoteCount = candidateEntries[0]?.count || 0;
    const topCandidates = candidateEntries.filter((c) => c.count === highestVoteCount);

    // If multiple tied for highest
    if (topCandidates.length > 1 && highestVoteCount > 0) {
      room.phase = 'TIE_RESULT';
      room.tieCandidates = topCandidates.map((c) => c.userId);
      room.tieVoteAudit = room.votes.map((v) => ({
        voterUsername: v.voterUsername,
        targetUsername: v.targetUsername,
        voterId: v.voterId,
        targetId: v.targetId,
      }));
      return;
    }

    // Clear tie candidates
    room.tieCandidates = undefined;
    room.tieVoteAudit = undefined;
    room.phase = 'RESULTS';

    const mostVoted = topCandidates[0];
    const actualSpy = room.players.find((p) => p.assignedRole === 'SPY');
    const spyUsername = actualSpy ? actualSpy.username : 'Unknown';
    const spyUserId = actualSpy ? actualSpy.userId : '';

    const isSpyCaught = mostVoted && actualSpy && mostVoted.userId === actualSpy.userId;

    const voteAudit = room.votes.map((v) => ({
      voterUsername: v.voterUsername,
      targetUsername: v.targetUsername,
      voterId: v.voterId,
      targetId: v.targetId,
    }));

    room.winner = {
      team: isSpyCaught ? 'CITIZENS' : 'SPY',
      spyUsername,
      spyUserId,
      totalVotes: room.votes.length,
      voteCounts: Object.fromEntries(
        Object.entries(tally).map(([id, item]) => [id, { username: item.username, count: item.count }])
      ),
      voteAudit,
      reason: isSpyCaught
        ? `Citizens successfully uncovered the Spy (${spyUsername}) with ${mostVoted.count} votes!`
        : `The Spy (${spyUsername}) escaped! Most votes went to ${mostVoted?.username || 'nobody'}.`,
    };

    // Record stats for all participating players
    const winnerTeam = isSpyCaught ? 'CITIZENS' : 'SPY';
    room.players.forEach((player) => {
      if (player.isDisqualified) return;
      const playerWon =
        (winnerTeam === 'CITIZENS' && player.assignedRole === 'PLAYER') ||
        (winnerTeam === 'SPY' && player.assignedRole === 'SPY');
      try {
        db.recordGameResult(player.userId, Boolean(playerWon));
      } catch (err) {
        console.error('Failed to record game stats for user', player.userId, err);
      }
    });
  }

  // Room chat
  public addRoomChatMessage(
    roomCode: string,
    sender: UserProfile,
    content: string
  ): ChatMessage | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    const message: ChatMessage = {
      id: `rc-msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      roomId: room.code,
      senderId: sender.id,
      senderUsername: sender.username,
      content: content.trim(),
      timestamp: Date.now(),
    };

    room.roomChat.push(message);
    if (room.roomChat.length > 300) {
      room.roomChat = room.roomChat.slice(-300);
    }
    return message;
  }

  public getRoomChat(roomCode: string): ChatMessage[] {
    const room = this.getRoom(roomCode);
    return room ? room.roomChat : [];
  }

  // Security: Client-Customized Masked Room State
  public getMaskedRoomState(
    roomCode: string,
    requestingUserId: string,
    isHostAccount: boolean
  ): RoomState | null {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    const requestingPlayer = room.players.find((p) => p.userId === requestingUserId);
    const isHost =
      isHostAccount ||
      room.hostId === requestingUserId ||
      room.secondHostId === requestingUserId ||
      Boolean(requestingPlayer?.isHost || requestingPlayer?.isSecondHost);
    const isResultsPhase = room.phase === 'RESULTS';

    const isDoubleWordMode = room.spyMode === 'SPY_MODE_2';

    // Mask players: hide roles from normal players unless results phase or host
    const maskedPlayers = room.players.map((p) => {
      let showRole = false;
      if (isHost || isResultsPhase) {
        showRole = true;
      } else if (!isDoubleWordMode && p.userId === requestingUserId) {
        // In classic mode, player knows their own role (Citizen or Spy)
        showRole = true;
      }
      return {
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        isHost: p.isHost,
        isSecondHost: p.isSecondHost,
        isDisqualified: p.isDisqualified,
        assignedRole: showRole ? p.assignedRole : undefined,
        hasSubmittedHintCurrentRound: p.hasSubmittedHintCurrentRound,
        hasVoted: p.hasVoted,
        isOnline: p.isOnline,
      };
    });

    const eligibleVoters = room.players.filter((p) => !p.isDisqualified);
    const votesCast = eligibleVoters.filter((p) => p.hasVoted).length;

    let myRole: PlayerGameRole | undefined = undefined;
    let myWord: string | null = null;

    if (requestingPlayer) {
      if (room.phase !== 'LOBBY') {
        if (isDoubleWordMode) {
          // Double Word Mode:
          // Citizens receive normal players' word ("Mango")
          // Spy receives spy word ("Orange")
          // Spy must not be told they are the spy! Never show "SPY" role or badge.
          if (requestingPlayer.assignedRole === 'SPY') {
            myWord = room.spyWord || room.secretWord;
          } else {
            myWord = room.secretWord;
          }
          // Only host or results phase reveals that this user is SPY
          myRole = (isHost || isResultsPhase) ? requestingPlayer.assignedRole : 'PLAYER';
        } else {
          // Classic Mode:
          myRole = requestingPlayer.assignedRole;
          if (myRole === 'PLAYER') {
            myWord = room.secretWord;
          } else if (myRole === 'SPY') {
            myWord = null; // Spy never sees secret word!
          }
        }
      } else {
        // In Lobby:
        myRole = (isHost || !isDoubleWordMode) ? requestingPlayer.assignedRole : undefined;
      }
    }

    return {
      code: room.code,
      createdAt: room.createdAt,
      hostId: room.hostId,
      hostUsername: room.hostUsername,
      hostAvatar: room.hostAvatar,
      secondHostId: room.secondHostId,
      secondHostUsername: room.secondHostUsername,
      secondHostAvatar: room.secondHostAvatar,
      isOpenJoining: room.isOpenJoining,
      isClosed: room.isClosed,
      hasPassword: Boolean(room.password && room.password.length > 0),
      phase: room.phase,
      currentRound: room.currentRound,
      gameMode: room.gameMode || 'TEXT',
      spyMode: room.spyMode || 'SPY_MODE_1',
      // Host sees secret words always; normal players see them only at RESULTS phase
      secretWord: (isHost || isResultsPhase) ? room.secretWord : undefined,
      spyWord: (isHost || isResultsPhase) ? room.spyWord : undefined,
      activeHintTurnUserId: room.activeHintTurnUserId,
      timerSecondsRemaining: room.timerSecondsRemaining,
      timerIsRunning: room.timerIsRunning,
      hints: room.hints,
      tieCandidates: room.tieCandidates,
      tieVoteAudit: room.phase === 'TIE_RESULT' ? room.tieVoteAudit : undefined,
      winner: isResultsPhase ? room.winner : undefined,
      myRole,
      myWord,
      players: maskedPlayers,
      totalVotesCast: votesCast,
      eligibleVotersCount: eligibleVoters.length,
    };
  }
}

export const gameManager = new GameManager();
