/**
 * useAtlasThinkingSound — Spartan war-drum motif that plays while Atlas is thinking.
 *
 * Uses Web Audio API to synthesize a low, rhythmic drum loop with subtle horn drone.
 * No external assets. Auto-stops when `active` flips false.
 * Safe against browser autoplay policies: only starts inside a user gesture path
 * (submit button click), which is already how sendMutation begins.
 */
import { useEffect, useRef } from "react";

const BPM = 84; // slow, ceremonial
const BEAT_MS = 60_000 / BPM;

export function useAtlasThinkingSound(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const droneRef = useRef<{ osc: OscillatorNode; gain: GainNode; osc2: OscillatorNode } | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function ensureCtx(): AudioContext {
    if (!ctxRef.current) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current!.state === "suspended") ctxRef.current!.resume().catch(() => {});
    return ctxRef.current!;
  }

  function start() {
    const ctx = ensureCtx();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    masterRef.current = master;

    // Fade in gently
    const now = ctx.currentTime;
    master.gain.linearRampToValueAtTime(0.35, now + 0.6);

    // Low horn drone — two detuned sines an octave apart for weight
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 65.4; // C2
    const osc2 = ctx.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 98; // G2 fifth — heroic interval
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.12;
    // slow LFO for shimmer
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    osc.connect(droneGain);
    osc2.connect(droneGain);
    droneGain.connect(master);
    osc.start();
    osc2.start();
    lfo.start();
    droneRef.current = { osc, gain: droneGain, osc2 };

    // Drum pattern: BOOM . boom BOOM . . boom . (8-step, kick + occasional accent)
    // 1 = accent kick, 2 = soft kick, 0 = rest
    const pattern = [1, 0, 2, 1, 0, 0, 2, 0];
    stepRef.current = 0;
    const stepMs = BEAT_MS / 2; // eighth notes

    const tick = () => {
      const idx = stepRef.current % pattern.length;
      const hit = pattern[idx];
      if (hit === 1) kick(ctx, master, 1.0);
      else if (hit === 2) kick(ctx, master, 0.55);
      stepRef.current++;
      timerRef.current = window.setTimeout(tick, stepMs);
    };
    tick();
  }

  function stop() {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (ctx && master) {
      const now = ctx.currentTime;
      try {
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0, now + 0.35);
      } catch { /* ignore */ }
      window.setTimeout(() => {
        try { droneRef.current?.osc.stop(); } catch { /* ignore */ }
        try { droneRef.current?.osc2.stop(); } catch { /* ignore */ }
        try { master.disconnect(); } catch { /* ignore */ }
        droneRef.current = null;
        masterRef.current = null;
      }, 400);
    }
  }
}

/** Deep war-drum kick — pitch sweep + noise crack for impact. */
function kick(ctx: AudioContext, out: AudioNode, velocity: number) {
  const t = ctx.currentTime;
  // Body: sine pitch sweep from 120Hz -> 45Hz
  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(120, t);
  body.frequency.exponentialRampToValueAtTime(45, t + 0.18);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0, t);
  bodyGain.gain.linearRampToValueAtTime(0.9 * velocity, t + 0.005);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  body.connect(bodyGain).connect(out);
  body.start(t);
  body.stop(t + 0.4);

  // Noise attack crack for that leather-drum snap
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 800;
  noiseFilter.Q.value = 0.7;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25 * velocity, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(noiseFilter).connect(noiseGain).connect(out);
  noise.start(t);
  noise.stop(t + 0.1);
}
