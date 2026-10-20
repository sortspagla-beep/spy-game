import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  AlertCircle,
  PhoneOff,
  CheckCircle,
  Send,
  Loader2,
  Headphones,
} from 'lucide-react';
import { useGame } from '../context/GameContext.js';
import { WebRTCSignalData } from '../types.js';

interface VoiceHintSessionProps {
  roundNumber: number;
}

// Fallback STUN configuration
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
];

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/webrtc/config');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return data.iceServers;
      }
    }
  } catch (e) {
    console.warn('[WebRTC] Could not fetch server ICE config, using fallback STUN', e);
  }
  return DEFAULT_ICE_SERVERS;
}

export function VoiceHintSession({ roundNumber }: VoiceHintSessionProps) {
  const {
    room,
    user,
    submitHint,
    voiceSpeakerStatus,
    sendVoiceSignal,
    sendVoiceSpeakingStatus,
    onVoiceSignal,
    onVoiceSessionEnded,
  } = useGame();

  if (!room || room.gameMode !== 'VOICE' || !room.activeHintTurnUserId) {
    return null;
  }

  const isSpeaker = room.activeHintTurnUserId === user?.id;
  const speakerPlayer = room.players.find((p) => p.userId === room.activeHintTurnUserId);

  return (
    <div className="w-full">
      {isSpeaker ? (
        <SpeakerVoiceStudio roundNumber={roundNumber} />
      ) : (
        <ListenerVoiceReceiver speakerPlayer={speakerPlayer} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------------
// SPEAKER COMPONENT: Selected player publishes live microphone audio to peers
// ----------------------------------------------------------------------------------
function SpeakerVoiceStudio({ roundNumber }: { roundNumber: number }) {
  const {
    room,
    user,
    submitHint,
    sendVoiceSignal,
    sendVoiceSpeakingStatus,
    onVoiceSignal,
    onVoiceSessionEnded,
    flashingRedLights,
    triggerRedLightSignal,
  } = useGame();

  type MicState = 'idle' | 'requesting' | 'connected' | 'muted' | 'denied' | 'error';
  const [micState, setMicState] = useState<MicState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hintSummaryInput, setHintSummaryInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // References
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isSpeakingBroadcastingRef = useRef<boolean>(false);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  // Load ICE servers on mount
  useEffect(() => {
    fetchIceServers().then((servers) => {
      iceServersRef.current = servers;
    });
  }, []);

  // Teardown local media and peer connections
  const cleanupVoice = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    peerConnectionsRef.current.forEach((pc) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    if (isSpeakingBroadcastingRef.current) {
      isSpeakingBroadcastingRef.current = false;
      sendVoiceSpeakingStatus(false);
    }
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      cleanupVoice();
    };
  }, []);

  // Listen for session ended broadcast (e.g. host closed hint box)
  useEffect(() => {
    const unsub = onVoiceSessionEnded(() => {
      cleanupVoice();
      setMicState('idle');
    });
    return unsub;
  }, [onVoiceSessionEnded]);

  // Handle incoming signaling messages from listeners (answers & ICE candidates)
  useEffect(() => {
    const unsub = onVoiceSignal(async (senderUserId, signal) => {
      const pc = peerConnectionsRef.current.get(senderUserId);
      if (!pc) return;

      try {
        if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process queued ICE candidates
          const queued = pendingCandidatesRef.current.get(senderUserId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current.delete(senderUserId);
        } else if (signal.type === 'ice-candidate') {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            const list = pendingCandidatesRef.current.get(senderUserId) || [];
            list.push(signal.candidate);
            pendingCandidatesRef.current.set(senderUserId, list);
          }
        }
      } catch (err) {
        console.warn(`[WebRTC Speaker] Error handling signal from ${senderUserId}:`, err);
      }
    });

    return unsub;
  }, [onVoiceSignal]);

  // Request microphone permission on user action
  const handleStartSpeaking = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicState('error');
      setErrorMessage('Microphone access is not supported by your browser.');
      return;
    }

    setMicState('requesting');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      setMicState('connected');

      // Setup Web Audio Analyser for volume indicator
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let silentCounter = 0;

        const updateAudioMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

          // Check if actively speaking
          const isLoud = avg > 12;
          if (isLoud) {
            silentCounter = 0;
            if (!isSpeakingBroadcastingRef.current) {
              isSpeakingBroadcastingRef.current = true;
              sendVoiceSpeakingStatus(true);
            }
          } else {
            silentCounter++;
            if (silentCounter > 30 && isSpeakingBroadcastingRef.current) {
              isSpeakingBroadcastingRef.current = false;
              sendVoiceSpeakingStatus(false);
            }
          }

          animFrameRef.current = requestAnimationFrame(updateAudioMeter);
        };
        updateAudioMeter();
      } catch (audioErr) {
        console.warn('[WebRTC] Web Audio Analyser could not be initialized:', audioErr);
      }

      // Establish peer connections to every other player and the host
      const peersToConnect: string[] = [];
      if (room) {
        room.players.forEach((p) => {
          if (p.userId !== user?.id) peersToConnect.push(p.userId);
        });
        if (room.hostId !== user?.id && !peersToConnect.includes(room.hostId)) {
          peersToConnect.push(room.hostId);
        }
        if (room.secondHostId && room.secondHostId !== user?.id && !peersToConnect.includes(room.secondHostId)) {
          peersToConnect.push(room.secondHostId);
        }
      }

      for (const peerId of peersToConnect) {
        await createPeerConnectionForListener(peerId, stream);
      }
    } catch (err: any) {
      console.error('[WebRTC] Failed to get microphone permission:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicState('denied');
        setErrorMessage(
          'Microphone permission was denied. Please allow microphone access in your browser settings to speak your clue live.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicState('error');
        setErrorMessage('No microphone device found on this system.');
      } else {
        setMicState('error');
        setErrorMessage(err.message || 'Could not access microphone.');
      }
    }
  };

  const createPeerConnectionForListener = async (peerId: string, stream: MediaStream) => {
    // Clean up existing peer connection if any
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) {
      existing.close();
      peerConnectionsRef.current.delete(peerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });

    peerConnectionsRef.current.set(peerId, pc);

    // Add local audio tracks
    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendVoiceSignal(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peerConnectionsRef.current.delete(peerId);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendVoiceSignal(peerId, {
        type: 'offer',
        sdp: pc.localDescription!,
      });
    } catch (err) {
      console.warn(`[WebRTC] Failed to create offer for peer ${peerId}:`, err);
    }
  };

  const handleToggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const nextMuted = audioTrack.enabled; // if enabled, we are about to mute
      audioTrack.enabled = !nextMuted;
      setMicState(nextMuted ? 'muted' : 'connected');
      if (nextMuted) {
        sendVoiceSpeakingStatus(false);
      }
    }
  };

  const handleStopSpeaking = () => {
    cleanupVoice();
    setMicState('idle');
  };

  const handleSubmitHintAfterVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const text = hintSummaryInput.trim() || '🎙️ Live Voice Clue Delivered';
    cleanupVoice();
    const result = await submitHint(text);
    setIsSubmitting(false);
    if (!result.success) {
      alert(result.error || 'Failed to submit clue');
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-[#1E2545] dark:via-[#161B33] dark:to-[#151B33] border-4 border-amber-400 dark:border-amber-500 rounded-3xl shadow-xl transition-colors duration-300 space-y-5 animate-pop-in">
      {/* Title & Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
          <h2 className="text-base sm:text-lg font-black font-game text-amber-800 dark:text-amber-300 uppercase tracking-wide">
            LIVE VOICE CLUE STUDIO · YOUR TURN TO SPEAK!
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/90 dark:bg-[#0E1326]/90 rounded-full border border-amber-300 dark:border-amber-700 shadow-xs">
            <span className="text-xs font-game font-bold text-slate-800 dark:text-slate-200">
              {user?.username}
            </span>
            <button
              type="button"
              onClick={triggerRedLightSignal}
              title="Tap your red light to signal"
              className="inline-flex items-center justify-center p-0.5 rounded-full cursor-pointer hover:scale-125 active:scale-95 transition-all"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-100 ${
                  user && flashingRedLights.has(user.id)
                    ? 'bg-red-500 ring-4 ring-red-500/70 shadow-[0_0_12px_#ef4444,0_0_20px_#dc2626] scale-125 animate-pulse'
                    : 'bg-red-900/40 border border-red-500/50 dark:bg-red-950 dark:border-red-700/60'
                }`}
              />
            </button>
          </div>
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 rounded-full text-[11px] font-game font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
            <span>VOICE MODE ACTIVE</span>
          </span>
        </div>
      </div>

      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
        You have the floor! Tap the microphone button below to broadcast your clue live to everyone in the room. Speak
        clearly without giving away the secret word to the spy!
      </p>

      {/* Permission / Device Error Warning */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs font-medium animate-shake">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Microphone Interaction Box */}
      <div className="p-6 bg-white dark:bg-[#0E1326] border-2 border-amber-200 dark:border-indigo-950 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 shadow-inner">
        {micState === 'idle' && (
          <div className="space-y-4 text-center">
            <button
              type="button"
              onClick={handleStartSpeaking}
              className="group relative p-6 bg-gradient-to-br from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white rounded-full shadow-[0_10px_25px_rgba(244,63,94,0.4)] hover:shadow-[0_14px_30px_rgba(244,63,94,0.5)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Mic className="w-12 h-12 stroke-[2.5]" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
              </span>
            </button>
            <div>
              <h3 className="text-sm font-game font-black text-slate-800 dark:text-white uppercase tracking-wider">
                TAP TO START SPEAKING LIVE
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Microphone audio will stream directly to all players in this game room.
              </p>
            </div>
          </div>
        )}

        {micState === 'requesting' && (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <span className="text-xs font-game font-bold text-amber-700 dark:text-amber-300">
              Requesting microphone permission in browser...
            </span>
          </div>
        )}

        {(micState === 'connected' || micState === 'muted') && (
          <div className="w-full max-w-md space-y-5">
            {/* Live On-Air Banner with Pulsing Waves */}
            <div
              className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 ${
                micState === 'connected'
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 text-rose-800 dark:text-rose-200'
                  : 'bg-slate-100 dark:bg-[#151B33] border-slate-300 dark:border-indigo-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  {micState === 'connected' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                      micState === 'connected' ? 'bg-rose-500' : 'bg-slate-400'
                    }`}
                  ></span>
                </span>
                <div className="text-left">
                  <span className="font-game font-black text-xs sm:text-sm tracking-wider uppercase block">
                    {micState === 'connected' ? '🔴 ON AIR — SPEAKING LIVE' : 'MUTED — MICROPHONE PAUSED'}
                  </span>
                  <span className="text-[11px] font-medium opacity-80 block">
                    {micState === 'connected'
                      ? 'Everyone in the room can hear your voice'
                      : 'Audio transmission temporarily silenced'}
                  </span>
                </div>
              </div>

              {/* Volume Soundwave Visualizer Bars */}
              {micState === 'connected' && (
                <div className="flex items-end gap-1 h-6">
                  {[20, 50, 80, 40, 70, 90, 60, 30].map((baseline, i) => {
                    const heightPercent = Math.min(100, Math.max(15, (audioLevel / 100) * baseline + 10));
                    return (
                      <span
                        key={i}
                        className="w-1 bg-rose-500 rounded-full transition-all duration-75"
                        style={{ height: `${heightPercent}%` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audio Controls (Mute / Stop) */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleToggleMute}
                className={`py-2.5 px-5 font-game font-black text-xs tracking-wider rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 ${
                  micState === 'muted'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600'
                }`}
              >
                {micState === 'muted' ? (
                  <>
                    <Mic className="w-4 h-4 stroke-[2.5]" />
                    <span>UNMUTE MIC</span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-4 h-4 stroke-[2.5]" />
                    <span>MUTE MIC</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleStopSpeaking}
                className="py-2.5 px-4 btn-game-slate font-game font-bold text-xs tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4 text-rose-500" />
                <span>Stop Speaking</span>
              </button>
            </div>
          </div>
        )}

        {(micState === 'denied' || micState === 'error') && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={handleStartSpeaking}
              className="py-2.5 px-5 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl cursor-pointer"
            >
              Try Microphone Again
            </button>
          </div>
        )}
      </div>

      {/* Done Speaking / Optional Clue Log Note Form */}
      <form onSubmit={handleSubmitHintAfterVoice} className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <input
            type="text"
            value={hintSummaryInput}
            onChange={(e) => setHintSummaryInput(e.target.value)}
            placeholder="Optional short clue note for history log (e.g. 'It flies high in the sky')"
            className="flex-1 w-full px-4 py-3 bg-white dark:bg-[#0E1326] border-2 border-amber-300 dark:border-amber-700/80 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition-colors shadow-inner"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto py-3 px-6 btn-game-coral font-game font-black text-xs tracking-wider uppercase rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shrink-0"
          >
            <CheckCircle className="w-4 h-4 stroke-[2.5]" />
            <span>{isSubmitting ? 'DELIVERING...' : 'FINISH & SUBMIT CLUE'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Once you have spoken your clue, tap <strong>"FINISH & SUBMIT CLUE"</strong> to mark your turn complete.
        </p>
      </form>
    </div>
  );
}

// ----------------------------------------------------------------------------------
// LISTENER COMPONENT: Other players & host listen to the active player's live voice
// ----------------------------------------------------------------------------------
function ListenerVoiceReceiver({ speakerPlayer }: { speakerPlayer?: { userId: string; username: string } }) {
  const { room, user, voiceSpeakerStatus, onVoiceSignal, onVoiceSessionEnded, sendVoiceSignal } = useGame();

  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'idle'>('connecting');
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [hasReceivedAudioTrack, setHasReceivedAudioTrack] = useState(false);

  // References
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  useEffect(() => {
    fetchIceServers().then((servers) => {
      iceServersRef.current = servers;
    });
  }, []);

  const cleanupPeer = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingCandidatesRef.current = [];
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
    setConnectionState('idle');
    setHasReceivedAudioTrack(false);
  };

  useEffect(() => {
    return () => {
      cleanupPeer();
    };
  }, []);

  // On session ended
  useEffect(() => {
    const unsub = onVoiceSessionEnded(() => {
      cleanupPeer();
    });
    return unsub;
  }, [onVoiceSessionEnded]);

  // Clean up if activeHintTurnUserId changes
  useEffect(() => {
    cleanupPeer();
    setConnectionState('connecting');
  }, [room?.activeHintTurnUserId]);

  // Handle incoming offer or candidate from the speaker
  useEffect(() => {
    const unsub = onVoiceSignal(async (senderUserId, signal) => {
      if (senderUserId !== room?.activeHintTurnUserId) return;

      try {
        if (signal.type === 'offer') {
          cleanupPeer();
          setConnectionState('connecting');

          const pc = new RTCPeerConnection({
            iceServers: iceServersRef.current,
          });
          pcRef.current = pc;

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sendVoiceSignal(senderUserId, {
                type: 'ice-candidate',
                candidate: event.candidate.toJSON(),
              });
            }
          };

          pc.ontrack = (event) => {
            setHasReceivedAudioTrack(true);
            setConnectionState('connected');
            if (audioElementRef.current) {
              audioElementRef.current.srcObject = event.streams[0];
              audioElementRef.current.play().catch((playErr) => {
                console.warn('[WebRTC] Autoplay prevented by browser:', playErr);
                setIsAutoplayBlocked(true);
              });
            }
          };

          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
              setConnectionState('connected');
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
              setConnectionState('idle');
            }
          };

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process any queued ICE candidates
          for (const cand of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendVoiceSignal(senderUserId, {
            type: 'answer',
            sdp: pc.localDescription!,
          });
        } else if (signal.type === 'ice-candidate') {
          if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            pendingCandidatesRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.warn('[WebRTC Listener] Error handling signal from speaker:', err);
      }
    });

    return unsub;
  }, [onVoiceSignal, room?.activeHintTurnUserId, sendVoiceSignal]);

  const handleManualPlay = () => {
    if (audioElementRef.current) {
      audioElementRef.current
        .play()
        .then(() => {
          setIsAutoplayBlocked(false);
        })
        .catch((e) => console.error('Failed manual audio play:', e));
    }
  };

  const isSpeakingNow = voiceSpeakerStatus.isSpeaking && voiceSpeakerStatus.speakerUserId === room?.activeHintTurnUserId;

  return (
    <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-50 via-cyan-50/60 to-rose-50 dark:from-[#1A213D] dark:via-[#151B33] dark:to-[#1C1A35] border-2 border-amber-300 dark:border-amber-700/80 rounded-3xl shadow-lg space-y-4 animate-pop-in transition-colors duration-300">
      {/* Hidden Audio Element for Remote Stream */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-amber-200/80 dark:border-indigo-950">
        <div className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-cyan-500 animate-bounce-subtle" />
          <h3 className="text-xs sm:text-sm font-game font-black text-slate-900 dark:text-white uppercase tracking-wider">
            LIVE VOICE CLUE BROADCAST
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {connectionState === 'connected' ? (
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[10px] font-game font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE AUDIO CONNECTED</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[10px] font-game font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>WAITING FOR SPEAKER...</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white/80 dark:bg-[#0E1326]/80 rounded-2xl border border-amber-200 dark:border-indigo-950/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-400 font-game font-black text-lg text-white flex items-center justify-center shadow-md">
              {speakerPlayer?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            {isSpeakingNow && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-game font-black text-sm sm:text-base text-slate-900 dark:text-white">
                {speakerPlayer?.username || 'Selected Player'}
              </span>
              <span className="text-[10px] font-game font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                Active Speaker
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isSpeakingNow
                ? '🎙️ Speaking live over microphone now... Listen carefully!'
                : 'Turn active · Player is preparing or speaking clue...'}
            </p>
          </div>
        </div>

        {/* Live Soundwave or Autoplay Unlock Button */}
        <div className="flex items-center gap-3">
          {isAutoplayBlocked ? (
            <button
              type="button"
              onClick={handleManualPlay}
              className="py-2.5 px-4 btn-game-coral font-game font-black text-xs tracking-wider rounded-xl flex items-center gap-2 cursor-pointer shadow-md animate-bounce"
            >
              <Volume2 className="w-4 h-4 stroke-[2.5]" />
              <span>TAP TO HEAR LIVE VOICE</span>
            </button>
          ) : isSpeakingNow ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-600 dark:text-rose-400">
              <Volume2 className="w-4 h-4 animate-pulse shrink-0" />
              <div className="flex items-end gap-1 h-4">
                <span className="w-1 bg-rose-500 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce h-4" style={{ animationDelay: '150ms' }} />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce h-3" style={{ animationDelay: '300ms' }} />
                <span className="w-1 bg-rose-500 rounded-full animate-bounce h-4" style={{ animationDelay: '75ms' }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-slate-400 text-xs font-game">
              <Volume2 className="w-4 h-4" />
              <span>Ready for Audio</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
