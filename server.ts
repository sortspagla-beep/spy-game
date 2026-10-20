import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express, { Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { UserProfile, WebSocketClientMessage, WebSocketServerMessage } from './src/types.js';
import { db } from './server/db.js';
import { gameManager } from './server/gameManager.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// In-memory active session tokens -> UserProfile
const activeSessions = new Map<string, UserProfile>();

function createSession(user: UserProfile): string {
  const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
  activeSessions.set(token, user);
  return token;
}

function getUserFromReq(req: Request): UserProfile | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/, '').trim();
  return activeSessions.get(token) || null;
}

export function isHostOrAdmin(user?: UserProfile | null): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  const username = (user.username || '').toLowerCase();
  const email = (user.email || '').toLowerCase().trim();
  return (
    email === 'obyda.cmch@gmail.com' ||
    role === 'HOST' ||
    role === 'ADMIN' ||
    username === 'nafiul' ||
    username === 'admin'
  );
}

// Map of WebSocket client to user and current joined room
interface ClientSession {
  ws: WebSocket;
  user?: UserProfile;
  roomCode?: string;
}

const clients = new Set<ClientSession>();

// Helper to broadcast room state to all clients connected to that room
function broadcastRoomState(roomCode: string) {
  const code = roomCode.toUpperCase();
  const room = gameManager.getRoom(code);
  if (room && room.isClosed) {
    const payload = JSON.stringify({
      type: 'ROOM_CLOSED',
      message: 'The room host has left or closed this room. Returning to lobby...',
    });
    for (const client of clients) {
      if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        client.roomCode = undefined;
      }
    }
    return;
  }

  for (const client of clients) {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN && client.user) {
      const maskedState = gameManager.getMaskedRoomState(
        code,
        client.user.id,
        isHostOrAdmin(client.user)
      );
      if (maskedState) {
        client.ws.send(JSON.stringify({ type: 'ROOM_STATE', room: maskedState }));
      }
    }
  }
}

// Grace period timers for host disconnects (e.g. 15s to allow smooth browser page refresh)
const hostDisconnectTimers = new Map<string, NodeJS.Timeout>();

function scheduleHostDisconnectCheck(roomCode: string, hostUserId: string) {
  const code = roomCode.toUpperCase();
  if (hostDisconnectTimers.has(code)) {
    clearTimeout(hostDisconnectTimers.get(code)!);
    hostDisconnectTimers.delete(code);
  }

  const timer = setTimeout(() => {
    hostDisconnectTimers.delete(code);
    const room = gameManager.getRoom(code);
    if (!room || room.isClosed) return;

    // Check if host reconnected on another or refreshed socket
    const isHostConnected = Array.from(clients).some(
      (c) => c.roomCode === code && c.user?.id === hostUserId && c.ws.readyState === WebSocket.OPEN
    );

    if (!isHostConnected) {
      // Host has departed; automatically close the room!
      gameManager.leaveRoom(code, hostUserId);
    }
  }, 15000);

  hostDisconnectTimers.set(code, timer);
}

function cancelHostDisconnectCheck(roomCode: string) {
  const code = roomCode.toUpperCase();
  if (hostDisconnectTimers.has(code)) {
    clearTimeout(hostDisconnectTimers.get(code)!);
    hostDisconnectTimers.delete(code);
  }
}

// Hook game manager state changes to WebSocket broadcast
gameManager.setOnStateChange((roomCode) => {
  broadcastRoomState(roomCode);
});

