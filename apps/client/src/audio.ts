/**
 * Lightweight SFX layer.
 *
 * All sounds are synthesised on demand with Web Audio (no asset files
 * to download). Each `audio.play(kind)` call is a one-shot effect; we
 * never hold buffers, so the GC handles cleanup automatically.
 *
 * The browser autoplay policy means the AudioContext starts suspended.
 * Call `audio.unlock()` after any user gesture (click / keydown / tap)
 * to resume it — until that happens, play() is a no-op.
 */

export type SfxKind =
  | "attack"
  | "hit"
  | "crit"
  | "cast"
  | "nova"
  | "chain"
  | "meteor"
  | "teleport"
  | "levelup"
  | "death"
  | "pickup"
  | "heal"
  | "ui-click";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVolume = 0.4;
  private muted = false;

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      (window.AudioContext as typeof AudioContext | undefined) ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.masterVolume;
      master.connect(ctx.destination);
      this.master = master;
      return ctx;
    } catch {
      return null;
    }
  }

  setVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.masterVolume;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master)
      this.master.gain.value = m ? 0 : this.masterVolume;
  }

  isMuted() {
    return this.muted;
  }

  /** Resume audio context after a user gesture. Safe to call repeatedly. */
  async unlock(): Promise<void> {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* ignore — some browsers reject silently */
      }
    }
  }

  /** Play a one-shot SFX. Synthesises and forgets — no preloading. */
  play(kind: SfxKind) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.muted) return;
    if (ctx.state !== "running") return;
    const t = ctx.currentTime;
    try {
      switch (kind) {
        case "attack":   this.swoosh(ctx, t); break;
        case "hit":      this.thud(ctx, t, 140, 0.22, 80); break;
        case "crit":     this.crit(ctx, t); break;
        case "cast":     this.risingTone(ctx, t, 260, 760, 0.18, "sine"); break;
        case "nova":     this.frostBoom(ctx, t); break;
        case "chain":    this.electric(ctx, t); break;
        case "meteor":   this.meteor(ctx, t); break;
        case "teleport": this.teleport(ctx, t); break;
        case "levelup":  this.fanfare(ctx, t); break;
        case "death":    this.descending(ctx, t); break;
        case "pickup":   this.pickup(ctx, t); break;
        case "heal":     this.heal(ctx, t); break;
        case "ui-click": this.click(ctx, t); break;
      }
    } catch {
      /* Don't ever let a sound crash the game */
    }
  }

  /* ── Synthesis primitives ────────────────────────────────────────── */

  private envelope(
    ctx: AudioContext,
    src: AudioNode,
    t0: number,
    peak: number,
    attack: number,
    release: number
  ): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
    src.connect(g);
    g.connect(this.master!);
    return g;
  }

  private noiseBuffer(ctx: AudioContext, ms: number): AudioBuffer {
    const len = Math.max(1, Math.floor(ctx.sampleRate * (ms / 1000)));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private tone(
    ctx: AudioContext,
    t0: number,
    freq: number,
    type: OscillatorType,
    peak: number,
    attack: number,
    release: number,
    sweepTo?: number
  ) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweepTo !== undefined) {
      o.frequency.exponentialRampToValueAtTime(
        Math.max(1, sweepTo),
        t0 + attack + release
      );
    }
    this.envelope(ctx, o, t0, peak, attack, release);
    o.start(t0);
    o.stop(t0 + attack + release + 0.02);
  }

  /* ── Per-effect synthesis ────────────────────────────────────────── */

  private swoosh(ctx: AudioContext, t: number) {
    const ms = 90;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, ms);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(400, t + ms / 1000);
    src.connect(f);
    this.envelope(ctx, f, t, 0.35, 0.005, ms / 1000);
    src.start(t);
    src.stop(t + ms / 1000 + 0.02);
  }

  private thud(
    ctx: AudioContext,
    t: number,
    freq: number,
    peak: number,
    ms: number
  ) {
    // Sub bump
    this.tone(ctx, t, freq, "triangle", peak, 0.003, ms / 1000, freq * 0.4);
    // Crackle layer
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, ms);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    noise.connect(lp);
    this.envelope(ctx, lp, t, peak * 0.55, 0.003, (ms / 1000) * 0.7);
    noise.start(t);
    noise.stop(t + ms / 1000 + 0.02);
  }

  private crit(ctx: AudioContext, t: number) {
    this.thud(ctx, t, 220, 0.32, 110);
    this.tone(ctx, t + 0.015, 880, "square", 0.18, 0.005, 0.09, 440);
  }

  private risingTone(
    ctx: AudioContext,
    t: number,
    fromHz: number,
    toHz: number,
    peak: number,
    type: OscillatorType
  ) {
    this.tone(ctx, t, fromHz, type, peak, 0.01, 0.16, toHz);
  }

  private frostBoom(ctx: AudioContext, t: number) {
    // White-ish noise with a hard low-pass sweep down for the icy "whump"
    const ms = 280;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, ms);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + ms / 1000);
    src.connect(lp);
    this.envelope(ctx, lp, t, 0.45, 0.005, ms / 1000);
    src.start(t);
    src.stop(t + ms / 1000 + 0.02);
    // Sub thump
    this.tone(ctx, t, 90, "sine", 0.4, 0.005, 0.18, 50);
  }

  private electric(ctx: AudioContext, t: number) {
    // Bandpassed noise — quick chirp at high frequency that dives
    const ms = 220;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, ms);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(2400, t);
    bp.Q.value = 6;
    bp.frequency.exponentialRampToValueAtTime(900, t + ms / 1000);
    src.connect(bp);
    this.envelope(ctx, bp, t, 0.55, 0.005, ms / 1000);
    src.start(t);
    src.stop(t + ms / 1000 + 0.02);
    // Square layer for the "crackle"
    this.tone(ctx, t, 1800, "square", 0.18, 0.005, 0.08, 1200);
  }

  private meteor(ctx: AudioContext, t: number) {
    // Slow descending whoosh then a heavy thump
    const ms = 420;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, ms);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + ms / 1000);
    src.connect(lp);
    this.envelope(ctx, lp, t, 0.4, 0.05, ms / 1000);
    src.start(t);
    src.stop(t + ms / 1000 + 0.02);
    this.thud(ctx, t + ms / 1000 - 0.05, 60, 0.55, 220);
  }

  private teleport(ctx: AudioContext, t: number) {
    // Two short bursts: in (down sweep) + out (up sweep)
    this.tone(ctx, t, 880, "sine", 0.22, 0.005, 0.08, 220);
    this.tone(ctx, t + 0.07, 220, "sine", 0.22, 0.005, 0.1, 1100);
  }

  private fanfare(ctx: AudioContext, t: number) {
    // C E G — major triad arpeggio
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) =>
      this.tone(ctx, t + i * 0.09, f, "triangle", 0.32, 0.01, 0.32)
    );
    // Bright bell on top
    this.tone(ctx, t + 0.27, 1046.5, "sine", 0.25, 0.005, 0.5);
  }

  private descending(ctx: AudioContext, t: number) {
    this.tone(ctx, t, 320, "sawtooth", 0.35, 0.01, 0.55, 80);
    this.tone(ctx, t, 220, "sine", 0.3, 0.02, 0.6, 60);
  }

  private pickup(ctx: AudioContext, t: number) {
    // Coin-ish two-note chirp
    this.tone(ctx, t, 880, "square", 0.22, 0.003, 0.07);
    this.tone(ctx, t + 0.06, 1318.5, "square", 0.22, 0.003, 0.1);
  }

  private heal(ctx: AudioContext, t: number) {
    // Soft chime
    this.tone(ctx, t, 660, "sine", 0.32, 0.005, 0.45);
    this.tone(ctx, t, 990, "sine", 0.18, 0.005, 0.5);
  }

  private click(ctx: AudioContext, t: number) {
    this.tone(ctx, t, 1100, "square", 0.18, 0.003, 0.05);
  }
}

export const audio = new AudioManager();
