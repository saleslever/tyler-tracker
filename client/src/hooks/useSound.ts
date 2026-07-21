import { useCallback, useEffect, useMemo, useRef } from "react";
import checkSfx from "@assets/habit_check.mp3";
import perfectSfx from "@assets/day_perfect.mp3";

/**
 * Sound helper for the app.
 *
 * Two categories:
 *   1. mp3 assets  — checkSfx, perfectSfx (bundled files)
 *   2. Web Audio synthesized chimes — gong, sparkle, awaken, shield
 *      (procedural so we don't need to ship more assets; sounds cleaner too)
 *
 * A pool of Audio elements prevents rapid clicks from cutting each other off.
 */

type SoundKey =
  | "check"
  | "perfect"
  | "gong"       // streak milestone (7, 14, 21, 30)
  | "sparkle"    // gratitude complete
  | "awaken"     // the morning-alignment cold-open ceremony
  | "shield"     // cheat day used
  | "flourish";  // Code section read

const MP3_SOURCES: Partial<Record<SoundKey, string>> = {
  check: checkSfx,
  perfect: perfectSfx,
};

// Module-level mute flag — swapped in-memory (sandbox blocks localStorage).
let muted = false;
const listeners = new Set<() => void>();
export function setMuted(v: boolean) {
  muted = v;
  listeners.forEach((l) => l());
}
export function isMuted() {
  return muted;
}

export function useMuteState(): [boolean, (v: boolean) => void] {
  const forceRender = useRef(0);
  const [, set] = useMemo(() => {
    let value = { current: muted };
    const setter = (fn: any) => {
      value.current = typeof fn === "function" ? fn(value.current) : fn;
    };
    return [value, setter];
  }, []);
  useEffect(() => {
    const cb = () => {
      forceRender.current += 1;
      set((v: number) => v + 1);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [set]);
  return [muted, setMuted];
}

/* ============ mp3 pool ============ */
const POOL_SIZE = 4;
const pools: Partial<Record<SoundKey, HTMLAudioElement[]>> = {};
const nextIdx: Partial<Record<SoundKey, number>> = {};

function ensurePool(key: SoundKey) {
  if (pools[key]) return pools[key]!;
  const src = MP3_SOURCES[key];
  if (!src) return [];
  const arr: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const a = new Audio(src);
    a.preload = "auto";
    a.volume = 0.55;
    arr.push(a);
  }
  pools[key] = arr;
  nextIdx[key] = 0;
  return arr;
}

/* ============ Web Audio synthesized chimes ============ */
let audioCtx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
  }
  return audioCtx;
}

/**
 * Play a bell-like tone: fundamental + overtones with exponential decay.
 * Adds a subtle random detune per invocation so consecutive plays feel organic.
 */
function playTone(opts: {
  freq: number;
  duration: number;      // seconds
  overtones?: number[];  // multipliers relative to fundamental
  gain?: number;         // peak gain 0..1
  attack?: number;       // seconds
  wave?: OscillatorType;
  detune?: number;       // cents randomization
}) {
  const ctx = getCtx();
  if (!ctx) return;
  const {
    freq,
    duration,
    overtones = [1, 2, 3],
    gain = 0.18,
    attack = 0.01,
    wave = "sine",
    detune = 4,
  } = opts;
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(gain, now + attack);
  master.gain.exponentialRampToValueAtTime(0.001, now + duration);
  master.connect(ctx.destination);

  overtones.forEach((mult, i) => {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq * mult;
    osc.detune.value = (Math.random() - 0.5) * detune * 2;
    const overtoneGain = ctx.createGain();
    // higher overtones quieter, decay faster
    overtoneGain.gain.value = 1 / (i + 1) / overtones.length;
    osc.connect(overtoneGain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  });
}

/** GONG — deep, resonant, for streak milestones. Two-tone with reverb-ish tail. */
function playGong() {
  playTone({ freq: 130, duration: 2.4, overtones: [1, 2, 2.76, 5.4], gain: 0.32, wave: "sine" });
  setTimeout(() => playTone({ freq: 195, duration: 2.0, overtones: [1, 2, 3], gain: 0.14 }), 60);
}

/** SPARKLE — bright rising arpeggio for gratitude / small wins. */
function playSparkle() {
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
  notes.forEach((f, i) => {
    setTimeout(() => playTone({
      freq: f,
      duration: 0.55,
      overtones: [1, 2, 4],
      gain: 0.12,
      wave: "triangle",
      attack: 0.005,
    }), i * 70);
  });
}

/** AWAKEN — ceremonial pad + rising fifth. Cinematic. ~2.5s. */
function playAwaken() {
  // Sustained low drone
  playTone({ freq: 110, duration: 3.0, overtones: [1, 1.5, 2], gain: 0.18, attack: 0.4, wave: "sine" });
  // Rising fifth after 500ms
  setTimeout(() => {
    playTone({ freq: 220, duration: 2.2, overtones: [1, 2, 3], gain: 0.14, attack: 0.2, wave: "sine" });
  }, 500);
  // Bright top note bell
  setTimeout(() => {
    playTone({ freq: 880, duration: 1.6, overtones: [1, 2, 3], gain: 0.10, attack: 0.05, wave: "sine" });
  }, 1400);
}

/** SHIELD — protective, medium-low, single decay. */
function playShield() {
  playTone({ freq: 293.66, duration: 0.9, overtones: [1, 2, 3], gain: 0.20, wave: "sine" });
  setTimeout(() => playTone({ freq: 440, duration: 0.6, overtones: [1, 2], gain: 0.10 }), 90);
}

/** FLOURISH — short victory chord for finishing Code section. */
function playFlourish() {
  playTone({ freq: 392, duration: 1.2, overtones: [1, 1.25, 1.5, 2], gain: 0.18, wave: "sine" });
}

/* ============ public API ============ */
export function playSound(key: SoundKey) {
  if (muted) return;
  try {
    // MP3-backed sounds
    if (MP3_SOURCES[key]) {
      const pool = ensurePool(key);
      const idx = nextIdx[key]!;
      nextIdx[key] = (idx + 1) % POOL_SIZE;
      const a = pool[idx];
      a.currentTime = 0;
      a.volume = key === "perfect" ? 0.7 : 0.5;
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
      return;
    }
    // Synthesized sounds
    switch (key) {
      case "gong": playGong(); return;
      case "sparkle": playSparkle(); return;
      case "awaken": playAwaken(); return;
      case "shield": playShield(); return;
      case "flourish": playFlourish(); return;
    }
  } catch {
    // No-op — never let audio break the UI.
  }
}

export function usePlaySound() {
  return useCallback((key: SoundKey) => playSound(key), []);
}
