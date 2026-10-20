import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext.js';
import { GameProvider, useGame } from './context/GameContext.js';
import { HorrorMusicProvider, useHorrorMusic } from './context/HorrorMusicContext.js';
import { Navbar } from './components/Navbar.js';
import { LoginView } from './components/LoginView.js';
import { GlobalChatHome } from './components/GlobalChatHome.js';
import { JoinRoomModal } from './components/JoinRoomModal.js';
import { CreateRoomModal } from './components/CreateRoomModal.js';
import { HostDashboardModal } from './components/HostDashboardModal.js';
import { ProfileCompletionModal } from './components/ProfileCompletionModal.js';
import { RoomLobbyView } from './components/RoomLobbyView.js';
import { RoundHintsView } from './components/RoundHintsView.js';
import { RoundDiscussionView } from './components/RoundDiscussionView.js';
import { VotingView } from './components/VotingView.js';
import { TieResultView } from './components/TieResultView.js';
import { WinnerResultView } from './components/WinnerResultView.js';
import { UserProfileModal } from './components/UserProfileModal.js';
import { UserSearchModal } from './components/UserSearchModal.js';
import { FriendsModal } from './components/FriendsModal.js';
import { Gamepad2, Sparkles } from 'lucide-react';

function MainApp() {
  const {
    user,
    isLoading,
    room,
    showProfileCompletion,
    setShowProfileCompletion,
    viewedProfileIdentifier,
    setViewedProfileIdentifier,
    isFriendsModalOpen,
    setIsFriendsModalOpen,
    isSearchModalOpen,
    setIsSearchModalOpen,
    openUserProfile,
  } = useGame();
  const { autoGameAdapt, setMood } = useHorrorMusic();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHostDashboardOpen, setIsHostDashboardOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Auto-adapt horror theme music tension to the game phase
  useEffect(() => {
    if (!autoGameAdapt) return;
    if (!room) {
      setMood('dread');
      return;
    }

    switch (room.phase) {
      case 'VOTING':
      case 'TIE_RESULT':
        setMood('terror'); // Full terror during voting / accusation
        break;
      case 'ROUND_1_DISCUSSION':
      case 'ROUND_2_DISCUSSION':
      case 'ROUND_3_DISCUSSION':
        setMood('suspense'); // Heartbeat paranoia during interrogation
        break;
      case 'ROUND_1_HINTS':
      case 'ROUND_2_HINTS':
      case 'ROUND_3_HINTS':
        setMood('dread');
        break;
      case 'LOBBY':
      case 'RESULTS':
      default:
        setMood('dread');
        break;
    }
  }, [room?.phase, autoGameAdapt, setMood]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#EEF2FF] dark:bg-[#0C1021] flex flex-col items-center justify-center text-slate-600 dark:text-slate-300 gap-4 transition-colors duration-300">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500 via-amber-400 to-cyan-400 p-0.5 shadow-xl animate-bounce-subtle">
          <div className="w-full h-full bg-white dark:bg-[#151B33] rounded-[22px] flex items-center justify-center text-rose-500">
            <Gamepad2 className="w-8 h-8 animate-pulse text-rose-500" />
          </div>
        </div>
        <div className="flex items-center gap-2 font-game font-black text-sm tracking-widest uppercase text-slate-700 dark:text-slate-200">
          <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400 animate-spin" />
          <span>CONNECTING TO SPY GAME LOBBY...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderRoomContent = () => {
    if (!room) return null;

    switch (room.phase) {
      case 'LOBBY':
        return <RoomLobbyView />;
      case 'ROUND_1_HINTS':
        return <RoundHintsView roundNumber={1} />;
      case 'ROUND_1_DISCUSSION':
        return <RoundDiscussionView roundNumber={1} />;
      case 'ROUND_2_HINTS':
        return <RoundHintsView roundNumber={2} />;
      case 'ROUND_2_DISCUSSION':
        return <RoundDiscussionView roundNumber={2} />;
      case 'ROUND_3_HINTS':
        return <RoundHintsView roundNumber={3} />;
      case 'ROUND_3_DISCUSSION':
        return <RoundDiscussionView roundNumber={3} />;
      case 'VOTING':
        return <VotingView />;
      case 'TIE_RESULT':
        return <TieResultView />;
      case 'RESULTS':
        return <WinnerResultView />;
      default:
        return <RoomLobbyView />;
    }
  };

  const isProfileRequired = !user.isProfileCompleted || showProfileCompletion;

  return (
    <div className="min-h-screen bg-[#EEF2FF] dark:bg-[#0C1021] text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-rose-500/30 selection:text-white transition-colors duration-300">
      <Navbar
        onOpenHostDashboard={() => setIsHostDashboardOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      <main className="flex-1">
        {!room ? (
          <GlobalChatHome
            onOpenJoinModal={() => setIsJoinModalOpen(true)}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onOpenHostDashboard={() => setIsHostDashboardOpen(true)}
          />
        ) : (
          renderRoomContent()
        )}
      </main>

      {/* Profile Completion or Edit Modal */}
      <ProfileCompletionModal
        isOpen={isProfileRequired || isProfileModalOpen}
        canCancel={Boolean(user.isProfileCompleted)}
        onClose={() => {
          setIsProfileModalOpen(false);
          setShowProfileCompletion(false);
        }}
      />

      {/* Global Modals */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <HostDashboardModal
        isOpen={isHostDashboardOpen}
        onClose={() => setIsHostDashboardOpen(false)}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        identifier={viewedProfileIdentifier}
        onClose={() => setViewedProfileIdentifier(null)}
        onOpenEditProfile={() => setIsProfileModalOpen(true)}
      />

      {/* User Search Modal */}
      <UserSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectUser={(identifier) => {
          setIsSearchModalOpen(false);
          openUserProfile(identifier);
        }}
      />

      {/* Friends & Requests Modal */}
      <FriendsModal
        isOpen={isFriendsModalOpen}
        onClose={() => setIsFriendsModalOpen(false)}
        onSelectUser={(identifier) => {
          setIsFriendsModalOpen(false);
          openUserProfile(identifier);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HorrorMusicProvider>
        <GameProvider>
          <MainApp />
        </GameProvider>
      </HorrorMusicProvider>
    </ThemeProvider>
  );
}
