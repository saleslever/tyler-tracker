import { useEffect, useState } from "react";
import { playSound } from "@/hooks/useSound";
import { Confetti } from "./Confetti";
import { Fleuron } from "./Ornament";

const MILESTONES: Record<number, { title: string; subtitle: string }> = {
  3:  { title: "III days", subtitle: "The foundation is laid." },
  7:  { title: "VII days", subtitle: "One week strong. The habit takes root." },
  14: { title: "XIV days", subtitle: "Two weeks. This is who you are now." },
  21: { title: "XXI days", subtitle: "Three weeks. The new man rises." },
  30: { title: "XXX days", subtitle: "One month. Undeniable." },
  60: { title: "LX days", subtitle: "Sixty days. Forged in fire." },
  100:{ title: "C days",   subtitle: "One hundred. Legendary." },
};

/**
 * Fires a full-screen milestone celebration whenever `streak` crosses one of
 * the celebrated numbers for the first time in this session.
 *
 * Persistence caveat: sandbox blocks localStorage, so "first time" is scoped
 * to the session. That's fine — the celebration should trigger once naturally
 * when a milestone lands, not on every page reload during the same day.
 */
const seenThisSession = new Set<number>();

export function MilestoneCelebration({ streak }: { streak: number }) {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    if (MILESTONES[streak] && !seenThisSession.has(streak)) {
      seenThisSession.add(streak);
      setMilestone(streak);
      setConfettiKey((k) => k + 1);
      playSound("gong");
    }
  }, [streak]);

  if (milestone === null) return null;
  const data = MILESTONES[milestone];
  return (
    <>
      <Confetti trigger={confettiKey} />
      <div
        className="fixed inset-0 z-[190] flex items-center justify-center cursor-pointer"
        onClick={() => setMilestone(null)}
        role="button"
        tabIndex={0}
        data-testid="milestone-overlay"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, hsl(38 60% 12%) 0%, hsl(30 30% 5%) 55%, black 100%)",
        }}
      >
        <div className="relative flex flex-col items-center gap-8 text-center px-8 max-w-[720px] awaken-in">
          <div
            className="text-xs tracking-[0.5em] uppercase"
            style={{ color: "hsl(38 60% 65%)", fontFamily: "'Inter', sans-serif" }}
          >
            — Milestone Achieved —
          </div>
          <div
            className="serif-hero uppercase leading-none"
            style={{
              fontSize: "clamp(64px, 12vw, 160px)",
              color: "hsl(38 75% 60%)",
              letterSpacing: "0.04em",
              textShadow: "0 0 80px hsl(38 80% 40% / 0.6)",
            }}
          >
            {data.title}
          </div>
          <Fleuron size={36} />
          <div
            className="serif uppercase"
            style={{
              fontSize: "clamp(16px, 2.4vw, 24px)",
              color: "hsl(38 20% 88%)",
              letterSpacing: "0.15em",
              maxWidth: 520,
            }}
          >
            {data.subtitle}
          </div>
          <div className="mt-6 microlabel opacity-70" style={{ letterSpacing: "0.4em" }}>
            tap to continue
          </div>
        </div>
        <style>{`
          @keyframes awaken-in {
            from { opacity: 0; transform: scale(0.94); filter: blur(6px); }
            to   { opacity: 1; transform: scale(1);    filter: blur(0);   }
          }
          .awaken-in { animation: awaken-in 900ms ease-out both; }
        `}</style>
      </div>
    </>
  );
}
