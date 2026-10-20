import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ChatMessage, UserProfile, UserRole, UserStats, FriendRequest, FriendItem, FullUserProfileResponse, FriendshipStatus } from '../src/types.js';

interface StoredUser {
  id: string;
  username: string;
  name?: string;
  email?: string;
  role: UserRole;
  salt?: string;
  hash?: string;
  createdAt: number;
  avatar?: string;
  isProfileCompleted?: boolean;
  stats?: {
    gamesPlayed: number;
    gamesWon: number;
    highestStreak: number;
    currentStreak: number;
  };
  likesCount?: number;
}

interface ProfileLike {
  fromUserId: string;
  toUserId: string;
  timestamp: number;
}

interface StoredFriendRequest {
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

interface StoredFriendship {
  user1Id: string;
  user2Id: string;
  createdAt: number;
}

interface DatabaseSchema {
  users: StoredUser[];
  globalChat: ChatMessage[];
  roomHistory: {
    roomCode: string;
    completedAt: number;
    winnerTeam: string;
    spyUsername: string;
  }[];
  likes?: ProfileLike[];
  friendRequests?: StoredFriendRequest[];
  friendships?: StoredFriendship[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

class Database {
  private data: DatabaseSchema = {
    users: [],
    globalChat: [],
    roomHistory: [],
  };

  constructor() {
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, resetting', err);
      }
    }

    // Ensure Host Account "Nafiul" exists
    let host = this.data.users.find(
      (u) => u.username.toLowerCase() === 'nafiul'
    );
    if (!host) {
      const salt = generateSalt();
      const hash = hashPassword('8762gdjr', salt);
      host = {
        id: 'host-nafiul-001',
        username: 'Nafiul',
        role: 'HOST',
        salt,
        hash,
        createdAt: Date.now(),
      };
      this.data.users.unshift(host);
    } else {
      host.role = 'HOST';
      host.username = 'Nafiul';
    }

    // Ensure Admin Account "Admin" exists
    let admin = this.data.users.find(
      (u) => u.username.toLowerCase() === 'admin'
    );
    if (!admin) {
      const salt = generateSalt();
      const hash = hashPassword('admin123', salt);
      admin = {
        id: 'admin-001',
        username: 'Admin',
        role: 'HOST',
        salt,
        hash,
        createdAt: Date.now(),
      };
      this.data.users.unshift(admin);
    } else {
      admin.role = 'HOST';
    }

    // Pre-seed convenient sample players for immediate multi-window/multi-phone play
    const samplePlayers = [
      { username: 'Player1', password: 'player123' },
      { username: 'Player2', password: 'player123' },
      { username: 'Player3', password: 'player123' },
      { username: 'Player4', password: 'player123' },
    ];

    for (const sp of samplePlayers) {
      if (!this.data.users.find((u) => u.username.toLowerCase() === sp.username.toLowerCase())) {
        const salt = generateSalt();
        const hash = hashPassword(sp.password, salt);
        this.data.users.push({
          id: `user-${sp.username.toLowerCase()}-${Date.now().toString(36)}`,
          username: sp.username,
          role: 'PLAYER',
          salt,
          hash,
          createdAt: Date.now(),
        });
      }
    }

    // Seed welcoming global chat message if empty
    if (!this.data.globalChat || this.data.globalChat.length === 0) {
      this.data.globalChat = [
        {
          id: 'welcome-msg-1',
          roomId: 'global',
          senderId: host.id,
          senderUsername: 'Nafiul',
          content: 'Welcome to SPY GAME! Join a room or wait for a match to start.',
          timestamp: Date.now() - 3600000,
        },
      ];
    }

    if (!this.data.likes) this.data.likes = [];
    if (!this.data.friendRequests) this.data.friendRequests = [];
    if (!this.data.friendships) this.data.friendships = [];

    for (const u of this.data.users) {
      if (!u.stats) {
        u.stats = { gamesPlayed: 0, gamesWon: 0, highestStreak: 0, currentStreak: 0 };
      }
      if (u.likesCount === undefined) {
        u.likesCount = 0;
      }
    }

    this.save();
  }

