/**
 * useAtlasThinkingSound — cinematic score that plays while Atlas is thinking.
 *
 * Uses a real orchestral cinematic MP3 (Scott Buckley "Goliath", CC-BY 4.0),
 * hosted on Scott's WordPress CDN. On first activation we lazy-load the audio
 * element; on subsequent activations we resume from the start with a fade-in.
 * When `active` flips false, we fade out and pause. When `active` is true but
 * the track finishes, it loops.
 *
 * Attribution requirement (CC-BY 4.0): the Atlas page shows a small credit line
 * next to the mute button. Do not remove that credit.
 *
 * Autoplay: only starts inside a user gesture chain (the send button click),
 * which is already how this hook is invoked.
 */
import { useEffect, useRef } from "react";

// CC-BY 4.0. Attribution: "Goliath" by Scott Buckley — https://www.scottbuckley.com.au
const TRACK_URL = "https://www.scottbuckley.com.au/library/wp-content/uploads/2021/08/sb_goliath.mp3";
const TARGET_VOLUME = 0.55;
const FADE_IN_MS = 900;
const FADE_OUT_MS = 700;

export function useAtlasThinkingSound(active: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) start();
    else stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function ensureAudio(): HTMLAudioElement {
    if (audioRef.current) return audioRef.current;
    const a = new Audio(TRACK_URL);
    a.loop = true;
    a.preload = "auto";
    a.crossOrigin = "anonymous"; // best-effort, some browsers ignore for <audio>
    a.volume = 0;
    audioRef.current = a;
    return a;
  }

  function clearFade() {
    if (fadeTimerRef.current != null) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }

  function fadeTo(target: number, durationMs: number, onDone?: () => void) {
    const a = audioRef.current;
    if (!a) return;
    clearFade();
    const start = a.volume;
    const startTs = performance.now();
    fadeTimerRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - startTs) / durationMs);
      a.volume = start + (target - start) * t;
      if (t >= 1) {
        clearFade();
        onDone?.();
      }
    }, 30);
  }

  function start() {
    const a = ensureAudio();
    // Restart from top for a fresh cinematic hit each time Atlas thinks.
    try { a.currentTime = 0; } catch { /* ignore */ }
    a.volume = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => { /* autoplay blocked; will retry on next user gesture */ });
    }
    fadeTo(TARGET_VOLUME, FADE_IN_MS);
  }

  function stop() {
    const a = audioRef.current;
    if (!a) return;
    fadeTo(0, FADE_OUT_MS, () => {
      try { a.pause(); } catch { /* ignore */ }
    });
  }
}
