// Web Audio API Procedural Dark Sci-Fi Ambient Music Engine
// Prompt: "Dark sci-fi ambient background music, mysterious and tense atmosphere,
// subtle low-frequency drone, faint spaceship engine hum, eerie minimalistic synth arpeggios,
// suspicious and paranoid vibe, looping instrumental, 80 BPM, clean production for web background music."

export type HorrorMood = 'dread' | 'suspense' | 'terror';

export interface HorrorMusicSettings {
  isMuted: boolean;
  volume: number;
  mood: HorrorMood;
  autoGameAdapt: boolean;
}

// 80 BPM Timing
// 1 beat = 750ms, 8th note = 375ms, 16th note = 187.5ms
const BPM = 80;
const BEAT_MS = (60 / BPM) * 1000; // 750ms
const SIXTEENTH_MS = BEAT_MS / 4;  // 187.5ms

class DarkSciFiAmbientEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  private isRunning: boolean = false;
  private currentVolume: number = 0.75;
  private isMuted: boolean = false;
  private currentMood: HorrorMood = 'dread';

  // Active audio node references for cleanup
  private engineHumNodes: {
    oscSub: OscillatorNode;
    oscBeat1: OscillatorNode;
    oscBeat2: OscillatorNode;
    noiseSource: AudioBufferSourceNode;
    noiseFilter: BiquadFilterNode;
    noiseGain: GainNode;
    masterDroneGain: GainNode;
  } | null = null;

  private atmosphericDroneNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    osc3: OscillatorNode;
    filter: BiquadFilterNode;
    filterLfo: OscillatorNode;
    filterLfoGain: GainNode;
    gain: GainNode;
  } | null = null;

  // Sequencer timers for 80 BPM loops
  private arpeggioTimer: any = null;
  private pulseTimer: any = null;
  private radarTimer: any = null;

  // Step indices
  private arpeggioStep: number = 0;
  private pulseStep: number = 0;

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

    // Set up master audio graph:
    // Audio Sources -> MasterGain -> Compressor -> Analyser -> Destination
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();

      // Studio-grade clean limiter & compressor
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, ctx.currentTime);
      this.compressor.knee.setValueAtTime(8, ctx.currentTime);
      this.compressor.ratio.setValueAtTime(3.5, ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.01, ctx.currentTime);
      this.compressor.release.setValueAtTime(0.25, ctx.currentTime);

      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.analyserNode.smoothingTimeConstant = 0.85;

      // Space echo delay bus for sci-fi atmosphere (dotted 8th note delay @ 80 BPM = 562.5ms)
      this.delayNode = ctx.createDelay();
      this.delayNode.delayTime.setValueAtTime((BEAT_MS * 0.75) / 1000, ctx.currentTime);
      this.delayFeedback = ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.28, ctx.currentTime);

      const delayDampFilter = ctx.createBiquadFilter();
      delayDampFilter.type = 'lowpass';
      delayDampFilter.frequency.setValueAtTime(1400, ctx.currentTime);

      this.delayNode.connect(delayDampFilter);
      delayDampFilter.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      this.delayNode.connect(this.masterGain);

      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyserNode);
      this.analyserNode.connect(ctx.destination);
    }

    const effectiveGain = this.isMuted ? 0 : this.currentVolume;
    const now = ctx.currentTime;
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.linearRampToValueAtTime(effectiveGain, now + 0.8);

    // Initialize all procedural dark sci-fi ambient layers
    this.startSpaceshipEngineHum();
    this.startSubtleLowFrequencyDrone();
    this.startEerieMinimalistSynthArpeggios();
    this.startSuspiciousPulseBass();
    this.startParanoidRadarPings();
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
    if (this.arpeggioTimer) clearInterval(this.arpeggioTimer);
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    if (this.radarTimer) clearTimeout(this.radarTimer);

    this.arpeggioTimer = null;
    this.pulseTimer = null;
    this.radarTimer = null;

    if (this.engineHumNodes) {
      try {
        this.engineHumNodes.oscSub.stop();
        this.engineHumNodes.oscBeat1.stop();
        this.engineHumNodes.oscBeat2.stop();
        this.engineHumNodes.noiseSource.stop();
        this.engineHumNodes.masterDroneGain.disconnect();
      } catch {}
      this.engineHumNodes = null;
    }

    if (this.atmosphericDroneNodes) {
      try {
        this.atmosphericDroneNodes.osc1.stop();
        this.atmosphericDroneNodes.osc2.stop();
        this.atmosphericDroneNodes.osc3.stop();
        this.atmosphericDroneNodes.filterLfo.stop();
        this.atmosphericDroneNodes.gain.disconnect();
      } catch {}
      this.atmosphericDroneNodes = null;
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
    if (this.arpeggioTimer) clearInterval(this.arpeggioTimer);
    if (this.pulseTimer) clearInterval(this.pulseTimer);
    this.startEerieMinimalistSynthArpeggios();
    this.startSuspiciousPulseBass();
  }

  // --- LAYER 1: FAINT SPACESHIP ENGINE HUM (SUBTLE, DEEP, LOW-FREQUENCY) ---
  private startSpaceshipEngineHum() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const masterDroneGain = ctx.createGain();
      masterDroneGain.gain.setValueAtTime(0.38, ctx.currentTime);

      // Deep sub-octave C1 (32.7 Hz) spaceship cabin resonance
      const oscSub = ctx.createOscillator();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(32.7, ctx.currentTime);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.42, ctx.currentTime);
      oscSub.connect(subGain);
      subGain.connect(masterDroneGain);

      // Binaural engine reactor beating: 42.0 Hz & 43.1 Hz (1.1 Hz slow throb)
      const oscBeat1 = ctx.createOscillator();
      const oscBeat2 = ctx.createOscillator();
      oscBeat1.type = 'triangle';
      oscBeat1.frequency.setValueAtTime(42.0, ctx.currentTime);
      oscBeat2.type = 'sine';
      oscBeat2.frequency.setValueAtTime(43.1, ctx.currentTime);

      const beatFilter = ctx.createBiquadFilter();
      beatFilter.type = 'lowpass';
      beatFilter.frequency.setValueAtTime(75, ctx.currentTime);
      beatFilter.Q.setValueAtTime(3.0, ctx.currentTime);

      const beatGain = ctx.createGain();
      beatGain.gain.setValueAtTime(0.35, ctx.currentTime);

      oscBeat1.connect(beatFilter);
      oscBeat2.connect(beatFilter);
      beatFilter.connect(beatGain);
      beatGain.connect(masterDroneGain);

      // Faint ventilation & reactor cooling air hiss (filtered low rumble)
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02; // Brown/pink noise
        lastOut = data[i];
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(110, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(4.0, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterDroneGain);

      masterDroneGain.connect(this.masterGain);

      oscSub.start();
      oscBeat1.start();
      oscBeat2.start();
      noiseSource.start();

      this.engineHumNodes = {
        oscSub,
        oscBeat1,
        oscBeat2,
        noiseSource,
        noiseFilter,
        noiseGain,
        masterDroneGain,
      };
    } catch (e) {
      console.warn('Spaceship engine hum initialization warning', e);
    }
  }

  // --- LAYER 2: SUBTLE LOW-FREQUENCY DRONE (DARK SCI-FI ATMOSPHERIC BED) ---
  private startSubtleLowFrequencyDrone() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      // Dark Sci-Fi harmonic triad: C2 (65.4 Hz), G2 (98.0 Hz), and Bb2 (116.5 Hz - ominous minor 7th)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const filterLfo = ctx.createOscillator();
      const filterLfoGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(65.41, ctx.currentTime); // C2

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(97.99, ctx.currentTime); // G2

      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(116.54, ctx.currentTime); // Bb2 (tense sci-fi tone)

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);
      filter.Q.setValueAtTime(2.5, ctx.currentTime);

      // Very slow 0.06 Hz mysterious atmospheric filter breath
      filterLfo.type = 'sine';
      filterLfo.frequency.setValueAtTime(0.06, ctx.currentTime);
      filterLfoGain.gain.setValueAtTime(70, ctx.currentTime);

      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filter.frequency);

      gain.gain.setValueAtTime(0.24, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc1.start();
      osc2.start();
      osc3.start();
      filterLfo.start();

      this.atmosphericDroneNodes = {
        osc1,
        osc2,
        osc3,
        filter,
        filterLfo,
        filterLfoGain,
        gain,
      };
    } catch (e) {
      console.warn('Atmospheric drone initialization warning', e);
    }
  }

  // --- LAYER 3: EERIE MINIMALISTIC SYNTH ARPEGGIOS (80 BPM, SUSPICIOUS & PARANOID VIBE) ---
  private startEerieMinimalistSynthArpeggios() {
    // 80 BPM minimal sci-fi sequence in C minor / Phrygian
    // Minimalist hypnotic notes: C4, Eb4, G4, Ab4 (Paranoid minor 6th), D4, F#4 (Alien tritone tension)
    // 16-step grid (16 * 187.5ms = 3000ms per 4-beat bar)
    const arpeggioNotes = [
      { note: 261.63, vel: 0.28 }, // 1: C4
      { note: 0,      vel: 0.00 }, // &
      { note: 311.13, vel: 0.22 }, // 2: Eb4
      { note: 0,      vel: 0.00 }, // &
      { note: 392.00, vel: 0.26 }, // 3: G4
      { note: 415.30, vel: 0.32 }, // & Ab4 (Suspicious & paranoid high tension note)
      { note: 392.00, vel: 0.20 }, // 4: G4
      { note: 0,      vel: 0.00 }, // &
      { note: 293.66, vel: 0.24 }, // 1: D4 (Suspenseful second)
      { note: 0,      vel: 0.00 }, // &
      { note: 311.13, vel: 0.20 }, // 2: Eb4
      { note: 369.99, vel: 0.30 }, // & F#4 (Eerie alien tritone)
      { note: 261.63, vel: 0.25 }, // 3: C4
      { note: 0,      vel: 0.00 }, // &
      { note: 246.94, vel: 0.22 }, // 4: B3 (Paranoid leading tone)
      { note: 0,      vel: 0.00 }, // &
    ];

    const playArpStep = () => {
      if (!this.isRunning) return;
      const step = this.arpeggioStep % arpeggioNotes.length;
      this.arpeggioStep++;

      const item = arpeggioNotes[step];
      if (item.note > 0) {
        // In dread (lobby/hints) mode, play every second active note for eerie minimalism
        const shouldPlay =
          this.currentMood !== 'dread' ||
          (step % 4 === 0 || step === 5 || step === 11);

        if (shouldPlay) {
          const velocityFactor =
            this.currentMood === 'terror' ? 1.25 : this.currentMood === 'suspense' ? 1.1 : 0.9;
          this.synthesizeMinimalistSynthPluck(item.note, item.vel * velocityFactor);
        }
      }
    };

    playArpStep();
    // Quantized precisely at 80 BPM 16th notes (187.5ms)
    this.arpeggioTimer = setInterval(playArpStep, SIXTEENTH_MS);
  }

  private synthesizeMinimalistSynthPluck(freq: number, velocity: number) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      // Dual oscillator analog synth architecture: Square + Triangle with gentle filter envelope
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 1.002, now); // Micro-detune for analog warmth

      // 24dB low-pass ladder filter envelope
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.16);
      filter.Q.setValueAtTime(4.2, now);

      // Clean, plucky minimal amplitude envelope
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(velocity, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      // Feed into space delay bus for expansive sci-fi space atmosphere
      if (this.delayNode) {
        const sendGain = ctx.createGain();
        sendGain.gain.setValueAtTime(0.35, now);
        gain.connect(sendGain);
        sendGain.connect(this.delayNode);
      }

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } catch {}
  }

  // --- LAYER 4: SUSPICIOUS PULSE BASS (TENSE, STEADY 80 BPM UNDERPULSE) ---
  private startSuspiciousPulseBass() {
    // 8th-note subtle rhythmic anchor (every 375ms at 80 BPM)
    const playPulse = () => {
      if (!this.isRunning) return;
      this.pulseStep++;

      // Pulse notes in C minor: C2 (65.41Hz), with occasional Eb2 (77.78Hz) and G1 (48.99Hz)
      const isDownbeat = this.pulseStep % 8 === 0;
      const isOffbeatTension = this.pulseStep % 8 === 6;

      const freq = isOffbeatTension ? 77.78 : isDownbeat ? 48.99 : 65.41;
      const isMutedVibe = this.currentMood === 'dread' && this.pulseStep % 2 !== 0;

      if (!isMutedVibe) {
        this.synthesizePulseSub(freq, isDownbeat ? 0.36 : 0.24);
      }
    };

    playPulse();
    this.pulseTimer = setInterval(playPulse, BEAT_MS / 2); // 375ms (8th note)
  }

  private synthesizePulseSub(freq: number, vol: number) {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      filter.frequency.exponentialRampToValueAtTime(65, now + 0.22);
      filter.Q.setValueAtTime(2.0, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.30);
    } catch {}
  }

  // --- LAYER 5: PARANOID RADAR PINGS (EERIE SCI-FI SENSOR SWEEPS) ---
  private startParanoidRadarPings() {
    const schedulePing = () => {
      if (!this.isRunning) return;
      this.synthesizeRadarPing();

      // Scheduled every 6 to 12 seconds
      const nextDelay = 7000 + Math.random() * 5000;
      this.radarTimer = setTimeout(schedulePing, nextDelay);
    };

    this.radarTimer = setTimeout(schedulePing, 4000);
  }

  private synthesizeRadarPing() {
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    try {
      const now = ctx.currentTime;
      // High eerie sci-fi ping (1760 Hz or 2093 Hz)
      const freq = Math.random() > 0.5 ? 1760 : 2093;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + 1.2);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, now);
      filter.Q.setValueAtTime(8.0, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      if (this.delayNode) {
        const sendGain = ctx.createGain();
        sendGain.gain.setValueAtTime(0.4, now);
        gain.connect(sendGain);
        sendGain.connect(this.delayNode);
      }

      osc.start(now);
      osc.stop(now + 1.9);
    } catch {}
  }
}

export const horrorMusic = new DarkSciFiAmbientEngine();