// Broadcast global chat update
function broadcastGlobalChat(message: any) {
  const payload = JSON.stringify({ type: 'GLOBAL_CHAT_MESSAGE', message });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function broadcastGlobalChatDelete(messageId: string) {
  const payload = JSON.stringify({ type: 'GLOBAL_CHAT_DELETED', messageId });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function broadcastGlobalChatClear() {
  const payload = JSON.stringify({ type: 'GLOBAL_CHAT_CLEARED' });
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Broadcast room-scoped hint typing indicator
function broadcastHintTyping(
  roomCode: string,
  userId: string,
  username: string,
  isTyping: boolean
) {
  const code = roomCode.toUpperCase();
  const payload = JSON.stringify({
    type: 'HINT_TYPING_UPDATE',
    roomCode: code,
    userId,
    username,
    isTyping,
  });
  for (const client of clients) {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Broadcast room-scoped voice session ended
function broadcastVoiceSessionEnded(roomCode: string) {
  const code = roomCode.toUpperCase();
  const payload = JSON.stringify({
    type: 'VOICE_SESSION_ENDED',
    roomCode: code,
  });
  for (const client of clients) {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Broadcast active speaker audio activity status
function broadcastVoiceSpeakerStatus(
  roomCode: string,
  speakerUserId: string,
  isSpeaking: boolean
) {
  const code = roomCode.toUpperCase();
  const payload = JSON.stringify({
    type: 'VOICE_SPEAKER_STATUS',
    roomCode: code,
    speakerUserId,
    isSpeaking,
  });
  for (const client of clients) {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Broadcast room-scoped red light signal flash
function broadcastRedLightFlash(roomCode: string, userId: string) {
  const code = roomCode.toUpperCase();
  const payload = JSON.stringify({
    type: 'RED_LIGHT_FLASH',
    roomCode: code,
    userId,
    timestamp: Date.now(),
  });
  for (const client of clients) {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

// Room-scoped room chat typing indicator map:
// roomCode -> Map<userId, { username: string; timer: NodeJS.Timeout }>
const roomChatTypingMap = new Map<string, Map<string, { username: string; timer: NodeJS.Timeout }>>();

function broadcastRoomChatTyping(roomCode: string) {
  const code = roomCode.toUpperCase();
  const roomUsers = roomChatTypingMap.get(code);
  const typingUsers: { userId: string; username: string }[] = [];
  if (roomUsers) {
    for (const [userId, item] of roomUsers.entries()) {
      typingUsers.push({ userId, username: item.username });
    }
  }

  const payload = JSON.stringify({
    type: 'ROOM_CHAT_TYPING_UPDATE',
    roomCode: code,
    typingUsers,
  });

  for (const client of clients) {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function clearUserRoomChatTyping(roomCode: string, userId: string) {
  const code = roomCode.toUpperCase();
  const roomUsers = roomChatTypingMap.get(code);
  if (!roomUsers) return;
  const existing = roomUsers.get(userId);
  if (existing) {
    clearTimeout(existing.timer);
    roomUsers.delete(userId);
    if (roomUsers.size === 0) {
      roomChatTypingMap.delete(code);
    }
    broadcastRoomChatTyping(code);
  }
}

// WebSocket Connection handling
wss.on('connection', (ws) => {
  const session: ClientSession = { ws };
  clients.add(session);

  ws.on('message', (data) => {
    try {
      const parsed: WebSocketClientMessage = JSON.parse(data.toString());

      if (parsed.type === 'AUTH') {
        const user = activeSessions.get(parsed.token);
        if (user) {
          session.user = user;
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user }));
        } else {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid session token' }));
        }
      } else if (parsed.type === 'JOIN_ROOM') {
        if (!session.user) return;
        session.roomCode = parsed.roomCode.toUpperCase();
        cancelHostDisconnectCheck(session.roomCode);
        gameManager.joinRoom(session.roomCode, session.user);
        broadcastRoomState(session.roomCode);
      } else if (parsed.type === 'LEAVE_ROOM') {
        if (session.roomCode && session.user) {
          cancelHostDisconnectCheck(session.roomCode);
          const room = gameManager.getRoom(session.roomCode);
          if (room && room.activeHintTurnUserId === session.user.id) {
            broadcastVoiceSessionEnded(session.roomCode);
          }
          broadcastHintTyping(session.roomCode, session.user.id, session.user.username, false);
          clearUserRoomChatTyping(session.roomCode, session.user.id);
          gameManager.leaveRoom(session.roomCode, session.user.id);
          session.roomCode = undefined;
        }
      } else if (parsed.type === 'GLOBAL_CHAT_SEND') {
        if (!session.user) return;
        const msg = db.addGlobalChatMessage(session.user, parsed.content);
        broadcastGlobalChat(msg);
      } else if (parsed.type === 'GLOBAL_CHAT_DELETE') {
        if (!session.user || !isHostOrAdmin(session.user)) return;
        const deleted = db.deleteGlobalChatMessage(parsed.messageId);
        if (deleted) {
          broadcastGlobalChatDelete(parsed.messageId);
        }
      } else if (parsed.type === 'GLOBAL_CHAT_CLEAR') {
        if (!session.user || !isHostOrAdmin(session.user)) return;
        db.clearGlobalChat();
        broadcastGlobalChatClear();
      } else if (parsed.type === 'ROOM_CHAT_SEND') {
        if (!session.user || !parsed.roomCode) return;
        clearUserRoomChatTyping(parsed.roomCode, session.user.id);
        const msg = gameManager.addRoomChatMessage(parsed.roomCode, session.user, parsed.content);
        if (msg) {
          // Broadcast room chat message
          for (const client of clients) {
            if (
              client.roomCode === parsed.roomCode.toUpperCase() &&
              client.ws.readyState === WebSocket.OPEN
            ) {
              client.ws.send(
                JSON.stringify({
                  type: 'ROOM_CHAT_MESSAGE',
                  roomCode: parsed.roomCode,
                  message: msg,
                })
              );
            }
          }
        }
      } else if (parsed.type === 'ROOM_CHAT_TYPING') {
        if (!session.user || !parsed.roomCode) return;
        const code = parsed.roomCode.toUpperCase();
        const room = gameManager.getRoom(code);
        if (!room) return;

        // Verify sender is in this room or is host
        const isAuthorizedInRoom =
          room.players.some((p) => p.userId === session.user?.id) ||
          session.user.id === room.hostId ||
          session.user.id === room.secondHostId;
        if (!isAuthorizedInRoom) return;

        if (parsed.isTyping) {
          if (!roomChatTypingMap.has(code)) {
            roomChatTypingMap.set(code, new Map());
          }
          const roomUsers = roomChatTypingMap.get(code)!;
          const existing = roomUsers.get(session.user.id);
          if (existing) {
            clearTimeout(existing.timer);
          }
          const uid = session.user.id;
          const timer = setTimeout(() => {
            clearUserRoomChatTyping(code, uid);
          }, 3500);
          roomUsers.set(uid, {
            username: session.user.username,
            timer,
          });
          broadcastRoomChatTyping(code);
        } else {
          clearUserRoomChatTyping(code, session.user.id);
        }
      } else if (parsed.type === 'SUBMIT_HINT') {
        if (!session.user || !parsed.roomCode) return;
        broadcastHintTyping(parsed.roomCode, session.user.id, session.user.username, false);
        broadcastVoiceSessionEnded(parsed.roomCode);
        gameManager.submitHint(parsed.roomCode, session.user.id, parsed.content);
      } else if (parsed.type === 'HINT_TYPING') {
        if (!session.user || !parsed.roomCode) return;
        const code = parsed.roomCode.toUpperCase();
        const room = gameManager.getRoom(code);
        if (!room) return;

        // Security & Validation:
        // 1. Sender must be an active, non-disqualified player in this room
        const player = room.players.find((p) => p.userId === session.user?.id);
        if (!player || player.isDisqualified) return;

        // 2. Sender must be the player who currently has the Hint Box open
        // (Host opens the hint box; player types hint. Host actions never trigger this)
        if (room.activeHintTurnUserId !== session.user.id) return;

        // 3. Only send user identity and isTyping boolean - never reveal hint text!
        broadcastHintTyping(
          code,
          session.user.id,
          session.user.username,
          Boolean(parsed.isTyping)
        );
      } else if (parsed.type === 'VOICE_SIGNAL') {
        if (!session.user || !parsed.roomCode || !parsed.targetUserId || !parsed.signal) return;
        const code = parsed.roomCode.toUpperCase();
        const room = gameManager.getRoom(code);
        if (!room || room.isClosed) return;
        if (room.gameMode !== 'VOICE') return;

        // Strict Server-Side Validation:
        // 1. Sender must be authorized in this room
        const isSenderInRoom =
          room.players.some((p) => p.userId === session.user?.id) ||
          session.user.id === room.hostId ||
          session.user.id === room.secondHostId;
        if (!isSenderInRoom) return;

        // 2. Target must also be in this room
        const isTargetInRoom =
          room.players.some((p) => p.userId === parsed.targetUserId) ||
          parsed.targetUserId === room.hostId ||
          parsed.targetUserId === room.secondHostId;
        if (!isTargetInRoom) return;

        // 3. Strict Speaker Authorization:
        // Only the player currently selected for hint turn can publish live audio offers!
        if (parsed.signal.type === 'offer') {
          if (room.activeHintTurnUserId !== session.user.id) {
            return;
          }
        } else if (parsed.signal.type === 'answer') {
          // Answers must be returned to the active speaker
          if (parsed.targetUserId !== room.activeHintTurnUserId) {
            return;
          }
        } else if (parsed.signal.type === 'ice-candidate') {
          // ICE candidates must involve the active speaker
          if (
            session.user.id !== room.activeHintTurnUserId &&
            parsed.targetUserId !== room.activeHintTurnUserId
          ) {
            return;
          }
        }

        // 4. Forward ONLY to target in this exact room (room-level isolation)
        for (const client of clients) {
          if (
            client.roomCode === code &&
            client.user?.id === parsed.targetUserId &&
            client.ws.readyState === WebSocket.OPEN
          ) {
            client.ws.send(
              JSON.stringify({
                type: 'VOICE_SIGNAL',
                roomCode: code,
                senderUserId: session.user.id,
                signal: parsed.signal,
              })
            );
            break;
          }
        }
      } else if (parsed.type === 'VOICE_SPEAKING_STATUS') {
        if (!session.user || !parsed.roomCode) return;
        const code = parsed.roomCode.toUpperCase();
        const room = gameManager.getRoom(code);
        if (!room || room.gameMode !== 'VOICE') return;

        // Only active speaker can publish speaking status
        if (room.activeHintTurnUserId !== session.user.id) return;

        broadcastVoiceSpeakerStatus(code, session.user.id, Boolean(parsed.isSpeaking));
      } else if (parsed.type === 'CAST_VOTE') {
        if (!session.user || !parsed.roomCode) return;
        gameManager.castVote(parsed.roomCode, session.user.id, parsed.targetUserId);
      } else if (parsed.type === 'RED_LIGHT_SIGNAL') {
        if (!session.user || !parsed.roomCode) return;
        const code = parsed.roomCode.toUpperCase();
        const room = gameManager.getRoom(code);
        if (!room || room.isClosed) return;

        const player = room.players.find((p) => p.userId === session.user?.id);
        if (!player || player.isDisqualified) return;

        if (room.activeHintTurnUserId !== session.user.id) return;

        broadcastRedLightFlash(code, session.user.id);
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    if (session.roomCode && session.user) {
      const room = gameManager.getRoom(session.roomCode);
      if (room && room.activeHintTurnUserId === session.user.id) {
        broadcastVoiceSessionEnded(session.roomCode);
      }
      broadcastHintTyping(session.roomCode, session.user.id, session.user.username, false);
      clearUserRoomChatTyping(session.roomCode, session.user.id);

      const code = session.roomCode;
      const uid = session.user.id;
      if (room && room.hostId === uid) {
        // Allow a 15-second grace period for smooth browser page reload without closing room
        scheduleHostDisconnectCheck(code, uid);
      } else {
        gameManager.leaveRoom(code, uid);
      }
    }
    clients.delete(session);
  });
});

// REST API ROUTES

// Google Auth Sign-In / Registration
app.post('/api/auth/google', (req: Request, res: Response): void => {
  const { uid, email, displayName, photoURL } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Google account email is required' });
    return;
  }

  const result = db.findOrCreateGoogleUser({
    uid: uid || `g_${Date.now().toString(36)}`,
    email,
    displayName,
    photoURL,
  });

  const token = createSession(result.user);
  res.json({
    user: result.user,
    token,
    isNewUser: result.isNewUser,
    needsProfileCompletion: result.needsProfileCompletion,
  });
});

// Check username availability
app.get('/api/auth/check-username', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  const username = String(req.query.username || '');
  if (!username) {
    res.json({ available: false, error: 'Username is empty' });
    return;
  }
  const isAvailable = db.checkUsernameAvailable(username, user?.id);
  res.json({ available: isAvailable, username });
});

// Complete Profile
app.post('/api/auth/complete-profile', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { name, username, avatar } = req.body;
  const result = db.completeUserProfile(user.id, { name, username, avatar });
  if (result.error || !result.user) {
    res.status(400).json({ error: result.error || 'Failed to complete profile' });
    return;
  }

  // Update active sessions
  for (const [, sessUser] of activeSessions.entries()) {
    if (sessUser.id === user.id) {
      sessUser.username = result.user.username;
      sessUser.name = result.user.name;
      sessUser.avatar = result.user.avatar;
      sessUser.isProfileCompleted = true;
    }
  }

  // Update connected websocket clients
  for (const client of clients) {
    if (client.user?.id === user.id) {
      client.user.username = result.user.username;
      client.user.name = result.user.name;
      client.user.avatar = result.user.avatar;
      client.user.isProfileCompleted = true;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: client.user }));
      }
    }
  }

  res.json({ success: true, user: result.user });
});

// 1. Auth Login (Legacy fallback)
app.post('/api/auth/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const user = db.verifyUser(username, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const token = createSession(user);
  res.json({ user, token });
});

// Current User Me
app.get('/api/auth/me', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ user });
});

// Update Profile Avatar
app.put('/api/users/avatar', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { avatar } = req.body;
  if (!avatar || typeof avatar !== 'string') {
    res.status(400).json({ error: 'Avatar identifier is required' });
    return;
  }

  const updated = db.updateUserAvatar(user.id, avatar);
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  for (const [, sessUser] of activeSessions.entries()) {
    if (sessUser.id === user.id) {
      sessUser.avatar = avatar;
    }
  }

  for (const client of clients) {
    if (client.user?.id === user.id) {
      client.user.avatar = avatar;
    }
  }

  res.json({ success: true, user: updated });
});

