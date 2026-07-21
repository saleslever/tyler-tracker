import { useEffect, useState } from "react";
import { playSound, haptic } from "@/hooks/useSound";
import { rankForXP, RANKS, type Rank } from "@/lib/xp";
import { RankShield } from "./RankShield";
import { Fleuron } from "./Ornament";
import { Confetti } from "./Confetti";

/**
 * RankUpCeremony — full-screen brass-fanfare ceremony when a new rank is reached.
 *
 * Listens for the `rank-up` window event dispatched from `XPBar` whenever the
 * player's current rank exceeds the last-seen rank in-session. We fire once per
 * rank per session (module-level Set).
 *
 * The overlay is dismissable by tap. Auto-dismiss after 6s just in case.
 */

const seenThisSession = new Set<string>();

export function RankUpCeremony() {
  const [rank, setRank] = useState<Rank | null>(null);
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    function onRankUp(e: Event) {
      const detail = (e as CustomEvent).detail;
      const key: string = detail?.rankKey;
      if (!key || seenThisSession.has(key)) return;
      const target = RANKS.find((r) => r.key === key);
      if (!target) return;
      seenThisSession.add(key);
      setRank(target);
      setConfettiKey((k) => k + 1);
      playSound("rankUp");
      haptic("heavy");
    }
    window.addEventListener("rank-up", onRankUp);
    return () => window.removeEventListener("rank-up", onRankUp);
  }, []);

  useEffect(() => {
    if (!rank) return;
    const t = setTimeout(() => setRank(null), 8000);
    return () => clearTimeout(t);
  }, [rank]);

  if (!rank) return null;
  return (
    <>
      <Confetti trigger={confettiKey} />
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
        onClick={() => setRank(null)}
        role="button"
        tabIndex={0}
        data-testid="rank-up-overlay"
        style={{
          background: `radial-gradient(circle at 50% 45%, ${rank.bgColor} 0%, #0b0908 60%, black 100%)`,
        }}
      >
        <div className="relative flex flex-col items-center gap-6 text-center px-8 max-w-[720px] rank-up-in">
          <div
            className="text-[11px] tracking-[0.5em] uppercase"
            style={{ color: rank.color, fontFamily: "'Inter', sans-serif" }}
          >
            — Rank Attained —
          </div>
          <RankShield rank={rank} size={220} glow />
          <div
            className="serif-hero uppercase leading-none"
            style={{
              fontSize: "clamp(56px, 10vw, 130px)",
              color: rank.color,
              letterSpacing: "0.05em",
              textShadow: `0 0 80px ${rank.color}80`,
            }}
          >
            {rank.name}
          </div>
          <div
            className="serif uppercase tracking-[0.35em]"
            style={{ color: `${rank.color}dd`, fontSize: "clamp(14px, 1.8vw, 20px)" }}
          >
            Tier {rank.numeral}
          </div>
          <Fleuron size={36} />
          <div
            className="serif italic"
            style={{ color: "hsl(38 20% 88%)", fontSize: "clamp(15px, 2vw, 22px)", maxWidth: 520 }}
          >
            "{rank.motto}"
          </div>
          <div className="mt-4 microlabel opacity-70" style={{ letterSpacing: "0.4em" }}>
            tap to continue
          </div>
        </div>
        <style>{`
          @keyframes rank-up-in {
            0%   { opacity: 0; transform: scale(0.86); filter: blur(8px); }
            60%  { opacity: 1; transform: scale(1.04); filter: blur(0); }
            100% { opacity: 1; transform: scale(1);    filter: blur(0); }
          }
          .rank-up-in { animation: rank-up-in 1200ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        `}</style>
      </div>
    </>
  );
}

/** Manual trigger — useful if you want to preview a rank-up. */
export function triggerRankUp(xp: number) {
  const rank = rankForXP(xp);
  window.dispatchEvent(new CustomEvent("rank-up", { detail: { rankKey: rank.key } }));
}
