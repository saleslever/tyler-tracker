import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog, BossSeal, Quest, QuestCompletion, Record_ } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Fleuron } from "@/components/Ornament";
import { totalXP, RANKS, rankForXP } from "@/lib/xp";
import { RankShield } from "@/components/RankShield";
import { cn } from "@/lib/utils";
import { Trophy, ShieldCheck, Award, Flame } from "lucide-react";

/**
 * Milestones — the Trophy Hall.
 *
 * A permanent monument to conquered quests, ranks earned, boss seals sealed,
 * and personal records set. This is the "look what I've done" wall that makes
 * the game feel real.
 */

const TONE_COLORS: Record<string, { accent: string; bg: string }> = {
  iron:  { accent: "#c0c0c0", bg: "#1c1c1c" },
  gold:  { accent: "#e0b74f", bg: "#231c0a" },
  blood: { accent: "#c94848", bg: "#220b0b" },
  sober: { accent: "#7ac3d0", bg: "#0e1a1e" },
  forge: { accent: "#e8894a", bg: "#231208" },
};

const TIER_NUMERAL = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function Milestones() {
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: quests = [] } = useQuery<Quest[]>({ queryKey: ["/api/quests"] });
  const { data: completions = [] } = useQuery<QuestCompletion[]>({ queryKey: ["/api/quest-completions"] });
  const { data: seals = [] } = useQuery<BossSeal[]>({ queryKey: ["/api/boss-seals"] });
  const { data: records = [] } = useQuery<Record_[]>({ queryKey: ["/api/records"] });

  const xp = useMemo(() => totalXP(logs, seals, quests, completions), [logs, seals, quests, completions]);
  const currentRank = rankForXP(xp);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <PageHeader
        title="Milestones"
        subtitle="The hall of everything you've conquered. Every rank, every trophy, every seal."
      />

      {/* -------------------------------- Ranks Earned ------------------------------- */}
      <section className="mt-14" data-testid="section-ranks">
        <SectionHeader icon={<Award className="h-5 w-5" />} title="Ranks Earned" count={`${RANKS.findIndex((r) => r.key === currentRank.key) + 1} / ${RANKS.length}`} />
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {RANKS.map((r) => {
            const earned = xp >= r.minXP;
            return (
              <div
                key={r.key}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-sm border p-4 text-center transition-all",
                  earned ? "opacity-100" : "opacity-30 grayscale",
                )}
                style={{
                  borderColor: earned ? `${r.color}88` : "#333",
                  background: earned ? `linear-gradient(160deg, ${r.bgColor} 0%, #0a0908 100%)` : "#0a0908",
                }}
                data-testid={`rank-tile-${r.key}`}
              >
                <RankShield rank={r} size={48} />
                <div className="serif uppercase text-xs tracking-[0.2em]" style={{ color: earned ? r.color : "#777" }}>
                  {r.name}
                </div>
                <div className="text-[10px] opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>
                  {r.numeral} · {r.minXP.toLocaleString()} XP
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------- Quests Conquered ------------------------------ */}
      <section className="mt-16" data-testid="section-trophies">
        <SectionHeader
          icon={<Trophy className="h-5 w-5" />}
          title="Quests Conquered"
          count={`${completions.length}`}
        />
        {completions.length === 0 ? (
          <EmptyState line="No trophies yet. Conquer a quest to fill the hall." />
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="trophy-grid">
            {completions.map((c) => (
              <TrophyCard key={c.id} completion={c} />
            ))}
          </div>
        )}
      </section>

      {/* -------------------------------- Boss Seals -------------------------------- */}
      <section className="mt-16" data-testid="section-boss-seals">
        <SectionHeader
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Boss Seals"
          count={`${seals.length}`}
        />
        {seals.length === 0 ? (
          <EmptyState line="No days sealed yet. Complete every ritual for one day and hit Seal the Day." />
        ) : (
          <SealHeatMap seals={seals} />
        )}
      </section>

      {/* ----------------------------- Personal Records ----------------------------- */}
      <section className="mt-16" data-testid="section-records">
        <SectionHeader
          icon={<Flame className="h-5 w-5" />}
          title="Personal Records"
          count={`${records.filter((r) => r.value > 0).length} / ${records.length}`}
        />
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((r) => {
            const set = r.value > 0;
            return (
              <div
                key={r.key}
                className={cn(
                  "rounded-sm border p-4 transition-all",
                  set ? "opacity-100" : "opacity-40",
                )}
                style={{
                  borderColor: set ? "#e0b74f66" : "#333",
                  background: set ? "linear-gradient(160deg, #1c1a12 0%, #0a0908 100%)" : "#0a0908",
                }}
                data-testid={`record-tile-${r.key}`}
              >
                <div className="microlabel">{r.label}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="num-display text-3xl leading-none" style={{ color: set ? "#e0b74f" : "#666" }}>
                    {r.value || "—"}
                  </div>
                  {set && r.unit && (
                    <div className="text-xs opacity-60 uppercase tracking-[0.25em]" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {r.unit}
                    </div>
                  )}
                </div>
                {r.setOnDate && (
                  <div className="mt-2 text-[10px] opacity-60" style={{ fontFamily: "'Inter', sans-serif" }}>
                    set {formatDate(r.setOnDate)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-20 flex justify-center opacity-40">
        <Fleuron size={32} />
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[#2a2a2a] pb-3">
      <div className="flex items-center gap-3">
        <span className="opacity-70">{icon}</span>
        <h2 className="serif-hero uppercase text-xl tracking-[0.08em]">{title}</h2>
      </div>
      <div
        className="text-xs uppercase tracking-[0.35em] opacity-70"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {count}
      </div>
    </div>
  );
}

function EmptyState({ line }: { line: string }) {
  return (
    <div
      className="mt-6 rounded-sm border border-dashed border-[#333] py-10 text-center text-sm opacity-60 serif italic"
    >
      {line}
    </div>
  );
}

function TrophyCard({ completion }: { completion: QuestCompletion }) {
  const tone = TONE_COLORS[completion.tone] ?? TONE_COLORS.iron;
  const tier = completion.tier ?? 1;
  const tierLabel = TIER_NUMERAL[tier - 1] ?? String(tier);
  return (
    <div
      className="relative overflow-hidden rounded-sm border p-6"
      style={{
        borderColor: `${tone.accent}88`,
        background: `linear-gradient(160deg, ${tone.bg} 0%, #0a0908 100%)`,
        boxShadow: `0 0 24px ${tone.accent}22`,
      }}
      data-testid={`trophy-card-${completion.id}`}
    >
      {/* Corner icon */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-sm border text-3xl"
          style={{
            borderColor: tone.accent,
            color: tone.accent,
            background: "#0a0908",
            boxShadow: `0 0 12px ${tone.accent}55`,
          }}
        >
          {completion.icon ?? "◆"}
        </div>
        <div className="text-right">
          <div
            className="text-[10px] tracking-[0.35em] uppercase opacity-60"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Awarded
          </div>
          <div
            className="serif uppercase text-lg"
            style={{ color: tone.accent, letterSpacing: "0.06em" }}
          >
            +{completion.xpAwarded} XP
          </div>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <div
          className="serif-hero uppercase leading-none text-2xl"
          style={{ color: tone.accent, letterSpacing: "0.06em" }}
        >
          {completion.title}
        </div>
        <span
          className="serif italic text-[11px] tracking-[0.2em] uppercase opacity-80"
          style={{ color: tone.accent }}
        >
          · Tier {tierLabel}
        </span>
      </div>
      <div className="serif text-sm opacity-85" style={{ color: "hsl(38 20% 90%)" }}>
        {completion.subtitle}
      </div>
      {completion.motto && (
        <div
          className="serif italic mt-3 text-xs opacity-70"
          style={{ color: `${tone.accent}cc` }}
        >
          "{completion.motto}"
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between border-t border-[#2a2a2a] pt-3">
        <div className="text-[10px] tracking-[0.3em] uppercase opacity-60" style={{ fontFamily: "'Inter', sans-serif" }}>
          Conquered
        </div>
        <div
          className="serif text-xs opacity-80"
          style={{ color: `${tone.accent}dd` }}
        >
          {formatDate(completion.completedAt)}
        </div>
      </div>
    </div>
  );
}

/**
 * A calendar-style heatmap of every sealed day for the current year.
 * Simple grid: one square per day, filled if a boss seal exists for it.
 */
function SealHeatMap({ seals }: { seals: BossSeal[] }) {
  const sealSet = useMemo(() => new Set(seals.map((s) => s.date)), [seals]);

  // Build a 52-week grid ending today.
  const cells = useMemo(() => {
    const today = new Date();
    // Go back 52 weeks
    const start = new Date(today);
    start.setDate(start.getDate() - 52 * 7 + 1);
    const cells: { date: string; sealed: boolean }[] = [];
    const cur = new Date(start);
    while (cur <= today) {
      const iso = cur.toISOString().slice(0, 10);
      cells.push({ date: iso, sealed: sealSet.has(iso) });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }, [sealSet]);

  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ minWidth: "min-content" }} data-testid="seal-heatmap">
        {cells.map((c) => (
          <div
            key={c.date}
            title={c.date + (c.sealed ? " · sealed" : "")}
            className="h-[11px] w-[11px] rounded-[2px]"
            style={{
              background: c.sealed ? "#e0b74f" : "#1a1a1a",
              boxShadow: c.sealed ? "0 0 4px #e0b74f88" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}