  public toProfile(user: StoredUser): UserProfile {
    const s = user.stats || {
      gamesPlayed: 0,
      gamesWon: 0,
      highestStreak: 0,
      currentStreak: 0,
    };
    const winRate = s.gamesPlayed > 0 ? Number(((s.gamesWon / s.gamesPlayed) * 100).toFixed(1)) : 0;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      avatar: user.avatar,
      isProfileCompleted: user.isProfileCompleted,
      stats: {
        gamesPlayed: s.gamesPlayed || 0,
        gamesWon: s.gamesWon || 0,
        highestStreak: s.highestStreak || 0,
        currentStreak: s.currentStreak || 0,
        winRate,
      },
      likesCount: user.likesCount || 0,
    };
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Database write error:', err);
    }
  }

  public verifyUser(username: string, password: string): UserProfile | null {
    const trimmed = username.trim();
    const user = this.data.users.find(
      (u) => u.username.toLowerCase() === trimmed.toLowerCase()
    );
    
    // Auto-provision admin if missing
    if (!user) {
      if (trimmed.toLowerCase() === 'admin') {
        const salt = generateSalt();
        const hash = hashPassword(password, salt);
        const newAdmin: StoredUser = {
          id: 'admin-001',
          username: 'Admin',
          role: 'HOST',
          salt,
          hash,
          createdAt: Date.now(),
        };
        this.data.users.unshift(newAdmin);
        this.save();
        return {
          id: newAdmin.id,
          username: newAdmin.username,
          role: newAdmin.role,
          createdAt: newAdmin.createdAt,
        };
      }
      return null;
    }

    if (!user.salt || !user.hash) {
      return null;
    }

    const testHash = hashPassword(password, user.salt);
    const matches = crypto.timingSafeEqual(Buffer.from(testHash, 'hex'), Buffer.from(user.hash, 'hex'));

    // If user is admin or nafiul, allow flexible admin passwords (admin123, 8762gdjr, admin)
    if (!matches && (user.username.toLowerCase() === 'admin' || user.username.toLowerCase() === 'nafiul')) {
      const allowedAdminPasswords = ['admin123', 'admin', '8762gdjr'];
      if (allowedAdminPasswords.includes(password)) {
        user.salt = generateSalt();
        user.hash = hashPassword(password, user.salt);
        user.role = 'HOST';
        this.save();
        return {
          id: user.id,
          username: user.username,
          role: 'HOST',
          createdAt: user.createdAt,
        };
      }
    }

    if (matches) {
      if (user.username.toLowerCase() === 'admin' || user.username.toLowerCase() === 'nafiul') {
        user.role = 'HOST';
      }
      return {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        avatar: user.avatar,
      };
    }
    return null;
  }

  public getUserByEmail(email: string): UserProfile | null {
    const trimmed = email.trim().toLowerCase();
    const user = this.data.users.find((u) => (u.email || '').toLowerCase() === trimmed);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      avatar: user.avatar,
      isProfileCompleted: user.isProfileCompleted,
    };
  }

  public findOrCreateGoogleUser(googleData: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  }): { user: UserProfile; isNewUser: boolean; needsProfileCompletion: boolean } {
    const email = (googleData.email || '').trim().toLowerCase();
    const isMainAdminAccount = email === 'obyda.cmch@gmail.com';
    // If logging in with the primary host email (obyda.cmch@gmail.com), map directly to primary host account (Nafiul)
    if (isMainAdminAccount) {
      let primaryHost = this.data.users.find(
        (u) => u.id === 'host-nafiul-001' || u.username.toLowerCase() === 'nafiul'
      );
      if (!primaryHost) {
        primaryHost = this.data.users.find((u) => u.role === 'HOST') || this.data.users[0];
      }

      if (primaryHost) {
        // Remove any separate user record that held this email to avoid duplicates
        this.data.users = this.data.users.filter(
          (u) => u.id === primaryHost!.id || (u.email && u.email.toLowerCase() !== email)
        );

        primaryHost.email = email;
        primaryHost.role = 'HOST';
        if (googleData.displayName && (!primaryHost.name || primaryHost.name === '')) {
          primaryHost.name = googleData.displayName;
        }
        if (googleData.photoURL && !primaryHost.avatar) {
          primaryHost.avatar = googleData.photoURL;
        }
        primaryHost.isProfileCompleted = true;
        this.save();

        const profile: UserProfile = {
          id: primaryHost.id,
          username: primaryHost.username,
          name: primaryHost.name,
          email: primaryHost.email,
          role: 'HOST',
          createdAt: primaryHost.createdAt,
          avatar: primaryHost.avatar,
          isProfileCompleted: true,
        };

        return {
          user: profile,
          isNewUser: false,
          needsProfileCompletion: false,
        };
      }
    }

    // Search by email or uid for other users
    let user = this.data.users.find(
      (u) => (u.email && u.email.toLowerCase() === email) || u.id === googleData.uid
    );

    if (user) {
      if (!user.email && email) {
        user.email = email;
      }
      if (googleData.displayName && !user.name) {
        user.name = googleData.displayName;
      }
      if (!user.avatar && googleData.photoURL) {
        user.avatar = googleData.photoURL;
      }
      this.save();

      const profile: UserProfile = {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        avatar: user.avatar,
        isProfileCompleted: user.isProfileCompleted ?? false,
      };

      return {
        user: profile,
        isNewUser: false,
        needsProfileCompletion: user.isProfileCompleted !== true,
      };
    }

    // New Google User
    const baseName = (googleData.displayName || email.split('@')[0] || 'Player').replace(/[^a-zA-Z0-9_]/g, '');
    let candidateUsername = baseName.slice(0, 15) || 'Agent';
    // Make sure initial placeholder username is unique
    let counter = 1;
    while (this.getUserByUsername(candidateUsername)) {
      candidateUsername = `${baseName.slice(0, 10)}${Math.floor(100 + Math.random() * 900)}`;
      counter++;
      if (counter > 20) break;
    }

    const newUser: StoredUser = {
      id: googleData.uid || `g_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      username: candidateUsername,
      name: googleData.displayName || '',
      email,
      role: isMainAdminAccount ? 'HOST' : 'PLAYER',
      createdAt: Date.now(),
      avatar: googleData.photoURL || 'avatar-spy-classic',
      isProfileCompleted: false,
    };

    this.data.users.push(newUser);
    this.save();

    const profile: UserProfile = {
      id: newUser.id,
      username: newUser.username,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      avatar: newUser.avatar,
      isProfileCompleted: false,
    };

    return {
      user: profile,
      isNewUser: true,
      needsProfileCompletion: true,
    };
  }

  public checkUsernameAvailable(username: string, excludeUserId?: string): boolean {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 25) return false;
    const exists = this.data.users.some(
      (u) => u.username.toLowerCase() === trimmed && u.id !== excludeUserId
    );
    return !exists;
  }

  public completeUserProfile(
    userId: string,
    data: { name: string; username: string; avatar?: string }
  ): { user?: UserProfile; error?: string } {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) {
      return { error: 'User not found' };
    }

    const cleanUsername = (data.username || '').trim();
    const cleanName = (data.name || '').trim();

    if (!cleanName || cleanName.length < 2) {
      return { error: 'Name must be at least 2 characters long' };
    }

    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 25) {
      return { error: 'Username must be between 3 and 25 characters long' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return { error: 'Username can only contain letters, numbers, and underscores (_)' };
    }

    if (!this.checkUsernameAvailable(cleanUsername, userId)) {
      return { error: 'This username is already taken. Please choose another.' };
    }

    user.username = cleanUsername;
    user.name = cleanName;
    if (data.avatar && data.avatar.trim()) {
      user.avatar = data.avatar.trim();
    }
    user.isProfileCompleted = true;

    // Preserve main admin status
    if (user.email && user.email.toLowerCase() === 'obyda.cmch@gmail.com') {
      user.role = 'HOST';
    }

    this.save();

    const updatedProfile: UserProfile = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      avatar: user.avatar,
      isProfileCompleted: true,
    };

    return { user: updatedProfile };
  }

  public getUserById(id: string): UserProfile | null {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return null;
    return this.toProfile(user);
  }

  public getUserByUsername(username: string): UserProfile | null {
    const trimmed = username.trim().toLowerCase();
    const user = this.data.users.find((u) => u.username.toLowerCase() === trimmed);
    if (!user) return null;
    return this.toProfile(user);
  }

  public updateUserAvatar(userId: string, avatar: string): UserProfile | null {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return null;
    user.avatar = avatar;
    this.save();
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      avatar: user.avatar,
      isProfileCompleted: user.isProfileCompleted,
    };
  }

  public createUser(username: string, password: string): { user?: UserProfile; error?: string } {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) {
      return { error: 'Username must be at least 2 characters long' };
    }
    if (!password || password.length < 4) {
      return { error: 'Password must be at least 4 characters long' };
    }
    if (this.getUserByUsername(trimmed)) {
      return { error: 'Username already exists' };
    }

    const salt = generateSalt();
    const hash = hashPassword(password, salt);
    const id = `user-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const newUser: StoredUser = {
      id,
      username: trimmed,
      role: 'PLAYER',
      salt,
      hash,
      createdAt: Date.now(),
    };

    this.data.users.push(newUser);
    this.save();

    return {
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    };
  }

  public deleteUser(userId: string): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    // Main admin and primary host cannot be deleted
    const lowerName = user.username.toLowerCase();
    const email = (user.email || '').toLowerCase().trim();
    if (
      email === 'obyda.cmch@gmail.com' ||
      lowerName === 'nafiul' ||
      user.id === 'host-nafiul-001'
    ) {
      return false;
    }
    this.data.users = this.data.users.filter((u) => u.id !== userId);
    this.save();
    return true;
  }

  public updateUserRole(userId: string, role: UserRole): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    // Main admin and primary host cannot have role changed
    const lowerName = user.username.toLowerCase();
    const email = (user.email || '').toLowerCase().trim();
    if (
      email === 'obyda.cmch@gmail.com' ||
      lowerName === 'nafiul' ||
      user.id === 'host-nafiul-001'
    ) {
      return false;
    }
    user.role = role;
    this.save();
    return true;
  }

  public getAllUsers(): { id: string; username: string; role: UserRole; createdAt: number; avatar?: string }[] {
    return this.data.users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      avatar: u.avatar,
    }));
  }

  // Global Chat
  public getGlobalChat(limit = 100): ChatMessage[] {
    return this.data.globalChat.slice(-limit);
  }

  public addGlobalChatMessage(sender: UserProfile, content: string): ChatMessage {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      roomId: 'global',
      senderId: sender.id,
      senderUsername: sender.username,
      senderAvatar: sender.avatar,
      content: content.trim(),
      timestamp: Date.now(),
    };
    this.data.globalChat.push(message);
    // Keep last 500 messages
    if (this.data.globalChat.length > 500) {
      this.data.globalChat = this.data.globalChat.slice(-500);
    }
    this.save();
    return message;
  }

  public deleteGlobalChatMessage(messageId: string): boolean {
    const prevLen = this.data.globalChat.length;
    this.data.globalChat = this.data.globalChat.filter((m) => m.id !== messageId);
    if (this.data.globalChat.length !== prevLen) {
      this.save();
      return true;
    }
    return false;
  }

  public clearGlobalChat(): boolean {
    this.data.globalChat = [];
    this.save();
    return true;
  }

  // --- STATS SYSTEM ---
  public getUserStats(userId: string): UserStats {
    const user = this.data.users.find((u) => u.id === userId);
    const s = user?.stats || {
      gamesPlayed: 0,
      gamesWon: 0,
      highestStreak: 0,
      currentStreak: 0,
    };
    const winRate = s.gamesPlayed > 0 ? Number(((s.gamesWon / s.gamesPlayed) * 100).toFixed(1)) : 0;
    return {
      gamesPlayed: s.gamesPlayed || 0,
      gamesWon: s.gamesWon || 0,
      highestStreak: s.highestStreak || 0,
      currentStreak: s.currentStreak || 0,
      winRate,
    };
  }

  public recordGameResult(userId: string, won: boolean): void {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return;
    if (!user.stats) {
      user.stats = {
        gamesPlayed: 0,
        gamesWon: 0,
        highestStreak: 0,
        currentStreak: 0,
      };
    }
    user.stats.gamesPlayed = (user.stats.gamesPlayed || 0) + 1;
    if (won) {
      user.stats.gamesWon = (user.stats.gamesWon || 0) + 1;
      user.stats.currentStreak = (user.stats.currentStreak || 0) + 1;
      user.stats.highestStreak = Math.max(user.stats.highestStreak || 0, user.stats.currentStreak);
    } else {
      user.stats.currentStreak = 0;
    }
    this.save();
  }

  // --- LIKES SYSTEM (24-Hour Cooldown) ---
  public getLikesCount(userId: string): number {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return 0;
    return user.likesCount || 0;
  }

  public canUserLike(fromUserId: string, toUserId: string): { canLike: boolean; remainingMs: number } {
    if (!fromUserId || !toUserId || fromUserId === toUserId) {
      return { canLike: false, remainingMs: 0 };
    }
    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const likes = this.data.likes || [];
    let lastLikeTime = 0;
    for (const l of likes) {
      if (l.fromUserId === fromUserId && l.toUserId === toUserId) {
        if (l.timestamp > lastLikeTime) {
          lastLikeTime = l.timestamp;
        }
      }
    }
    if (!lastLikeTime) {
      return { canLike: true, remainingMs: 0 };
    }
    const elapsed = Date.now() - lastLikeTime;
    if (elapsed >= COOLDOWN_MS) {
      return { canLike: true, remainingMs: 0 };
    }
    return { canLike: false, remainingMs: COOLDOWN_MS - elapsed };
  }

  public likeUserProfile(fromUserId: string, toUserId: string): {
    success: boolean;
    likesCount: number;
    error?: string;
    remainingMs?: number;
    nextLikeAllowedAt?: number;
  } {
    if (fromUserId === toUserId) {
      return { success: false, likesCount: this.getLikesCount(toUserId), error: 'You cannot like your own profile.' };
    }
    const targetUser = this.data.users.find((u) => u.id === toUserId);
    if (!targetUser) {
      return { success: false, likesCount: 0, error: 'User not found.' };
    }
    const check = this.canUserLike(fromUserId, toUserId);
    if (!check.canLike) {
      return {
        success: false,
        likesCount: targetUser.likesCount || 0,
        error: 'You can only like this profile once every 24 hours.',
        remainingMs: check.remainingMs,
        nextLikeAllowedAt: Date.now() + check.remainingMs,
      };
    }

    if (!this.data.likes) this.data.likes = [];
    this.data.likes.push({
      fromUserId,
      toUserId,
      timestamp: Date.now(),
    });

    targetUser.likesCount = (targetUser.likesCount || 0) + 1;
    this.save();

    return {
      success: true,
      likesCount: targetUser.likesCount,
      nextLikeAllowedAt: Date.now() + 24 * 60 * 60 * 1000,
    };
  }

  // --- FRIENDSHIP SYSTEM ---
  public areFriends(userA: string, userB: string): boolean {
    if (!userA || !userB || userA === userB) return false;
    const friendships = this.data.friendships || [];
    return friendships.some(
      (f) =>
        (f.user1Id === userA && f.user2Id === userB) ||
        (f.user1Id === userB && f.user2Id === userA)
    );
  }

  public getFriendshipStatus(viewerId: string, targetId: string): {
    status: FriendshipStatus;
    pendingRequestId?: string;
  } {
    if (viewerId === targetId) {
      return { status: 'SELF' };
    }
    if (this.areFriends(viewerId, targetId)) {
      return { status: 'FRIENDS' };
    }
    const requests = this.data.friendRequests || [];
    const sentReq = requests.find(
      (r) => r.fromUserId === viewerId && r.toUserId === targetId && r.status === 'PENDING'
    );
    if (sentReq) {
      return { status: 'REQUEST_SENT', pendingRequestId: sentReq.id };
    }
    const receivedReq = requests.find(
      (r) => r.fromUserId === targetId && r.toUserId === viewerId && r.status === 'PENDING'
    );
    if (receivedReq) {
      return { status: 'REQUEST_RECEIVED', pendingRequestId: receivedReq.id };
    }
    return { status: 'NONE' };
  }

  public getFriends(userId: string): FriendItem[] {
    const friendships = this.data.friendships || [];
    const friendEntries = friendships.filter(
      (f) => f.user1Id === userId || f.user2Id === userId
    );

    const result: FriendItem[] = [];
    for (const fe of friendEntries) {
      const friendId = fe.user1Id === userId ? fe.user2Id : fe.user1Id;
      const user = this.data.users.find((u) => u.id === friendId);
      if (user) {
        result.push({
          id: user.id,
          username: user.username,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
          stats: this.getUserStats(user.id),
          likesCount: user.likesCount || 0,
          since: fe.createdAt,
        });
      }
    }
    return result;
  }

  public getIncomingFriendRequests(userId: string): FriendRequest[] {
    const requests = this.data.friendRequests || [];
    return requests
      .filter((r) => r.toUserId === userId && r.status === 'PENDING')
      .map((r) => ({
        id: r.id,
        fromUserId: r.fromUserId,
        fromUsername: r.fromUsername,
        fromAvatar: r.fromAvatar,
        fromName: r.fromName,
        toUserId: r.toUserId,
        toUsername: r.toUsername,
        toAvatar: r.toAvatar,
        toName: r.toName,
        createdAt: r.createdAt,
        status: r.status,
      }));
  }

  public sendFriendRequest(fromUserId: string, toUserId: string): {
    success: boolean;
    request?: FriendRequest;
    areNowFriends?: boolean;
    error?: string;
  } {
    if (fromUserId === toUserId) {
      return { success: false, error: 'You cannot send a friend request to yourself.' };
    }
    const fromUser = this.data.users.find((u) => u.id === fromUserId);
    const toUser = this.data.users.find((u) => u.id === toUserId);
    if (!fromUser || !toUser) {
      return { success: false, error: 'User not found.' };
    }
    if (this.areFriends(fromUserId, toUserId)) {
      return { success: false, error: 'You are already friends.' };
    }

    if (!this.data.friendRequests) this.data.friendRequests = [];
    if (!this.data.friendships) this.data.friendships = [];

    // Check if other user already sent a pending request -> auto accept!
    const existingOpposite = this.data.friendRequests.find(
      (r) => r.fromUserId === toUserId && r.toUserId === fromUserId && r.status === 'PENDING'
    );
    if (existingOpposite) {
      existingOpposite.status = 'ACCEPTED';
      this.data.friendships.push({
        user1Id: fromUserId,
        user2Id: toUserId,
        createdAt: Date.now(),
      });
      this.save();
      return { success: true, areNowFriends: true };
    }

    // Check if already sent
    const alreadySent = this.data.friendRequests.find(
      (r) => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'PENDING'
    );
    if (alreadySent) {
      return { success: false, error: 'Friend request already sent.' };
    }

    const newReq: StoredFriendRequest = {
      id: `freq-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      fromUserId: fromUser.id,
      fromUsername: fromUser.username,
      fromAvatar: fromUser.avatar,
      fromName: fromUser.name,
      toUserId: toUser.id,
      toUsername: toUser.username,
      toAvatar: toUser.avatar,
      toName: toUser.name,
      createdAt: Date.now(),
      status: 'PENDING',
    };

    this.data.friendRequests.push(newReq);
    this.save();
    return { success: true, request: newReq };
  }

  public acceptFriendRequest(requestId: string, currentUserId: string): {
    success: boolean;
    friend?: FriendItem;
    error?: string;
  } {
    if (!this.data.friendRequests) this.data.friendRequests = [];
    if (!this.data.friendships) this.data.friendships = [];

    const req = this.data.friendRequests.find(
      (r) => r.id === requestId && r.toUserId === currentUserId && r.status === 'PENDING'
    );
    if (!req) {
      return { success: false, error: 'Friend request not found or already handled.' };
    }

    req.status = 'ACCEPTED';

    if (!this.areFriends(req.fromUserId, req.toUserId)) {
      this.data.friendships.push({
        user1Id: req.fromUserId,
        user2Id: req.toUserId,
        createdAt: Date.now(),
      });
    }
    this.save();

    const friendUser = this.data.users.find((u) => u.id === req.fromUserId);
    const friend: FriendItem | undefined = friendUser
      ? {
          id: friendUser.id,
          username: friendUser.username,
          name: friendUser.name,
          avatar: friendUser.avatar,
          role: friendUser.role,
          stats: this.getUserStats(friendUser.id),
          likesCount: friendUser.likesCount || 0,
          since: Date.now(),
        }
      : undefined;

    return { success: true, friend };
  }

  public declineFriendRequest(requestId: string, currentUserId: string): {
    success: boolean;
    error?: string;
  } {
    if (!this.data.friendRequests) this.data.friendRequests = [];
    const req = this.data.friendRequests.find(
      (r) => r.id === requestId && r.toUserId === currentUserId
    );
    if (!req) {
      return { success: false, error: 'Friend request not found.' };
    }
    req.status = 'DECLINED';
    this.data.friendRequests = this.data.friendRequests.filter((r) => r.id !== requestId);
    this.save();
    return { success: true };
  }

  public removeFriend(userId: string, friendId: string): boolean {
    if (!this.data.friendships) return false;
    const prevCount = this.data.friendships.length;
    this.data.friendships = this.data.friendships.filter(
      (f) =>
        !(
          (f.user1Id === userId && f.user2Id === friendId) ||
          (f.user1Id === friendId && f.user2Id === userId)
        )
    );
    if (this.data.friendRequests) {
      this.data.friendRequests = this.data.friendRequests.filter(
        (r) =>
          !(
            (r.fromUserId === userId && r.toUserId === friendId) ||
            (r.fromUserId === friendId && r.toUserId === userId)
          )
      );
    }
    if (this.data.friendships.length !== prevCount) {
      this.save();
      return true;
    }
    return false;
  }

  // --- USER SEARCH ---
  public searchUsers(query: string, currentUserId?: string): {
    id: string;
    username: string;
    name?: string;
    avatar?: string;
    role: UserRole;
    stats: UserStats;
    likesCount: number;
    friendshipStatus: FriendshipStatus;
  }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = this.data.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q))
    );

    return matches.slice(0, 25).map((u) => {
      const friendship = currentUserId
        ? this.getFriendshipStatus(currentUserId, u.id)
        : { status: 'NONE' as FriendshipStatus };
      return {
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar,
        role: u.role,
        stats: this.getUserStats(u.id),
        likesCount: u.likesCount || 0,
        friendshipStatus: friendship.status,
      };
    });
  }

  // --- COMPLETE USER PROFILE WITH CONTEXT (For Profile Modal) ---
  public getUserProfileWithContext(
    targetIdentifier: string,
    currentUserId?: string
  ): FullUserProfileResponse | null {
    const target = this.data.users.find(
      (u) =>
        u.id === targetIdentifier ||
        u.username.toLowerCase() === targetIdentifier.toLowerCase()
    );
    if (!target) return null;

    const stats = this.getUserStats(target.id);
    const likesCount = target.likesCount || 0;
    const canLikeCheck = currentUserId
      ? this.canUserLike(currentUserId, target.id)
      : { canLike: false, remainingMs: 0 };
    const friendship = currentUserId
      ? this.getFriendshipStatus(currentUserId, target.id)
      : { status: 'NONE' as FriendshipStatus };

    return {
      user: this.toProfile(target),
      stats,
      likesCount,
      canLike: canLikeCheck.canLike,
      likeCooldownMs: canLikeCheck.remainingMs,
      friendshipStatus: friendship.status,
      pendingRequestId: friendship.pendingRequestId,
    };
  }

}

export const db = new Database();
