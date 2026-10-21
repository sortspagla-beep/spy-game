import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';
import { useGame } from '../context/GameContext.js';
import { HorrorAudioButton } from './HorrorAudioButton.js';
import { ThemeToggle } from './ThemeToggle.js';
import { Sparkles, Gamepad2, AlertCircle, Loader2 } from 'lucide-react';

export function LoginView() {
  const { loginWithGoogle } = useGame();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Check for redirect result on mount if redirect auth occurred
  React.useEffect(() => {
    import('firebase/auth').then(({ getRedirectResult }) => {
      getRedirectResult(auth)
        .then(async (result) => {
          if (result?.user && result.user.email) {
            setIsSigningIn(true);
            const res = await loginWithGoogle({
              uid: result.user.uid,
              email: result.user.email,
              displayName: result.user.displayName,
              photoURL: result.user.photoURL,
            });
            if (!res.success) {
              setError('Unable to complete sign-in. Please try again.');
            }
          }
        })
        .catch(() => {
          setError('Unable to sign in. Please try again.');
        })
        .finally(() => {
          setIsSigningIn(false);
        });
    });
  }, [loginWithGoogle]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;

      if (!googleUser || !googleUser.email) {
        throw new Error('No user returned');
      }

      const res = await loginWithGoogle({
        uid: googleUser.uid,
        email: googleUser.email,
        displayName: googleUser.displayName,
        photoURL: googleUser.photoURL,
      });

      if (!res.success) {
        setError('Unable to complete sign-in. Please try again.');
      }
    } catch {
      setError('Unable to sign in with Google. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF2FF] dark:bg-[#0C1021] text-slate-900 dark:text-slate-100 flex flex-col justify-center items-center px-4 py-8 sm:py-12 relative overflow-hidden transition-colors duration-300">
      {/* Top Right Controls (Audio & Theme) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <HorrorAudioButton />
        <ThemeToggle />
      </div>

      {/* Playful background ambient glow */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 bg-rose-400/15 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-cyan-400/15 dark:bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-400/10 dark:bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-pop-in">
        {/* Cartoon Game Logo & Kicker */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 dark:bg-[#161B33] border-2 border-indigo-200 dark:border-indigo-800/80 rounded-full text-xs font-game font-bold text-indigo-600 dark:text-indigo-300 mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>Real-Time Multiplayer Party Game</span>
          </div>

          {/* Big Cartoon Game Title with Icon */}
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 via-amber-400 to-cyan-400 flex items-center justify-center text-white shadow-md border-2 border-white/60 dark:border-white/20 transform -rotate-6">
              <Gamepad2 className="w-7 h-7" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black font-game tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 drop-shadow-xs">
              SPY GAME
            </h1>
          </div>

          <p className="mt-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
            Find the secret impostor before the final vote!
          </p>
        </div>

        {/* Tactile Game Login Card */}
        <div className="bg-white dark:bg-[#151B33] border-2 border-indigo-100 dark:border-indigo-900/60 rounded-3xl p-6 sm:p-7 shadow-[0_12px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_16px_32px_rgba(0,0,0,0.4)] transition-colors duration-300 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs leading-relaxed animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center space-y-1">
            <h2 className="font-game font-black text-lg text-slate-900 dark:text-white uppercase tracking-wide">
              Sign In To Play
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Continue with Google to create or join multiplayer rooms
            </p>
          </div>

          {/* Official Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="w-full py-3.5 px-5 bg-white dark:bg-[#1E2540] hover:bg-slate-50 dark:hover:bg-[#252E4F] border-2 border-slate-300 dark:border-indigo-800/80 rounded-2xl font-game font-black text-sm text-slate-800 dark:text-white shadow-[0_4px_0_#CBD5E1] dark:shadow-[0_4px_0_#0F172A] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                <span>CONNECTING GOOGLE...</span>
              </>
            ) : (
              <>
                {/* Official Google G Logo SVG */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs font-mono text-slate-400 dark:text-slate-600">
          SPY GAME · Real-Time Multiplayer Edition
        </p>
      </div>
    </div>
  );
}
