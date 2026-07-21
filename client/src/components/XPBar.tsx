import { useEffect, useRef, useState } from "react";
import { rankProgress } from "@/lib/xp";
import { cn } from "@/lib/utils";
import { playSound, haptic } from "@/hooks/useSound";

/**
 * XPBar — animated progress bar from current rank to next rank.
 *
 * Behavior:
 * - Fills smoothly on prop change (CSS transition on width)
 * - When crossing a rank threshold, dispatches a window event 'rank-up' with
 *   the new rank key. Consumers (RankUpCeremony) listen for it.
 * - Fires a subtle levelUp sound + tick haptic on any XP gain during the
 *   session (not on initial mount).
 */

interface Props {
  xp: number;
  compact?: boolean;
  className?: string;
}

// Track last-seen XP across mounts (module-level) so navigation between pages
// doesn't retrigger the level-up chime on every mount.
let lastSeenXP: number | null = null;
let lastSeenRank: string | null = null;

export function XPBar({ xp, compact, className }: Props) {
  const { rank, next, pct, xpIntoRank, xpNeededForNext } = rankProgress(xp);
  const [displayPct, setDisplayPct] = useState(pct * 100);
  const initialized = useRef(false);

  useEffect(() => {
    // Animate the bar filling on mount
    requestAnimationFrame(() => setDisplayPct(pct * 100));
  }, [pct]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      lastSeenXP = xp;
      lastSeenRank = rank.key;
      return;
    }
    // Real XP gain during this session
    if (lastSeenXP != null && xp > lastSeenXP) {
      playSound("levelUp");
      haptic("tick");
    }
    // Detect rank-up: fire a window event that overlays listen for
    if (lastSeenRank && lastSeenRank !== rank.key) {
      const prevIndex = ["squire","warden","knight","vanguard","baron","duke","king","sovereign"].indexOf(lastSeenRank);
      const newIndex  = ["squire","warden","knight","vanguard","baron","duke","king","sovereign"].indexOf(rank.key);
      if (newIndex > prevIndex) {
        window.dispatchEvent(new CustomEvent("rank-up", { detail: { rankKey: rank.key } }));
      }
    }
    lastSeenXP = xp;
    lastSeenRank = rank.key;
  }, [xp, rank.key]);

  const isTop = rank.key === next.key;
  const labelLeft = `${rank.name.toUpperCase()} · ${rank.numeral}`;
  const labelRight = isTop
    ? "MAXIMUM RANK"
    : `${next.name.toUpperCase()} · ${next.numeral}`;

  return (
    <div className={cn("w-full", className)} data-testid="xp-bar">
      {!compact && (
        <div
          className="flex items-baseline justify-between text-[10px] tracking-[0.3em] mb-1.5"
          style={{ fontFamily: "'Inter', sans-serif", color: rank.color, opacity: 0.9 }}
        >
          <span>{labelLeft}</span>
          <span style={{ color: next.color }}>{labelRight}</span>
        </div>
      )}
      <div
        className="relative h-3 w-full overflow-hidden rounded-sm border"
        style={{ borderColor: `${rank.color}66`, background: "#0e0d0b" }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${displayPct}%`,
            background: `linear-gradient(90deg, ${rank.color} 0%, ${next.color} 100%)`,
            boxShadow: `0 0 12px ${rank.color}80`,
            transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
        {/* diagonal shimmer */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%)",
            backgroundSize: "10px 10px",
          }}
        />
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-baseline justify-between text-[10px] tracking-[0.2em] opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>
          <span>{xp.toLocaleString()} XP</span>
          <span>{isTop ? "APEX" : `${xpNeededForNext.toLocaleString()} XP TO NEXT`}</span>
        </div>
      )}
    </div>
  );
}