// 1. Get User Profile with Stats & Context
app.get('/api/users/profile/:identifier', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  const identifier = req.params.identifier;
  if (!identifier) {
    res.status(400).json({ error: 'User identifier is required' });
    return;
  }

  const profileData = db.getUserProfileWithContext(identifier, currentUser?.id);
  if (!profileData) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(profileData);
});

// 2. Like a User Profile (24-Hour Cooldown)
app.post('/api/users/:userId/like', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized: Please log in to like profiles' });
    return;
  }
  const targetUserId = req.params.userId;
  if (!targetUserId) {
    res.status(400).json({ error: 'Target user ID is required' });
    return;
  }

  const result = db.likeUserProfile(currentUser.id, targetUserId);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }

  res.json(result);
});

// 3. Search Users by Username or Name
app.get('/api/users/search', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  const query = String(req.query.q || '');
  const users = db.searchUsers(query, currentUser?.id);
  res.json({ users });
});

// 4. Get Friends List
app.get('/api/friends', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const friends = db.getFriends(currentUser.id);
  res.json({ friends });
});

// 5. Get Incoming Friend Requests
app.get('/api/friends/requests', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const requests = db.getIncomingFriendRequests(currentUser.id);
  res.json({ requests });
});

// 6. Send Friend Request
app.post('/api/friends/request/:targetUserId', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const targetUserId = req.params.targetUserId;
  const result = db.sendFriendRequest(currentUser.id, targetUserId);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// 7. Accept Friend Request
app.post('/api/friends/requests/:requestId/accept', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const requestId = req.params.requestId;
  const result = db.acceptFriendRequest(requestId, currentUser.id);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// 8. Decline Friend Request
app.post('/api/friends/requests/:requestId/decline', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const requestId = req.params.requestId;
  const result = db.declineFriendRequest(requestId, currentUser.id);
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

// 9. Remove Friend
app.delete('/api/friends/:friendUserId', (req: Request, res: Response): void => {
  const currentUser = getUserFromReq(req);
  if (!currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const friendUserId = req.params.friendUserId;
  const removed = db.removeFriend(currentUser.id, friendUserId);
  res.json({ success: removed });
});


// Host User Management
app.get('/api/host/users', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host access only' });
    return;
  }
  const users = db.getAllUsers();
  res.json({ users });
});

app.post('/api/host/create-user', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host access only' });
    return;
  }

  const { username, password } = req.body;
  const result = db.createUser(username, password);
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ user: result.user });
});

