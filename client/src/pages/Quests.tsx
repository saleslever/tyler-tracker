import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DailyLog, BossSeal, Challenge, Quest } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Fleuron } from "@/components/Ornament";
import { computeQuestProgress, isQuestComplete } from "@/lib/questMetrics";
import { playSound, haptic } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

/**
 * Quests page — a permanent side objective board.
 *
 * Behavior:
 *   - Fetches quests, logs, boss seals, active challenge
 *   - Every render, recomputes each quest's progress and PATCHes the server
 *     if the on-server value is stale. This keeps the DB honest without needing
 *     any special server-side logic.
 *   - When a quest transitions from incomplete → complete (progress >= goal),
 *     fires a `questDone` chime + haptic and marks completedAt on the server.
 *   - The user can "Claim Reward" once completed. Claim sets claimedAt and
 *     resets progress to zero (so the quest cycles again).
 */

const TONE_COLORS: Record<string, { accent: string; bg: string }> = {
  iron:  { accent: "#c0c0c0", bg: "#1c1c1c" },
  gold:  { accent: "#e0b74f", bg: "#231c0a" },
  blood: { accent: "#c94848", bg: "#220b0b" },
  sober: { accent: "#7ac3d0", bg: "#0e1a1e" },
  forge: { accent: "#e8894a", bg: "#231208" },
};

// Guard set — prevents firing the questDone chime multiple times per session.
const sessionFiredComplete = new Set<string>();

