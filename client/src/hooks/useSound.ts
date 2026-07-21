import { useCallback, useEffect, useMemo, useRef } from "react";
import checkSfx from "@assets/habit_check.mp3";
import perfectSfx from "@assets/day_perfect.mp3";

/**
 * Tiny sound helper for the app. Assets are bundled and preloaded lazily on
 * first interaction (browsers block audio.play() until the user has clicked
 * something, so we defer construction to first playback attempt).
 *
 * We keep a small pool per sound so rapid successive clicks don't cut each
 * other off (e.g. checking off five habits in a row still chimes each time).
 */

type SoundKey = "check" | "perfect";

const SOURCES: Record<SoundKey, string> = {
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

/**
 * Preloaded pool of Audio elements so rapid clicks don't queue.
 * Web Audio would be more precise but Audio() is enough for a ~350ms chime.
 */
const POOL_SIZE = 4;
const pools: Partial<Record<SoundKey, HTMLAudioElement[]>> = {};
const nextIdx: Partial<Record<SoundKey, number>> = {};

function ensurePool(key: SoundKey) {
  if (pools[key]) return pools[key]!;
  const src = SOURCES[key];
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

export function playSound(key: SoundKey) {
  if (muted) return;
  try {
    const pool = ensurePool(key);
    const idx = nextIdx[key]!;
    nextIdx[key] = (idx + 1) % POOL_SIZE;
    const a = pool[idx];
    a.currentTime = 0;
    // volume differs by sound
    a.volume = key === "perfect" ? 0.7 : 0.5;
    const p = a.play();
    if (p && typeof p.catch === "function") {
      // Autoplay blocking, gesture required, etc — silently swallow.
      p.catch(() => {});
    }
  } catch {
    // No-op — never let audio break the UI.
  }
}

/**
 * Hook wrapper — memoized function reference.
 */
export function usePlaySound() {
  return useCallback((key: SoundKey) => playSound(key), []);
}
