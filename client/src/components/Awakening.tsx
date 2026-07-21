import { useEffect, useState } from "react";
import crestFull from "@assets/crest_full.png";
import { playSound } from "@/hooks/useSound";

/**
 * Awakening — full-screen cold-open ceremony shown once per day
 * when the user first opens the Morning Alignment page.
 *
 * We track "last awakening date" in module scope only (no localStorage
 * because the sandboxed iframe blocks it). This means the ceremony fires
 * once per session, which is exactly right for a morning ritual.
 *
 * Behavior:
 *   - Full-screen dark backdrop, crest fades in, single principle line fades in,
 *     a subtle "Tap to enter" prompt appears.
 *   - Deep awakening chime plays on first mount of the ceremony.
 *   - User taps anywhere (or Escape) to dismiss.
 *   - Dismissal fades to reveal the page beneath.
 */

let lastShownDate: string | null = null;

function todayLocalStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The rotating morning principle — deterministic per day so it's the
 *  same principle regardless of how many times you check. */
const PRINCIPLES = [
  "I am THE MAN.",
  "My word is IRON.",
  "I am the rock in the ocean of chaos.",
  "Today I earn my future.",
  "Discipline is freedom.",
  "I fight because it makes my son proud.",
  "One day at a time. Never look back.",
];

function principleForDate(dateStr: string): string {
  // Deterministic hash — same principle for a given day.
  let h = 0;
  for (const c of dateStr) h = (h * 31 + c.charCodeAt(0)) | 0;
  return PRINCIPLES[Math.abs(h) % PRINCIPLES.length];
}

export function Awakening() {
  const today = todayLocalStr();
  const [visible, setVisible] = useState<boolean>(lastShownDate !== today);
  const [phase, setPhase] = useState<"enter" | "settle" | "exit">("enter");

  useEffect(() => {
    if (!visible) return;
    lastShownDate = today;

    // Chime slightly after the first paint so backdrop is visible when it hits.
    const chimeT = setTimeout(() => playSound("awaken"), 250);
    // Move to "settle" phase (line + tap-to-enter appear)
    const settleT = setTimeout(() => setPhase("settle"), 900);

    // Keyboard escape
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        dismiss();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(chimeT);
      clearTimeout(settleT);
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, today]);

  function dismiss() {
    setPhase("exit");
    setTimeout(() => setVisible(false), 700);
  }

  if (!visible) return null;

  const principle = principleForDate(today);
  const enter = phase === "enter";
  const settled = phase === "settle";
  const exit = phase === "exit";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={dismiss}
      className={`
        fixed inset-0 z-[200] cursor-pointer
        flex items-center justify-center
        transition-opacity duration-700
        ${exit ? "opacity-0" : "opacity-100"}
      `}
      style={{
        background:
          "radial-gradient(1200px 800px at 50% 50%, hsl(38 30% 8%) 0%, hsl(30 20% 4%) 60%, black 100%)",
      }}
      data-testid="awakening-overlay"
    >
      {/* subtle vignette + noise */}
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 40%, black 100%)",
        }}
      />

      {/* Slow rotating gold rings behind the crest */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 720, height: 720,
          animation: "awaken-spin 40s linear infinite",
        }}
        aria-hidden="true"
      >
        <svg width="720" height="720" viewBox="0 0 720 720" fill="none">
          <circle cx="360" cy="360" r="340" stroke="hsl(38 60% 50% / 0.18)" strokeWidth="0.5" strokeDasharray="2 8" />
          <circle cx="360" cy="360" r="280" stroke="hsl(38 60% 50% / 0.14)" strokeWidth="0.5" />
          <circle cx="360" cy="360" r="220" stroke="hsl(38 60% 50% / 0.10)" strokeWidth="0.5" strokeDasharray="6 3" />
        </svg>
      </div>

      <div className="relative flex flex-col items-center gap-8 md:gap-10 text-center px-6 max-w-[720px]">
        <img
          src={crestFull}
          alt=""
          aria-hidden="true"
          className={`
            w-40 md:w-56 h-auto
            transition-all duration-[1200ms] ease-out
            ${enter ? "opacity-0 scale-90 blur-sm" : "opacity-95 scale-100 blur-0"}
          `}
          style={{
            filter: "drop-shadow(0 0 40px hsl(38 70% 50% / 0.35))",
          }}
        />

        <div
          className={`
            transition-all duration-1000 ease-out
            ${enter ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"}
          `}
        >
          <div
            className="text-[10px] md:text-xs tracking-[0.5em] uppercase mb-4"
            style={{ color: "hsl(38 40% 65%)", fontFamily: "'Inter', sans-serif" }}
          >
            — Morning Alignment —
          </div>
          <div
            className="serif-hero uppercase leading-[1.05]"
            style={{
              fontSize: "clamp(28px, 5vw, 52px)",
              color: "hsl(38 30% 92%)",
              letterSpacing: "0.02em",
              textShadow: "0 0 60px hsl(38 70% 40% / 0.35)",
            }}
          >
            {principle}
          </div>
        </div>

        <div
          className={`
            transition-opacity duration-1000
            ${settled ? "opacity-70" : "opacity-0"}
          `}
        >
          <div className="microlabel" style={{ letterSpacing: "0.4em" }}>
            tap anywhere to begin
          </div>
        </div>
      </div>

      <style>{`
        @keyframes awaken-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
