// ============================================================================
// KARTVERSE — Master Audio Synthesizer & Sound FX Engine
// 100% self-contained Web Audio API engine
// ============================================================================

export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Engine synthesizer
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning = false;

  // Music state
  private musicOscs: OscillatorNode[] = [];
  private isMusicPlaying = false;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.startBackgroundMusic();
    } catch (e) {
      console.warn('AudioContext failed:', e);
    }
  }

  public setVolumes(master: number, music: number, sfx: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(master, now, 0.05);
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(music, now, 0.05);
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(sfx, now, 0.05);
  }

  // --------------------------------------------------------------------------
  // DYNAMIC RACING MUSIC SYNTHESIZER
  // --------------------------------------------------------------------------
  public startBackgroundMusic(): void {
    if (!this.ctx || !this.musicGain || this.isMusicPlaying) return;
    this.isMusicPlaying = true;

    // Upbeat energetic arcade chords (F - C - Dm - Bb progression)
    const baseFreqs = [174.61, 261.63, 293.66, 233.08];

    baseFreqs.forEach((freq, i) => {
      if (!this.ctx || !this.musicGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450 + i * 150, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start();

      this.musicOscs.push(osc);
    });
  }

  // --------------------------------------------------------------------------
  // KART ENGINE RPM AUDIO
  // --------------------------------------------------------------------------
  public startKartEngine(): void {
    if (!this.ctx || !this.sfxGain || this.isEngineRunning) return;
    this.isEngineRunning = true;
    const now = this.ctx.currentTime;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';

    this.engineOsc1.frequency.setValueAtTime(55, now); // ~900 RPM idle
    this.engineOsc2.frequency.setValueAtTime(27.5, now);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(320, now);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.24, now);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
  }

  public updateKartEngine(speedRatio: number, throttle: number): void {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter) return;
    const now = this.ctx.currentTime;

    // Pitch rises with speed and throttle
    const rpmPitch = 55 + speedRatio * 180 + (throttle > 0 ? 35 : 0);
    this.engineOsc1.frequency.setTargetAtTime(rpmPitch, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(rpmPitch * 0.5, now, 0.05);

    const cutoff = 300 + speedRatio * 900 + (throttle > 0 ? 400 : 0);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.05);
  }

  public stopKartEngine(): void {
    if (!this.isEngineRunning) return;
    this.isEngineRunning = false;
    this.engineOsc1?.stop();
    this.engineOsc2?.stop();
    this.engineOsc1?.disconnect();
    this.engineOsc2?.disconnect();
    this.engineOsc1 = null;
    this.engineOsc2 = null;
  }

  // --------------------------------------------------------------------------
  // ARCADE SFX: COUNTDOWN, DRIFT, NITRO, ITEMS
  // --------------------------------------------------------------------------
  public playCountdownBeep(isGo = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = isGo ? 880 : 440; // High A5 for GO!, A4 for 3, 2, 1
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.6 : 0.25));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isGo ? 0.65 : 0.3));
  }

  public playDriftSparks(tier: number): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const freq = tier === 1 ? 523.25 : tier === 2 ? 659.25 : 783.99; // C5, E5, G5
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playBoost(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playItemBoxPickup(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.18, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.15);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.18);
    });
  }

  public playCollision(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // --- Convenience Audio Helpers ---
  public playMenuClick(): void {
    this.playCountdownBeep(true);
  }

  public playItemCollect(): void {
    this.playItemBoxPickup();
  }

  public playCountdown(val: number): void {
    this.playCountdownBeep(val === 0);
  }

  public playCheckpoint(): void {
    this.playCountdownBeep(false);
  }

  public playSpinout(): void {
    this.playCollision();
  }

  public setEngineSpeed(speed: number, maxSpeed: number): void {
    if (!this.isEngineRunning) {
      this.startKartEngine();
    }
    const ratio = Math.min(1.0, Math.max(0, speed / (maxSpeed || 35.0)));
    this.updateKartEngine(ratio, speed > 1 ? 1 : 0);
  }

  public stopEngine(): void {
    this.stopKartEngine();
  }

  public setMasterVolume(val: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.05);
    }
  }
}

export const audio = AudioManager.getInstance();
