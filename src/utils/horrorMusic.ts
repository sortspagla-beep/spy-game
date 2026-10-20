// Web Audio API Instrumental Horror Theme Music Engine (Hermetic, Zero-Vocal, Procedural)
// Mastered for cinematic loudness, deep bass rumble, tension heartbeats, and eerie horror bells

export type HorrorMood = 'dread' | 'suspense' | 'terror';

export interface HorrorMusicSettings {
  isMuted: boolean;
  volume: number;
  mood: HorrorMood;
  autoGameAdapt: boolean;
}

class HorrorMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private isRunning: boolean = false;
  private currentVolume: number = 0.8; // High default volume for clear loudness
  private isMuted: boolean = false;
  private currentMood: HorrorMood = 'dread';

  // Active audio node references for cleanup
  private droneNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    osc3: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
  } | null = null;

  private windNodes: {
    source: AudioBufferSourceNode;
    filter: BiquadFilterNode;
    gain: GainNode;
    lfo: OscillatorNode;
    lfoGain: GainNode;
  } | null = null;

  // Timers for musical loops
  private heartbeatTimer: any = null;
  private melodyTimer: any = null;
  private stringSwellTimer: any = null;
  private stingerTimer: any = null;

  // Melody state
  private melodyIndex: number = 0;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public isMusicPlaying(): boolean {
    return this.isRunning && !this.isMuted;
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public getMood(): HorrorMood {
    return this.currentMood;
  }

  public async start(mood?: HorrorMood) {
    if (mood) {
      this.currentMood = mood;
    }
    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        // Autoplay policy waiting for user interaction
      }
    }

    if (this.isRunning) {
      this.updateMoodParameters();
      return;
    }

    this.isRunning = true;

    // Set up master routing: Source -> MasterGain -> Compressor -> Analyser -> Destination
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();

      // Professional audio compressor / limiter for maximum loudness without clipping
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, ctx.currentTime);

      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.8;

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyserNode);
      this.analyserNode.connect(ctx.destination);
    }

    const effectiveGain = this.isMuted ? 0 : this.currentVolume;
    const now = ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0.01, now);
    this.masterGain.gain.linearRampToValueAtTime(effectiveGain, now + 0.8);

    // Initialize all procedural layers
    this.startSubDrone();
    this.startGhostWindTexture();
    this.startHeartbeatLoop();
    this.startHorrorMelodyLoop();
    this.startStringSwells();
    this.startRandomStingers();
  }

  public stop() {
    if (!this.isRunning) return;
    const ctx = this.getContext();
    if (ctx && this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.5);
      setTimeout(() => {
        this.cleanupNodes();
      }, 550);
    } else {
      this.cleanupNodes();
    }
    this.isRunning = false;
  }

  private cleanupNodes() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.melodyTimer) clearTimeout(this.melodyTimer);
    if (this.stringSwellTimer) clearTimeout(this.stringSwellTimer);
    if (this.stingerTimer) clearTimeout(this.stingerTimer);
    this.heartbeatTimer = null;
    this.melodyTimer = null;
    this.stringSwellTimer = null;
    this.stingerTimer = null;

    if (this.droneNodes) {
      try {
        this.droneNodes.osc1.stop();
        this.droneNodes.osc2.stop();
        this.droneNodes.osc3.stop();
        this.droneNodes.lfo.stop();
        this.droneNodes.gain.disconnect();
      } catch {}
      this.droneNodes = null;
    }

    if (this.windNodes) {
      try {
        this.windNodes.source.stop();
        this.windNodes.lfo.stop();
        this.windNodes.gain.disconnect();
      } catch {}
      this.windNodes = null;
    }
  }

  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1.2, vol));
    const ctx = this.getContext();
    if (ctx && this.masterGain && this.isRunning) {
      const targetGain = this.isMuted ? 0 : this.currentVolume;
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.08);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    const ctx = this.getContext();
    if (ctx && this.masterGain && this.isRunning) {
      const targetGain = this.isMuted ? 0 : this.currentVolume;
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(targetGain, now + 0.08);
    }
  }

  public setMood(mood: HorrorMood) {
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    if (this.isRunning) {
      this.updateMoodParameters();
    }
  }

  private updateMoodParameters() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.melodyTimer) clearTimeout(this.melodyTimer);
    this.startHeartbeatLoop();
    this.startHorrorMelodyLoop();
  }

  // --- LAYER 1: HEAVY OMINOUS SUB-BASS DRONE (LOUDER & DEEPER) ---
  private startSubDrone() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      // Deep pitch: D1 (36.7 Hz), detuned D1 (37.4 Hz), and low octave D2 (73.4 Hz)
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(36.7, ctx.currentTime);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(37.4, ctx.currentTime);

      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(73.4, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, ctx.currentTime);
      filter.Q.setValueAtTime(3.5, ctx.currentTime);

      // Slow dread filter breath
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.1, ctx.currentTime);
      lfoGain.gain.setValueAtTime(60, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Louder base gain: 0.55 (was 0.22)
      gain.gain.setValueAtTime(0.55, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start();
      osc2.start();
      osc3.start();
      lfo.start();

      this.droneNodes = { osc1, osc2, osc3, filter, gain, lfo, lfoGain };
    } catch (e) {
      console.warn('Sub drone initialization warning', e);
    }
  }

  // --- LAYER 2: GHOST WIND & RESONANT TEXTURE ---
  private startGhostWindTexture() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.2;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(520, ctx.currentTime);
      filter.Q.setValueAtTime(5.5, ctx.currentTime);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
      lfoGain.gain.setValueAtTime(380, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, ctx.currentTime); // Louder (was 0.08)

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      whiteNoise.start();
      lfo.start();

      this.windNodes = { source: whiteNoise, filter, gain, lfo, lfoGain };
    } catch (e) {
      console.warn('Ghost wind initialization warning', e);
    }
  }

  // --- LAYER 3: PROMINENT HEARTBEAT PULSE (LOUDER & THUMPING) ---
  private startHeartbeatLoop() {
    const getInterval = () => {
      switch (this.currentMood) {
        case 'terror': return 580;   // ~103 BPM fast terror
        case 'suspense': return 850; // ~70 BPM tense interrogation
        case 'dread':
        default: return 1200;        // ~50 BPM sinister dread
      }
    };

    const playPulse = () => {
      if (!this.isRunning) return;
      const ctx = this.getContext();
      if (!ctx || !this.masterGain) return;

      const now = ctx.currentTime;
      const isTerror = this.currentMood === 'terror';

      // Loud, impactful lub-dub (0.65 / 0.50 volume)
      this.synthesizeHeartbeatThud(ctx, now, isTerror ? 0.75 : 0.60, 68, 30);
      const secondDelay = isTerror ? 0.15 : 0.20;
      this.synthesizeHeartbeatThud(ctx, now + secondDelay, isTerror ? 0.60 : 0.48, 60, 26);
    };

    playPulse();
    this.heartbeatTimer = setInterval(playPulse, getInterval());
  }

  private synthesizeHeartbeatThud(ctx: AudioContext, time: number, volume: number, startFreq: number, endFreq: number) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.16);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(volume, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + 0.25);
    } catch {}
  }

  // --- LAYER 4: EERIE HORROR BELLS / CELESTA (LOUD, CRISP & CHILLING) ---
  private startHorrorMelodyLoop() {
    // Haunting horror theme motif: D4 -> Ab4 (Tritone) -> F4 -> A4 -> C#5 (Dissonance) -> Bb4 -> G#4 -> D4
    const horrorMelody = [
      { note: 293.66, dur: 0.75 }, // D4
      { note: 415.30, dur: 0.85 }, // G#4 (Tritone)
      { note: 349.23, dur: 0.75 }, // F4
      { note: 440.00, dur: 0.85 }, // A4
      { note: 554.37, dur: 1.05 }, // C#5 (Chilling dissonance)
      { note: 466.16, dur: 0.70 }, // Bb4
      { note: 415.30, dur: 0.80 }, // G#4
      { note: 293.66, dur: 1.30 }, // D4
      { note: 0, dur: 0.90 },      // Brief pause
      { note: 277.18, dur: 0.80 }, // C#4
      { note: 329.63, dur: 0.75 }, // E4
      { note: 415.30, dur: 1.10 }, // G#4
      { note: 0, dur: 1.10 },      // Tension gap
    ];

    const playNextNote = () => {
      if (!this.isRunning) return;
      const item = horrorMelody[this.melodyIndex];
      this.melodyIndex = (this.melodyIndex + 1) % horrorMelody.length;

      if (item.note > 0) {
        this.synthesizeHorrorBell(item.note);
      }

      const speedMultiplier = this.currentMood === 'terror' ? 0.72 : this.currentMood === 'suspense' ? 0.88 : 1.05;
      const nextDelay = (item.dur * 1000) * speedMultiplier;
      this.melodyTimer = setTimeout(playNextNote, nextDelay);
    };

    playNextNote();
  }

  private synthesizeHorrorBell(freq: number) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      // High-presence metallic chime partials (LOUD and clear)
      const partials = [
        { mult: 1.0, gain: 0.38, decay: 1.6 },
        { mult: 2.756, gain: 0.20, decay: 1.0 },
        { mult: 4.07, gain: 0.14, decay: 0.7 },
      ];

      partials.forEach((p) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * p.mult, now);
        osc.frequency.linearRampToValueAtTime(freq * p.mult * 0.995, now + p.decay);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(p.gain, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, now + p.decay);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now);
        osc.stop(now + p.decay + 0.08);
      });
    } catch {}
  }

  // --- LAYER 5: DISSONANT CINEMATIC HORROR STRING SWELLS (LOUD) ---
  private startStringSwells() {
    const scheduleSwell = () => {
      if (!this.isRunning) return;
      this.synthesizeStringSwell();
      const nextDelay = 10000 + Math.random() * 7000;
      this.stringSwellTimer = setTimeout(scheduleSwell, nextDelay);
    };

    this.stringSwellTimer = setTimeout(scheduleSwell, 3000);
  }

  private synthesizeStringSwell() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      // Dissonant tension cluster: D3, Eb3, G#3
      const freqs = [146.83, 155.56, 207.65];
      const swellDuration = 5.2;

      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(350, now);
        filter.frequency.linearRampToValueAtTime(750, now + 2.5);
        filter.frequency.linearRampToValueAtTime(300, now + swellDuration);
        filter.Q.setValueAtTime(3.0, now);

        // Louder swell gain: 0.22 (was 0.045)
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.22, now + 2.2);
        gain.gain.linearRampToValueAtTime(0.001, now + swellDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now);
        osc.stop(now + swellDuration + 0.1);
      });
    } catch {}
  }

  // --- LAYER 6: TENSION STINGERS ---
  private startRandomStingers() {
    const scheduleStinger = () => {
      if (!this.isRunning) return;
      if (this.currentMood === 'terror' || (this.currentMood === 'suspense' && Math.random() > 0.35)) {
        this.synthesizeStinger();
      }
      const interval = 14000 + Math.random() * 12000;
      this.stingerTimer = setTimeout(scheduleStinger, interval);
    };

    this.stingerTimer = setTimeout(scheduleStinger, 8000);
  }

  private synthesizeStinger() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1244.5, now);
      osc.frequency.exponentialRampToValueAtTime(830.6, now + 1.2);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(650, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 1.4);
    } catch {}
  }
}

export const horrorMusic = new HorrorMusicEngine();
