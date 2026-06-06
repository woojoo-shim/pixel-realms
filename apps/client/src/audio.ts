/**
 * Synthesised SFX.
 *
 * Design goals (post-cleanup):
 *  - No noise-heavy "whoosh / crunch" textures; everything is tonal so
 *    rapid hits don't pile up into mush.
 *  - Pentatonic / major-triad pitch palette → never sours when many
 *    sounds overlap.
 *  - Combo-aware: attack + hit accept an opt-in `combo` step (1-3) and
 *    pitch the note up the C-major triad (C5 / E5 / G5). Step 3 gets a
 *    bright "bell" shimmer on top so the finisher is unambiguous.
 *  - Tight envelopes (50-200 ms) — sounds end before the next one
 *    starts, so the chain reads as rhythm, not chaos.
 *
 * Autoplay policy:
 *   AudioContext begins suspended. `audio.unlock()` must be called from
 *   a user gesture (first pointerdown / keydown). Until then play() is
 *   a silent no-op, so calls are always safe.
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

export interface PlayOpts {
  /** Melee combo step (1-3). Steps progress C5 → E5 → G5. */
  combo?: 1 | 2 | 3;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterVolume = 0.35;
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
    if (this.master) this.master.gain.value = m ? 0 : this.masterVolume;
  }

  isMuted() {
    return this.muted;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* some browsers reject silently */
      }
    }
  }

  /** Play a one-shot SFX. Synthesises and forgets — no preloading. */
  play(kind: SfxKind, opts?: PlayOpts) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    if (this.muted) return;
    if (ctx.state !== "running") return;
    const t = ctx.currentTime;
    try {
      switch (kind) {
        case "attack":   this.attack(ctx, t, opts?.combo ?? 1); break;
        case "hit":      this.hit(ctx, t, opts?.combo ?? 1); break;
        case "crit":     this.crit(ctx, t); break;
        case "cast":     this.cast(ctx, t); break;
        case "nova":     this.nova(ctx, t); break;
        case "chain":    this.chain(ctx, t); break;
        case "meteor":   this.meteor(ctx, t); break;
        case "teleport": this.teleport(ctx, t); break;
        case "levelup":  this.levelup(ctx, t); break;
        case "death":    this.death(ctx, t); break;
        case "pickup":   this.pickup(ctx, t); break;
        case "heal":     this.heal(ctx, t); break;
        case "ui-click": this.click(ctx, t); break;
      }
    } catch {
      /* never let SFX crash the game */
    }
  }

  /* ── Primitives ──────────────────────────────────────────────────── */

  /** Play a single clean note with an AD envelope. */
  private note(
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
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
    o.connect(g);
    g.connect(this.master!);
    o.start(t0);
    o.stop(t0 + attack + release + 0.02);
  }

  /* ── Effects ─────────────────────────────────────────────────────── */

  /** Melee attack — short pluck. Pitch climbs through C5/E5/G5. */
  private attack(ctx: AudioContext, t: number, combo: 1 | 2 | 3) {
    // Major triad: C5 ≈ 523.25, E5 ≈ 659.25, G5 ≈ 783.99
    const f = combo === 1 ? 523.25 : combo === 2 ? 659.25 : 783.99;
    const peak = combo === 3 ? 0.28 : 0.22;
    // Soft triangle pluck with a quick downward sweep — feels physical
    // without resorting to noise.
    this.note(ctx, t, f, "triangle", peak, 0.004, 0.07, f * 0.75);
    // Tiny breath of higher sine on top — adds an airy "swish".
    this.note(ctx, t, f * 2.5, "sine", 0.08, 0.005, 0.06, f * 1.8);
    if (combo === 3) {
      // Finisher: bright bell shimmer that lifts the third note above
      // the other two without colliding with the same fundamental.
      this.note(ctx, t + 0.02, f * 3, "sine", 0.18, 0.004, 0.22);
    }
  }

  /** Melee hit landing on a target. Same triad pitch as the swing. */
  private hit(ctx: AudioContext, t: number, combo: 1 | 2 | 3) {
    const f = combo === 1 ? 523.25 : combo === 2 ? 659.25 : 783.99;
    const peak = combo === 3 ? 0.34 : 0.26;
    // Triangle sub for body
    this.note(ctx, t, f, "triangle", peak, 0.002, 0.11, f * 0.6);
    // Sine harmonic for the "ping" of impact
    this.note(ctx, t, f * 2, "sine", peak * 0.55, 0.002, 0.09);
    if (combo === 3) {
      // Finisher chime — a stacked perfect-fifth bell that resolves up.
      this.note(ctx, t + 0.01, f * 2, "sine", 0.22, 0.005, 0.32);
      this.note(ctx, t + 0.01, f * 3, "sine", 0.14, 0.005, 0.4);
    }
  }

  /** Critical hit — bright bell stack, fifth + octave + sparkle. */
  private crit(ctx: AudioContext, t: number) {
    // Bright stacked bell — pure sines, no noise.
    this.note(ctx, t, 880, "sine", 0.3, 0.003, 0.22);
    this.note(ctx, t, 1318.5, "sine", 0.2, 0.003, 0.28);
    this.note(ctx, t + 0.015, 1760, "sine", 0.15, 0.003, 0.18);
  }

  /** Fire Bolt cast — quick pitched pluck. */
  private cast(ctx: AudioContext, t: number) {
    // Clean rising sine, no noise. Major-second leap for a "spell" feel.
    this.note(ctx, t, 587.33, "sine", 0.22, 0.008, 0.18, 880);
    this.note(ctx, t, 1175, "sine", 0.1, 0.008, 0.16, 1760);
  }

  /** Frost Nova — single soft sub-bell descending. */
  private nova(ctx: AudioContext, t: number) {
    // No noise sweep — a cool descending bell stack.
    this.note(ctx, t, 660, "sine", 0.3, 0.006, 0.3, 220);
    this.note(ctx, t, 990, "sine", 0.15, 0.006, 0.32, 330);
  }

  /** Chain Lightning — quick 3-note arpeggio (like sparks jumping). */
  private chain(ctx: AudioContext, t: number) {
    const notes = [880, 1174.7, 1568]; // A5, D6, G6 (perfect-fourth ladder)
    notes.forEach((f, i) =>
      this.note(ctx, t + i * 0.04, f, "sine", 0.22, 0.003, 0.12)
    );
  }

  /** Meteor — slow descending bell into a low bloom. */
  private meteor(ctx: AudioContext, t: number) {
    // Long descending bell — anticipation
    this.note(ctx, t, 880, "sine", 0.22, 0.04, 0.45, 220);
    // Soft sub when it lands
    this.note(ctx, t + 0.42, 110, "sine", 0.35, 0.02, 0.4, 60);
  }

  /** Teleport — clean two-note "blink in / blink out". */
  private teleport(ctx: AudioContext, t: number) {
    this.note(ctx, t, 988, "sine", 0.22, 0.003, 0.1, 1568);
    this.note(ctx, t + 0.06, 1568, "sine", 0.22, 0.003, 0.12, 660);
  }

  /** Level up — C E G C major chord arpeggio + bell crown. */
  private levelup(ctx: AudioContext, t: number) {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) =>
      this.note(ctx, t + i * 0.085, f, "triangle", 0.3, 0.008, 0.34)
    );
    this.note(ctx, t + 0.34, 1568, "sine", 0.2, 0.005, 0.55);
  }

  /** Death — clean minor descending bell. */
  private death(ctx: AudioContext, t: number) {
    this.note(ctx, t, 392, "triangle", 0.3, 0.01, 0.55, 130);
    this.note(ctx, t, 261.63, "sine", 0.18, 0.01, 0.6, 110);
  }

  /** Pickup — coin chirp, two crisp square notes. */
  private pickup(ctx: AudioContext, t: number) {
    this.note(ctx, t, 988, "triangle", 0.22, 0.003, 0.08);
    this.note(ctx, t + 0.06, 1318.5, "triangle", 0.22, 0.003, 0.12);
  }

  /** Heal — gentle bell. */
  private heal(ctx: AudioContext, t: number) {
    this.note(ctx, t, 659.25, "sine", 0.3, 0.006, 0.4);
    this.note(ctx, t, 988, "sine", 0.16, 0.006, 0.45);
    this.note(ctx, t + 0.05, 1318.5, "sine", 0.1, 0.006, 0.4);
  }

  /** UI click — quick polite blip. */
  private click(ctx: AudioContext, t: number) {
    this.note(ctx, t, 1320, "sine", 0.15, 0.002, 0.05);
  }
}

export const audio = new AudioManager();