app.delete('/api/host/users/:id', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host access only' });
    return;
  }

  const targetId = req.params.id;
  const success = db.deleteUser(targetId);
  if (!success) {
    res.status(400).json({ error: 'Could not delete user. Primary host account cannot be deleted.' });
    return;
  }

  // Remove player from all active game rooms
  gameManager.removeUserFromAllRooms(targetId);

  // Invalidate any active sessions
  for (const [token, sessUser] of activeSessions.entries()) {
    if (sessUser.id === targetId) {
      activeSessions.delete(token);
    }
  }

  // Terminate any connected sockets for this user
  for (const client of clients) {
    if (client.user?.id === targetId) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type: 'FORCE_LOGOUT', reason: 'Account deleted by host' }));
        client.ws.close();
      }
    }
  }

  res.json({ success: true });
});

app.put('/api/host/users/:id/role', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host access only' });
    return;
  }

  const { role } = req.body;
  if (!role || (role !== 'HOST' && role !== 'ADMIN' && role !== 'PLAYER')) {
    res.status(400).json({ error: 'Invalid role specified' });
    return;
  }

  const targetId = req.params.id;
  const success = db.updateUserRole(targetId, role);
  if (!success) {
    res.status(400).json({ error: 'Could not update user role. Primary host account cannot be modified.' });
    return;
  }

  // Update active sessions and connected sockets for this user
  for (const [, sessUser] of activeSessions.entries()) {
    if (sessUser.id === targetId) {
      sessUser.role = role;
    }
  }

  for (const client of clients) {
    if (client.user?.id === targetId) {
      client.user.role = role;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', user: client.user }));
      }
    }
  }

  res.json({ success: true, role });
});