export default function QuestsPage() {
  const { data: quests = [] } = useQuery<Quest[]>({ queryKey: ["/api/quests"] });
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: seals = [] } = useQuery<BossSeal[]>({ queryKey: ["/api/boss-seals"] });
  const { data: challenge } = useQuery<Challenge | null>({ queryKey: ["/api/challenges/active"] });

  const patchQuest = useMutation({
    mutationFn: async ({ key, patch }: { key: string; patch: Partial<Quest> }) => {
      return apiRequest("PATCH", `/api/quests/${key}`, patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quests"] }),
  });

  // Claim endpoint: archives the quest, spawns the next tier, returns { claimed, nextQuest }.
  const claimQuest = useMutation({
    mutationFn: async (key: string) => apiRequest("POST", `/api/quests/${key}/claim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quest-completions"] });
    },
  });

  // Recompute progress and reconcile with server.
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    for (const q of quests) {
      if (q.claimedAt) continue; // Fully claimed cycle; wait for user
      const progress = computeQuestProgress(q.metric, logs, seals, challenge);
      const nowComplete = progress >= q.goal;
      const patch: Partial<Quest> = {};
      if (progress !== q.progress) patch.progress = progress;
      if (nowComplete && !q.completedAt) patch.completedAt = new Date().toISOString();
      if (!nowComplete && q.completedAt) patch.completedAt = null; // regression handling
      if (Object.keys(patch).length === 0) return;
      if (inFlight.current.has(q.key)) continue;
      inFlight.current.add(q.key);
      patchQuest.mutate(
        { key: q.key, patch },
        {
          onSettled: () => inFlight.current.delete(q.key),
        },
      );
      // Fire the completion FX exactly once per session per quest
      if (nowComplete && !q.completedAt && !sessionFiredComplete.has(q.key)) {
        sessionFiredComplete.add(q.key);
        playSound("questDone");
        haptic("success");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests, logs, seals, challenge]);

  const sortedQuests = useMemo(() => {
    return [...quests].sort((a, b) => {
      // Completed-unclaimed first, then incomplete by progress %, then claimed
      const aReady = a.completedAt && !a.claimedAt ? 0 : a.completedAt ? 2 : 1;
      const bReady = b.completedAt && !b.claimedAt ? 0 : b.completedAt ? 2 : 1;
      if (aReady !== bReady) return aReady - bReady;
      return (b.progress / b.goal) - (a.progress / a.goal);
    });
  }, [quests]);

  const handleClaim = (q: Quest) => {
    playSound("sparkle");
    haptic("success");
    sessionFiredComplete.delete(q.key);
    // Archive this quest + spawn a harder next-tier quest.
    claimQuest.mutate(q.key);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <PageHeader
        title="Quests"
        subtitle="Conquer one and a harder one takes its place. The game never stops levelling up."
      />

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="quest-grid">
        {sortedQuests.map((q) => (
          <QuestCard key={q.key} quest={q} onClaim={() => handleClaim(q)} />
        ))}
      </div>

      <div className="mt-16 flex justify-center opacity-40">
        <Fleuron size={32} />
      </div>
    </div>
  );
}

const TIER_NUMERAL = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function QuestCard({ quest, onClaim }: { quest: Quest; onClaim: () => void }) {
  const tone = TONE_COLORS[quest.tone] ?? TONE_COLORS.iron;
  const pct = Math.max(0, Math.min(1, quest.progress / quest.goal));
  const complete = isQuestComplete(quest);
  const ready = complete && !quest.claimedAt;
  const tier = quest.tier ?? 1;
  const tierLabel = TIER_NUMERAL[tier - 1] ?? String(tier);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-sm border p-6 transition-all",
        ready ? "shadow-[0_0_36px_rgba(224,183,79,0.35)]" : "",
      )}
      style={{
        borderColor: `${tone.accent}55`,
        background: `linear-gradient(160deg, ${tone.bg} 0%, #0a0908 100%)`,
      }}
      data-testid={`quest-card-${quest.key}`}
    >
      {/* Corner icon */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-sm border text-2xl"
          style={{ borderColor: `${tone.accent}88`, color: tone.accent, background: "#0a0908" }}
        >
          {quest.icon ?? "◆"}
        </div>
        <div className="text-right">
          <div
            className="text-[10px] tracking-[0.35em] uppercase opacity-60"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Reward
          </div>
          <div
            className="serif uppercase text-lg"
            style={{ color: tone.accent, letterSpacing: "0.06em" }}
          >
            +{quest.xpReward} XP
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <div
          className="serif-hero uppercase leading-none text-2xl"
          style={{ color: tone.accent, letterSpacing: "0.06em" }}
        >
          {quest.title}
        </div>
        {tier > 1 && (
          <span
            className="serif italic text-[11px] tracking-[0.2em] uppercase opacity-80"
            style={{ color: tone.accent }}
            data-testid={`quest-tier-${quest.key}`}
          >
            · Tier {tierLabel}
          </span>
        )}
      </div>
      <div className="serif text-sm opacity-85" style={{ color: "hsl(38 20% 90%)" }}>
        {quest.subtitle}
      </div>
      {quest.motto && (
        <div
          className="serif italic mt-3 text-xs opacity-70"
          style={{ color: `${tone.accent}cc` }}
        >
          "{quest.motto}"
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between text-[10px] tracking-[0.3em] mb-1.5 uppercase" style={{ fontFamily: "'Inter', sans-serif", color: tone.accent }}>
          <span>Progress</span>
          <span>{quest.progress} / {quest.goal}</span>
        </div>
        <div
          className="relative h-2 w-full overflow-hidden rounded-sm border"
          style={{ borderColor: `${tone.accent}55`, background: "#0e0d0b" }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${pct * 100}%`,
              background: `linear-gradient(90deg, ${tone.accent} 0%, ${tone.accent}80 100%)`,
              boxShadow: `0 0 10px ${tone.accent}90`,
              transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      </div>

      {ready && (
        <button
          onClick={onClaim}
          className="mt-5 w-full rounded-sm border-2 py-2.5 text-xs uppercase tracking-[0.35em] transition-all active:scale-95"
          style={{
            borderColor: tone.accent,
            color: "#0a0908",
            background: tone.accent,
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
          }}
          data-testid={`button-claim-${quest.key}`}
        >
          Claim Reward
        </button>
      )}

      {!complete && (
        <div className="mt-5 text-center text-[10px] tracking-[0.3em] uppercase opacity-50" style={{ fontFamily: "'Inter', sans-serif" }}>
          In Progress
        </div>
      )}
    </div>
  );
}
