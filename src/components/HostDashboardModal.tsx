import React, { useEffect, useState } from 'react';
import {
  X,
  Shield,
  UserPlus,
  Trash2,
  Key,
  Users,
  AlertCircle,
  CheckCircle2,
  Crown,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Gamepad2,
} from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { ThemeToggle } from './ThemeToggle.js';
import { PlayerAvatarBadge } from './PlayerAvatarBadge.js';

interface HostDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StoredUserItem {
  id: string;
  username: string;
  role: 'HOST' | 'ADMIN' | 'PLAYER';
  createdAt: number;
}

export function HostDashboardModal({ isOpen, onClose }: HostDashboardModalProps) {
  const { token, user, clearGlobalChat, deleteUserAccount, updateUserRole } = useGame();
  const [usersList, setUsersList] = useState<StoredUserItem[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isConfirmingClearChat, setIsConfirmingClearChat] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; username: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/host/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setError(null);
      setSuccessMsg(null);
      setIsConfirmingClearChat(false);
      setUserToDelete(null);
    }
  }, [isOpen]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword) {
      setError('Both username and password are required.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/host/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
      } else {
        setSuccessMsg(`Player "${data.user.username}" account created successfully!`);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      }
    } catch {
      setError('Network error creating user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeClearChatHistory = async () => {
    setIsClearingChat(true);
    setError(null);
    setSuccessMsg(null);
    const ok = await clearGlobalChat();
    setIsClearingChat(false);
    setIsConfirmingClearChat(false);
    if (ok) {
      setSuccessMsg('Global chat history wiped and cleared across all devices successfully!');
    } else {
      setError('Failed to clear chat history.');
    }
  };

  const confirmExecuteDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setError(null);
    setSuccessMsg(null);
    const targetId = userToDelete.id;
    const targetName = userToDelete.username;
    const result = await deleteUserAccount(targetId);
    setIsDeletingUser(false);
    setUserToDelete(null);
    if (result.success) {
      setSuccessMsg(`Player account "${targetName}" deleted successfully.`);
      setUsersList((prev) => prev.filter((u) => u.id !== targetId));
    } else {
      setError(result.error || 'Failed to delete user account');
    }
  };

  const handleToggleHostRole = async (targetUser: StoredUserItem) => {
    const isCurrentlyHost = targetUser.role === 'HOST' || targetUser.role === 'ADMIN';
    const newRole = isCurrentlyHost ? 'PLAYER' : 'HOST';
    setUpdatingRoleId(targetUser.id);
    setError(null);
    setSuccessMsg(null);
    const res = await updateUserRole(targetUser.id, newRole);
    setUpdatingRoleId(null);
    if (res.success) {
      setSuccessMsg(
        newRole === 'HOST'
          ? `User "${targetUser.username}" is now granted 2nd Host / Host powers!`
          : `Host role revoked from "${targetUser.username}". User is now a standard Player.`
      );
      fetchUsers();
    } else {
      setError(res.error || 'Failed to update user role');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/85 backdrop-blur-md animate-pop-in transition-colors duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-[#151B33] border-3 border-amber-300 dark:border-amber-900/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-300">
        {/* Header */}
        <div className="px-6 py-4 bg-amber-50/70 dark:bg-[#10152B] border-b-2 border-amber-200 dark:border-indigo-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-game font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">
            <Crown className="w-5 h-5 text-amber-500 fill-amber-400" />
            <span>HOST & ADMIN DASHBOARD</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close Host Dashboard"
              title="Close"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Create User Section */}
          <div className="bg-slate-50 dark:bg-[#0E1326] border-2 border-indigo-100 dark:border-indigo-950 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-game font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
              <UserPlus className="w-4 h-4 text-emerald-500" />
              <span>Register New Player Account</span>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs font-medium animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-200 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-game font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Player Username
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter nickname"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#161B33] border-2 border-slate-200 dark:border-indigo-950 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-game font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Assigned Passcode
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter passcode"
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-[#161B33] border-2 border-slate-200 dark:border-indigo-950 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !newUsername.trim() || !newPassword}
                  className="py-2.5 px-5 btn-game-emerald font-game font-black text-xs tracking-wider rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  <span>{isSubmitting ? 'CREATING...' : 'CREATE ACCOUNT'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* User List Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-game font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Authorized Player Registry ({usersList.length})</span>
              </div>
              <span className="text-[11px] font-game font-bold text-slate-500">
                Encrypted Credentials
              </span>
            </div>

            <div className="border-2 border-slate-200 dark:border-indigo-950 rounded-2xl overflow-hidden divide-y divide-slate-200 dark:divide-indigo-950 bg-slate-50 dark:bg-[#0E1326]">
              {usersList.length === 0 ? (
                <div className="p-4 text-center text-xs font-game text-slate-400">
                  No accounts registered yet.
                </div>
              ) : (
                usersList.map((item) => {
                  const isMainAdminAccount = (item as any).email?.toLowerCase() === 'obyda.cmch@gmail.com';
                  const isPrimaryHost = isMainAdminAccount || item.username.toLowerCase() === 'nafiul';
                  const isSecondHostOrAdmin = !isPrimaryHost && (item.role === 'HOST' || item.role === 'ADMIN');
                  const isPlayer = !isPrimaryHost && !isSecondHostOrAdmin;
                  const isUpdatingThisUser = updatingRoleId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-white/50 dark:hover:bg-[#161B33]/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <PlayerAvatarBadge
                          username={item.username}
                          avatarId={(item as any).avatar}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-game font-bold text-slate-900 dark:text-white">
                              {item.username}
                            </span>
                            {isMainAdminAccount ? (
                              <span className="text-[10px] font-game font-bold text-amber-950 dark:text-amber-200 bg-amber-400 dark:bg-amber-900 border border-amber-500 dark:border-amber-700 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                <Crown className="w-3 h-3 text-amber-700 dark:text-amber-200 fill-current" />
                                MAIN ADMIN
                              </span>
                            ) : isPrimaryHost ? (
                              <span className="text-[10px] font-game font-bold text-amber-900 dark:text-amber-300 bg-amber-300 dark:bg-amber-950/60 border border-amber-400 dark:border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Crown className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                                PRIMARY HOST
                              </span>
                            ) : null}
                            {isSecondHostOrAdmin && (
                              <span className="text-[10px] font-game font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-2.5 h-2.5 text-purple-500" />
                                2ND HOST
                              </span>
                            )}
                            {isPlayer && (
                              <span className="text-[10px] font-game font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-full">
                                PLAYER
                              </span>
                            )}
                          </div>
                          {(item as any).email && (
                            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                              {(item as any).email}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isPrimaryHost && (
                          <>
                            {isPlayer ? (
                              <button
                                type="button"
                                disabled={isUpdatingThisUser}
                                onClick={() => handleToggleHostRole(item)}
                                className="px-2.5 py-1.5 btn-game-amber font-game font-bold text-[11px] tracking-wider rounded-xl shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                title={`Promote "${item.username}" to 2nd Host`}
                              >
                                <Shield className="w-3.5 h-3.5" />
                                <span>{isUpdatingThisUser ? 'PROMOTING...' : 'MAKE 2ND'}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isUpdatingThisUser}
                                onClick={() => handleToggleHostRole(item)}
                                className="px-2.5 py-1.5 btn-game-slate font-game font-bold text-[11px] rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                title={`Revoke host privileges from "${item.username}"`}
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                                <span>{isUpdatingThisUser ? 'REVOKING...' : 'REVOKE HOST'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setUserToDelete({ id: item.id, username: item.username })}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                              title={`Delete account "${item.username}"`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Global Chat Maintenance Section */}
          <div className="bg-rose-50/60 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-game font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span>Global Chat Moderation & Purge</span>
              </div>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Clear all messages from the global frequency database and wipe all message history immediately across all connected users and devices.
            </p>

            {isConfirmingClearChat ? (
              <div className="p-3.5 bg-rose-100/90 dark:bg-rose-950/90 border-2 border-rose-300 dark:border-rose-800 rounded-2xl space-y-3 animate-pop-in">
                <div className="flex items-center gap-2 text-xs font-game font-bold text-rose-800 dark:text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Confirm wipe of ALL global chat transmissions across all users?</span>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearChat(false)}
                    className="px-3.5 py-1.5 text-xs font-game font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isClearingChat}
                    onClick={executeClearChatHistory}
                    className="py-2 px-4 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isClearingChat ? 'CLEARING...' : 'YES, CLEAR CHAT NOW'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmingClearChat(true)}
                  className="py-2.5 px-4 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>CLEAR CHAT HISTORY NOW</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#10152B] border-t-2 border-indigo-100 dark:border-indigo-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-6 btn-game-slate font-game font-bold text-xs tracking-wider rounded-xl cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {userToDelete && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-pop-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setUserToDelete(null);
          }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#151B33] border-3 border-rose-300 dark:border-rose-900/80 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-game font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Delete Player Account?</span>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete player account{' '}
              <strong className="text-slate-900 dark:text-white font-bold">
                "{userToDelete.username}"
              </strong>
              ? Their session will be terminated immediately.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-3.5 py-2 btn-game-slate text-xs font-game font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={confirmExecuteDeleteUser}
                className="px-4 py-2 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingUser ? 'DELETING...' : 'YES, DELETE ACCOUNT'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