// Global Chat
app.get('/api/global-chat', (_req: Request, res: Response): void => {
  const messages = db.getGlobalChat();
  res.json({ messages });
});

app.post('/api/global-chat', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Content cannot be empty' });
    return;
  }

  const message = db.addGlobalChatMessage(user, content);
  broadcastGlobalChat(message);
  res.json({ message });
});

app.delete('/api/global-chat/:id', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host or Admin access only' });
    return;
  }

  const success = db.deleteGlobalChatMessage(req.params.id);
  if (success) {
    broadcastGlobalChatDelete(req.params.id);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Message not found' });
  }
});

// Clear entire global chat history (Host or Admin)
app.post('/api/global-chat/clear', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host or Admin access only' });
    return;
  }

  db.clearGlobalChat();
  broadcastGlobalChatClear();
  res.json({ success: true });
});

app.delete('/api/global-chat', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user || !isHostOrAdmin(user)) {
    res.status(403).json({ error: 'Forbidden: Host or Admin access only' });
    return;
  }

  db.clearGlobalChat();
  broadcastGlobalChatClear();
  res.json({ success: true });
});

// Rooms
app.post('/api/rooms/create', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Please log in to create a room' });
    return;
  }

  const { roomCode, gameMode, password, spyMode } = req.body;
  const result = gameManager.createRoom(
    user,
    roomCode,
    gameMode === 'VOICE' ? 'VOICE' : 'TEXT',
    typeof password === 'string' ? password : undefined,
    spyMode === 'SPY_MODE_2' ? 'SPY_MODE_2' : 'SPY_MODE_1'
  );
  if (result.error) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ room: result.room });
});

// WebRTC ICE Configuration (STUN and optional TURN via secure env vars)
app.get('/api/webrtc/config', (_req: Request, res: Response): void => {
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ];

  if (process.env.TURN_SERVER_URL) {
    iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers });
});

app.post('/api/rooms/:code/join', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { password } = req.body || {};
  const result = gameManager.joinRoom(
    req.params.code,
    user,
    typeof password === 'string' ? password : undefined
  );
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  const masked = gameManager.getMaskedRoomState(req.params.code, user.id, isHostOrAdmin(user));
  res.json({ room: masked });
});

app.get('/api/rooms/:code', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const masked = gameManager.getMaskedRoomState(req.params.code, user.id, isHostOrAdmin(user));
  if (!masked) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json({ room: masked });
});

app.get('/api/rooms/:code/chat', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const messages = gameManager.getRoomChat(req.params.code);
  res.json({ messages });
});

// Host Actions on Room
app.post('/api/rooms/:code/host-action', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const roomCode = req.params.code;
  const room = gameManager.getRoom(roomCode);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const isRoomHost = isHostOrAdmin(user) || gameManager.canActAsHost(room, user.id);
  if (!isRoomHost) {
    res.status(403).json({ error: 'Host permissions required' });
    return;
  }

  const { action, payload } = req.body;

  switch (action) {
    case 'SET_GAME_MODE': {
      const mode = payload?.mode === 'VOICE' ? 'VOICE' : 'TEXT';
      const success = gameManager.setGameMode(roomCode, user.id, mode);
      if (!success) {
        res.status(400).json({ error: 'Cannot change game mode after game has started or unauthorized' });
        return;
      }
      break;
    }
    case 'SET_SECOND_HOST': {
      const resHost = gameManager.setSecondHost(
        roomCode,
        user.id,
        payload?.targetUserId,
        Boolean(payload?.isSecondHost)
      );
      if (!resHost.success) {
        res.status(400).json({ error: resHost.error });
        return;
      }
      break;
    }
    case 'SET_JOINING':
      gameManager.setJoiningStatus(roomCode, user.id, Boolean(payload?.isOpen));
      break;
    case 'CLOSE_ROOM':
      gameManager.closeRoom(roomCode, user.id);
      break;
    case 'REMOVE_PLAYER':
      gameManager.removePlayer(roomCode, user.id, payload?.targetUserId);
      break;
    case 'SET_ROLE':
      gameManager.updatePlayerRole(roomCode, user.id, payload?.targetUserId, payload?.role);
      break;
    case 'SET_SPY_MODE': {
      const spyMode = payload?.spyMode === 'SPY_MODE_2' ? 'SPY_MODE_2' : 'SPY_MODE_1';
      const success = gameManager.setSpyMode(roomCode, user.id, spyMode);
      if (!success) {
        res.status(400).json({ error: 'Cannot change game mode after game has started or unauthorized' });
        return;
      }
      break;
    }
    case 'SET_SPY_WORD':
      gameManager.setSpyWord(roomCode, user.id, payload?.spyWord || '');
      break;
    case 'SET_WORDS':
      gameManager.setSecretWord(roomCode, user.id, payload?.word || '', payload?.spyWord);
      break;
    case 'SET_WORD':
      gameManager.setSecretWord(roomCode, user.id, payload?.word || '', payload?.spyWord);
      break;
    case 'START_GAME': {
      const startRes = gameManager.startGame(roomCode, user.id);
      if (!startRes.success) {
        res.status(400).json({ error: startRes.error });
        return;
      }
      break;
    }
    case 'SELECT_HINT_PLAYER':
      if (room.activeHintTurnUserId) {
        const prevPlayer = room.players.find((p) => p.userId === room.activeHintTurnUserId);
        if (prevPlayer) {
          broadcastHintTyping(roomCode, prevPlayer.userId, prevPlayer.username, false);
        }
      }
      broadcastVoiceSessionEnded(roomCode);
      gameManager.selectPlayerForHint(roomCode, user.id, payload?.targetUserId ?? null);
      break;
    case 'MARK_HINT_SUBMITTED':
      if (payload?.targetUserId) {
        const targetP = room.players.find((p) => p.userId === payload.targetUserId);
        if (targetP) {
          broadcastHintTyping(roomCode, targetP.userId, targetP.username, false);
        }
      }
      broadcastVoiceSessionEnded(roomCode);
      gameManager.markHintSubmitted(roomCode, user.id, payload?.targetUserId);
      break;
    case 'SET_DISQUALIFICATION':
      gameManager.setPlayerDisqualification(
        roomCode,
        user.id,
        payload?.targetUserId,
        Boolean(payload?.disqualified)
      );
      break;
    case 'TRIGGER_PHASE':
      if (room.activeHintTurnUserId) {
        const prevPlayer = room.players.find((p) => p.userId === room.activeHintTurnUserId);
        if (prevPlayer) {
          broadcastHintTyping(roomCode, prevPlayer.userId, prevPlayer.username, false);
        }
      }
      broadcastVoiceSessionEnded(roomCode);
      gameManager.hostTriggerPhase(roomCode, user.id, payload?.phase);
      break;
    case 'TIMER_ADJUST':
      gameManager.adjustTimer(roomCode, user.id, payload?.timerAction);
      break;
    case 'CLOSE_VOTING':
      gameManager.hostCloseVoting(roomCode, user.id);
      break;
    case 'START_TIEBREAKER':
      gameManager.startTiebreaker(roomCode, user.id);
      break;
    default:
      res.status(400).json({ error: `Unknown host action: ${action}` });
      return;
  }

  res.json({ success: true });
});

// Submit Hint
app.post('/api/rooms/:code/submit-hint', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { content } = req.body;
  broadcastHintTyping(req.params.code, user.id, user.username, false);
  broadcastVoiceSessionEnded(req.params.code);
  const result = gameManager.submitHint(req.params.code, user.id, content);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

// Cast Vote
app.post('/api/rooms/:code/vote', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const { targetUserId } = req.body;
  const result = gameManager.castVote(req.params.code, user.id, targetUserId);
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ success: true });
});

// Red Light Signal
app.post('/api/rooms/:code/red-light', (req: Request, res: Response): void => {
  const user = getUserFromReq(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const code = req.params.code.toUpperCase();
  const room = gameManager.getRoom(code);
  if (!room || room.isClosed) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const player = room.players.find((p) => p.userId === user.id);
  if (!player || player.isDisqualified) {
    res.status(403).json({ error: 'Player disqualified or not in room' });
    return;
  }
  if (room.activeHintTurnUserId !== user.id) {
    res.status(403).json({ error: 'Hint box is not open for this user' });
    return;
  }

  broadcastRedLightFlash(code, user.id);
  res.json({ success: true });
});

// Vite dev server integration
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port} (mode: ${isProduction ? 'prod' : 'dev'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
