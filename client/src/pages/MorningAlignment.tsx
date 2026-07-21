import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog, Goal, Ritual, Challenge } from "@shared/schema";
import crestFull from "@assets/crest_full.png";
import crestMark from "@assets/crest_mark.png";
import { useToday } from "@/hooks/useToday";
import {
  HABITS,
  habitHit,
  dayScore,
  overallStreak,
  currentStreak,
  addDays,
  completionRate,
} from "@/lib/analytics";
import { rollupChallenge, requiredDailyHabits, requiredWeeklyHabits } from "@/lib/challenge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { playSound } from "@/hooks/useSound";
import { Awakening } from "@/components/Awakening";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
import { Confetti } from "@/components/Confetti";
import { Fleuron, CornerFlourish } from "@/components/Ornament";
import { Check, Pencil, X, Plus, Sparkles, ChevronRight, Flame, ShieldCheck, TrendingDown, Trophy, Star } from "lucide-react";

/* --------------------------------------------------------------------------
 * MORNING ALIGNMENT
 * The ceremonial morning-ritual home. Full heraldic aesthetic.
 * Cinzel serif everywhere, gold accents, crest watermarks, procedural chimes.
 * --------------------------------------------------------------------------
 */

const TIME_GREETINGS = [
  { start: 4, end: 12, label: "Good Morning" },
  { start: 12, end: 17, label: "Good Afternoon" },
  { start: 17, end: 22, label: "Good Evening" },
  { start: 22, end: 28, label: "Late Hours" }, // 22-24
  { start: 0, end: 4, label: "Deep Night" },   // 0-4
];
function greeting(): string {
  const h = new Date().getHours();
  for (const g of TIME_GREETINGS) {
    if (h >= g.start && h < g.end) return g.label;
  }
  return "Welcome";
}

function fullDateLine(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

/* ==========================================================================
 * MORNING HERO
 * ========================================================================== */
function MorningHero({
  logs,
  today,
  challenge,
}: {
  logs: DailyLog[];
  today: string;
  challenge: Challenge | undefined;
}) {
  const todayLog = logs.find((l) => l.date === today);
  const yesterday = addDays(today, -1);
  const ydayLog = logs.find((l) => l.date === yesterday);

  // Sobriety streak (No Alcohol habit)
  const noAlcohol = HABITS.find((h) => h.key === "noAlcohol")!;
  const sober = currentStreak(logs, noAlcohol, today);

  // Overall discipline streak
  const streak = overallStreak(logs, today);

  // Challenge day + perfect streak
  const rollup = useMemo(
    () => (challenge ? rollupChallenge(challenge, logs, today) : null),
    [challenge, logs, today],
  );

  // Weight: latest recorded, plus 7-day trend
  const latestWeight = useMemo(() => {
    for (let i = 0; i < 30; i++) {
      const l = logs.find((x) => x.date === addDays(today, -i));
      if (l && l.weight != null) return { value: l.weight, ago: i };
    }
    return null;
  }, [logs, today]);
  const weightDelta = useMemo(() => {
    const recent = latestWeight?.value;
    if (recent == null) return null;
    for (let i = 7; i < 30; i++) {
      const l = logs.find((x) => x.date === addDays(today, -i) && x.weight != null);
      if (l && l.weight != null) return recent - l.weight;
    }
    return null;
  }, [logs, today, latestWeight]);

  // Rotating principle — same each day (deterministic from date), rotates on click.
  const PRINCIPLES = [
    "I am THE MAN.",
    "My word is IRON.",
    "I am the rock in the ocean of chaos.",
    "Discipline is freedom.",
    "One day at a time. Never look back.",
    "Every rep, every gallon, every fast — I am becoming.",
    "I fight because my son is watching.",
  ];
  const [principleIdx, setPrincipleIdx] = useState(() => {
    let h = 0;
    for (const c of today) h = (h * 31 + c.charCodeAt(0)) | 0;
    return Math.abs(h) % PRINCIPLES.length;
  });
  const principle = PRINCIPLES[principleIdx];

  return (
    <div
      className="hero-panel relative overflow-hidden"
      data-testid="morning-hero"
      style={{ padding: "48px 40px" }}
    >
      {/* Massive crest watermark — slowly rotating */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none select-none"
        style={{
          right: -140, top: -100,
          width: 640, height: 640,
          opacity: 0.06,
          animation: "hero-crest-drift 90s linear infinite",
        }}
      >
        <img src={crestFull} alt="" className="w-full h-full object-contain" />
      </div>

      <CornerFlourish position="tl" />
      <CornerFlourish position="tr" />

      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="microlabel" style={{ letterSpacing: "0.4em", opacity: 0.7 }}>
              — Morning Alignment —
            </div>
            <div
              className="serif-hero uppercase mt-3 mb-1 leading-[1]"
              style={{
                fontSize: "clamp(38px, 5.5vw, 68px)",
                color: "hsl(38 25% 92%)",
                letterSpacing: "0.02em",
              }}
              data-testid="hero-greeting"
            >
              {greeting()}, Tyler
            </div>
            <div className="text-sm text-muted-foreground mt-2 tracking-wider uppercase" style={{ letterSpacing: "0.2em" }}>
              {fullDateLine()}
            </div>
          </div>

          <img
            src={crestMark}
            alt=""
            aria-hidden="true"
            className="w-20 h-24 object-contain shrink-0"
            style={{ filter: "drop-shadow(0 0 24px hsl(38 70% 40% / 0.4))" }}
          />
        </div>

        {/* Rotating principle */}
        <button
          onClick={() => {
            setPrincipleIdx((i) => (i + 1) % PRINCIPLES.length);
            playSound("flourish");
          }}
          className="text-left group"
          data-testid="btn-principle"
        >
          <div
            className="serif uppercase transition-colors"
            style={{
              fontSize: "clamp(20px, 2.4vw, 30px)",
              color: "hsl(38 60% 65%)",
              letterSpacing: "0.15em",
              fontStyle: "normal",
              lineHeight: 1.2,
            }}
          >
            &ldquo; {principle} &rdquo;
          </div>
          <div className="microlabel mt-2 opacity-40 group-hover:opacity-70 transition-opacity">
            tap to rotate
          </div>
        </button>

        <Fleuron className="my-2" size={22} />

        {/* Counters row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HeroCounter
            label="Discipline Streak"
            value={streak}
            unit={streak === 1 ? "day" : "days"}
            icon={<Flame className="w-4 h-4" />}
            accent="amber"
            testId="counter-streak"
          />
          <HeroCounter
            label="Days Sober"
            value={sober}
            unit={sober === 1 ? "day" : "days"}
            icon={<ShieldCheck className="w-4 h-4" />}
            accent="platinum"
            testId="counter-sober"
          />
          {rollup && (
            <HeroCounter
              label="Challenge Day"
              value={rollup.currentDay}
              unit={`of ${rollup.totalDays}`}
              icon={<Trophy className="w-4 h-4" />}
              accent="gold"
              testId="counter-challenge"
            />
          )}
          <HeroCounter
            label="Weight"
            value={latestWeight ? Math.round(latestWeight.value * 10) / 10 : "—"}
            unit={latestWeight ? "lb" : ""}
            sub={
              weightDelta != null ? (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: weightDelta < 0 ? "hsl(140 45% 60%)" : "hsl(0 55% 65%)" }}
                >
                  <TrendingDown className="w-3 h-3" style={{ transform: weightDelta < 0 ? "none" : "scaleY(-1)" }} />
                  {weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)} · 30d
                </span>
              ) : null
            }
            icon={<Star className="w-4 h-4" />}
            accent="platinum"
            testId="counter-weight"
          />
        </div>
      </div>

      <style>{`
        @keyframes hero-crest-drift {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function HeroCounter({
  label, value, unit, icon, accent = "amber", sub, testId,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  accent?: "amber" | "gold" | "platinum";
  sub?: React.ReactNode;
  testId?: string;
}) {
  const color =
    accent === "gold" ? "hsl(38 75% 60%)" :
    accent === "amber" ? "hsl(35 65% 55%)" :
    "hsl(40 15% 88%)";
  return (
    <div className="stat-card relative" data-testid={testId}>
      <div className="flex items-center gap-2 microlabel" style={{ color: "hsl(38 30% 55%)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="num-display text-4xl md:text-5xl leading-none" style={{ color }}>
          {value}
        </div>
        {unit && <div className="text-sm text-muted-foreground uppercase tracking-widest">{unit}</div>}
      </div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ==========================================================================
 * YESTERDAY VERDICT — color-shifting scorecard
 * ========================================================================== */
function YesterdayVerdict({
  logs, today, challenge,
}: {
  logs: DailyLog[];
  today: string;
  challenge: Challenge | undefined;
}) {
  const yesterday = addDays(today, -1);
  const ydayLog = logs.find((l) => l.date === yesterday);
  const score = dayScore(ydayLog);
  const daily = challenge ? requiredDailyHabits(challenge) : [];

  const hitsList = HABITS.filter((h) => habitHit(ydayLog, h));
  const missList = HABITS.filter(
    (h) => !habitHit(ydayLog, h) && (daily.includes(h.key as any) || h.kind === "bool"),
  ).slice(0, 5);

  const verdict =
    ydayLog?.cheatDay === 1 ? { title: "Cheat Day", subtitle: "Rest earned. The war continues.", tone: "gold" } :
    score >= 0.9 ? { title: "Legendary", subtitle: "Nearly perfect. Ride the momentum.", tone: "gold" } :
    score >= 0.7 ? { title: "Strong", subtitle: "Solid day. Keep the fire.", tone: "amber" } :
    score >= 0.4 ? { title: "Fought For It", subtitle: "Partial victory. Today is a new war.", tone: "warm" } :
    ydayLog ? { title: "Broken", subtitle: "Yesterday is closed. Rebuild today.", tone: "cool" } :
    { title: "No Data", subtitle: "Yesterday was not logged.", tone: "neutral" };

  const bg =
    verdict.tone === "gold"  ? "linear-gradient(135deg, hsl(38 40% 12%), hsl(38 25% 8%))" :
    verdict.tone === "amber" ? "linear-gradient(135deg, hsl(30 25% 11%), hsl(30 15% 7%))" :
    verdict.tone === "warm"  ? "linear-gradient(135deg, hsl(22 20% 10%), hsl(22 12% 6%))" :
    verdict.tone === "cool"  ? "linear-gradient(135deg, hsl(220 12% 10%), hsl(220 8% 6%))" :
                                "linear-gradient(135deg, hsl(0 0% 8%), hsl(0 0% 5%))";
  const accent =
    verdict.tone === "gold"  ? "hsl(38 75% 60%)" :
    verdict.tone === "amber" ? "hsl(30 55% 55%)" :
    verdict.tone === "warm"  ? "hsl(20 45% 55%)" :
    verdict.tone === "cool"  ? "hsl(220 20% 65%)" :
                                "hsl(0 0% 60%)";

  return (
    <div
      className="card-lux relative overflow-hidden"
      style={{ background: bg }}
      data-testid="yesterday-verdict"
    >
      <div className="p-6 md:p-8">
        <div className="microlabel opacity-70">Yesterday · {new Date(yesterday + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
        <div className="flex items-baseline justify-between gap-4 flex-wrap mt-3">
          <div>
            <div
              className="serif uppercase"
              style={{
                fontSize: "clamp(28px, 3.5vw, 42px)",
                color: accent,
                letterSpacing: "0.06em",
                lineHeight: 1,
              }}
            >
              {verdict.title}
            </div>
            <div className="text-sm text-muted-foreground mt-2 max-w-md" style={{ letterSpacing: "0.05em" }}>
              {verdict.subtitle}
            </div>
          </div>
          <div className="text-right">
            <div className="num-display text-5xl md:text-6xl leading-none" style={{ color: accent }}>
              {Math.round(score * 100)}
              <span className="text-2xl opacity-60">%</span>
            </div>
            <div className="microlabel mt-1">completion</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <div className="microlabel mb-2 flex items-center gap-1.5">
              <Check className="w-3 h-3" style={{ color: accent }} /> Wins
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hitsList.length === 0 && <span className="text-xs text-muted-foreground italic">None recorded.</span>}
              {hitsList.map((h) => (
                <span
                  key={h.key}
                  className="text-xs px-2 py-1 rounded border"
                  style={{ borderColor: `${accent} / 0.3`, color: "hsl(38 25% 88%)", background: "hsl(0 0% 100% / 0.03)" }}
                >
                  {h.emoji} {h.label}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="microlabel mb-2 flex items-center gap-1.5">
              <X className="w-3 h-3 opacity-60" /> Missed
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missList.length === 0 && <span className="text-xs text-muted-foreground italic">Clean sheet.</span>}
              {missList.map((h) => (
                <span
                  key={h.key}
                  className="text-xs px-2 py-1 rounded border border-muted-foreground/20 text-muted-foreground"
                >
                  {h.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * WEEK CHAIN — 7-day Mon-Sun grid
 * ========================================================================== */
function WeekChain({
  logs, today, challenge,
}: {
  logs: DailyLog[];
  today: string;
  challenge: Challenge | undefined;
}) {
  // Week runs Mon → Sun ending on `today`. Show current ISO week starting Monday.
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dayOfWeek = dt.getDay(); // 0 = Sun, 1 = Mon
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(today, mondayOffset);

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const daily = challenge ? requiredDailyHabits(challenge) : [];
  const weekly = challenge ? requiredWeeklyHabits(challenge) : {} as Record<string, number>;

  const weekLogs = days.map((d) => logs.find((l) => l.date === d));
  const cheats = weekLogs.filter((l) => l?.cheatDay === 1).length;

  const workoutHits = weekLogs.filter((l) => l?.workout === 1).length;
  const workoutTarget = (weekly as any).workout ?? 4;

  return (
    <div className="card-lux p-6 md:p-8" data-testid="week-chain">
      <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="microlabel">This Week</div>
          <div className="serif text-xl md:text-2xl uppercase mt-1" style={{ letterSpacing: "0.08em" }}>
            The Chain
          </div>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest">
          Week of {new Date(monday + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {days.map((d, i) => {
          const log = weekLogs[i];
          const perfect = log?.cheatDay === 1 ||
            (daily.length > 0 && daily.every((k) => {
              const h = HABITS.find((x) => x.key === k)!;
              return habitHit(log, h);
            }));
          const partial = !perfect && log && dayScore(log) >= 0.5;
          const isToday = d === today;
          const isFuture = d > today;
          const dow = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

          const bg =
            log?.cheatDay === 1 ? "hsl(38 65% 40%)" :
            perfect ? "hsl(38 70% 50%)" :
            partial ? "hsl(30 40% 30%)" :
            log && !isFuture ? "hsl(0 20% 20%)" :
            "hsl(0 0% 8%)";
          const border =
            isToday ? "hsl(38 70% 60%)" : "hsl(0 0% 100% / 0.08)";

          return (
            <div
              key={d}
              className="relative rounded flex flex-col items-center justify-center aspect-square transition-transform hover:scale-105"
              style={{
                background: bg,
                border: `1.5px solid ${border}`,
                boxShadow: perfect ? "0 0 16px hsl(38 70% 40% / 0.4)" : "none",
              }}
              data-testid={`week-day-${dow}`}
              title={d}
            >
              <div className="text-[10px] uppercase tracking-widest opacity-70 mb-0.5" style={{ color: perfect ? "hsl(0 0% 0%)" : "hsl(38 30% 65%)" }}>
                {dow}
              </div>
              <div className="num-display text-lg md:text-xl" style={{ color: perfect ? "hsl(0 0% 5%)" : "hsl(38 20% 88%)" }}>
                {parseInt(d.split("-")[2], 10)}
              </div>
              {log?.cheatDay === 1 && (
                <ShieldCheck className="w-3 h-3 mt-0.5" style={{ color: "hsl(0 0% 5%)" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Below-grid summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="text-center md:text-left">
          <div className="microlabel">Lifts</div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="num-display text-3xl" style={{ color: "hsl(38 65% 55%)" }}>{workoutHits}</div>
            <div className="text-sm text-muted-foreground">/ {workoutTarget}</div>
          </div>
          {/* progress bar */}
          <div className="h-1.5 rounded-full bg-secondary mt-2 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, (workoutHits / Math.max(1, workoutTarget)) * 100)}%`,
                background: "linear-gradient(90deg, hsl(38 70% 50%), hsl(38 85% 60%))",
              }}
            />
          </div>
        </div>
        <div className="text-center md:text-left">
          <div className="microlabel">Cheats Used</div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="num-display text-3xl" style={{ color: cheats > 0 ? "hsl(38 60% 50%)" : "hsl(140 40% 55%)" }}>{cheats}</div>
            <div className="text-sm text-muted-foreground">/ {challenge?.cheatDaysPerWeek ?? 1}</div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {cheats === 0 ? "Clean week." : `${(challenge?.cheatDaysPerWeek ?? 1) - cheats} remaining.`}
          </div>
        </div>
        <div className="text-center md:text-left col-span-2 md:col-span-1">
          <div className="microlabel">Perfect Days</div>
          <div className="flex items-baseline gap-2 mt-2">
            <div className="num-display text-3xl" style={{ color: "hsl(38 75% 60%)" }}>
              {weekLogs.filter((l, i) => {
                const dstr = days[i];
                return (l?.cheatDay === 1) || (daily.length > 0 && daily.every((k) => {
                  const h = HABITS.find((x) => x.key === k)!;
                  return habitHit(l, h);
                }));
              }).length}
            </div>
            <div className="text-sm text-muted-foreground">/ 7</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * RITUAL SECTION — editable Why/Questions/Code
 * ========================================================================== */
function RitualSection({
  ritual,
  icon,
  onSaved,
  accentColor = "hsl(38 65% 55%)",
}: {
  ritual: Ritual;
  icon: React.ReactNode;
  onSaved: () => void;
  accentColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<string[]>(() => {
    try { return JSON.parse(ritual.items) as string[]; } catch { return []; }
  });
  const [title, setTitle] = useState(ritual.title);
  const [subtitle, setSubtitle] = useState(ritual.subtitle ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // sync when ritual prop updates
    try { setItems(JSON.parse(ritual.items) as string[]); } catch { setItems([]); }
    setTitle(ritual.title);
    setSubtitle(ritual.subtitle ?? "");
  }, [ritual.items, ritual.title, ritual.subtitle]);

  async function save() {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/rituals/${ritual.key}`, {
        title,
        subtitle,
        items: JSON.stringify(items.filter((s) => s.trim().length > 0)),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/rituals"] });
      playSound("flourish");
      setEditing(false);
      onSaved();
    } catch (e) {
      alert("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-lux p-6 md:p-8 relative" data-testid={`ritual-${ritual.key}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-md flex items-center justify-center shrink-0 border"
            style={{
              borderColor: `${accentColor}`,
              background: "hsl(0 0% 100% / 0.03)",
              color: accentColor,
            }}
          >
            {icon}
          </div>
          <div>
            {editing ? (
              <>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="serif text-xl md:text-2xl uppercase bg-transparent border-b border-border/40 focus:border-foreground/60 focus:outline-none py-1 w-full"
                  style={{ letterSpacing: "0.08em", color: "hsl(38 25% 92%)" }}
                  data-testid={`input-title-${ritual.key}`}
                />
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="subtitle"
                  className="mt-2 text-sm text-muted-foreground bg-transparent border-b border-border/30 focus:border-foreground/50 focus:outline-none py-1 w-full"
                  data-testid={`input-subtitle-${ritual.key}`}
                />
              </>
            ) : (
              <>
                <div
                  className="serif text-xl md:text-2xl uppercase"
                  style={{ letterSpacing: "0.08em", color: "hsl(38 25% 92%)" }}
                >
                  {ritual.title}
                </div>
                {ritual.subtitle && (
                  <div className="text-sm text-muted-foreground mt-1 max-w-lg">
                    {ritual.subtitle}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="text-xs uppercase tracking-widest px-3 py-1.5 rounded border transition-colors disabled:opacity-50"
                style={{ borderColor: accentColor, color: accentColor, background: `${accentColor}12` }}
                data-testid={`btn-save-${ritual.key}`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  try { setItems(JSON.parse(ritual.items)); } catch { setItems([]); }
                  setTitle(ritual.title);
                  setSubtitle(ritual.subtitle ?? "");
                }}
                className="text-xs uppercase tracking-widest px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`btn-cancel-${ritual.key}`}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border/50 hover:border-foreground/40 rounded px-2.5 py-1.5 flex items-center gap-1 transition-colors"
              data-testid={`btn-edit-${ritual.key}`}
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
        </div>
      </div>

      <ol className="space-y-3 mt-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3 group">
            <div
              className="shrink-0 num-display text-sm mt-0.5 opacity-60"
              style={{ color: accentColor, minWidth: 24 }}
            >
              {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][i] ?? `${i + 1}`}
            </div>
            {editing ? (
              <div className="flex-1 flex items-start gap-2">
                <textarea
                  value={it}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = e.target.value;
                    setItems(next);
                  }}
                  rows={2}
                  className="flex-1 bg-transparent border border-border/40 focus:border-foreground/50 focus:outline-none rounded p-2 text-sm resize-none"
                  data-testid={`input-item-${ritual.key}-${i}`}
                />
                <button
                  onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  className="w-8 h-8 rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors flex items-center justify-center"
                  aria-label="Remove item"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="text-sm md:text-base flex-1"
                style={{ color: "hsl(38 15% 88%)", lineHeight: 1.6 }}
              >
                {it}
              </div>
            )}
          </li>
        ))}
      </ol>

      {editing && (
        <button
          onClick={() => setItems([...items, ""])}
          className="mt-4 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1.5 border border-dashed border-border/50 hover:border-foreground/40 rounded px-3 py-2 transition-colors"
          data-testid={`btn-add-item-${ritual.key}`}
        >
          <Plus className="w-3.5 h-3.5" /> Add another line
        </button>
      )}
    </div>
  );
}

/* ==========================================================================
 * GRATITUDE CARD — 3 prompts with confetti on complete
 * ========================================================================== */
function GratitudeCard({
  today, log, onSaved,
}: {
  today: string;
  log: DailyLog | undefined;
  onSaved: () => void;
}) {
  const [g1, setG1] = useState(log?.gratitude1 ?? "");
  const [g3, setG3] = useState(log?.gratitude3 ?? "");
  const [gp, setGp] = useState(log?.gratitudePossession ?? "");
  const [saving, setSaving] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    setG1(log?.gratitude1 ?? "");
    setG3(log?.gratitude3 ?? "");
    setGp(log?.gratitudePossession ?? "");
  }, [log?.gratitude1, log?.gratitude3, log?.gratitudePossession]);

  const allFilledBefore = !!(log?.gratitude1?.trim() && log?.gratitude3?.trim() && log?.gratitudePossession?.trim());
  const allFilledNow = !!(g1.trim() && g3.trim() && gp.trim());

  async function save() {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/logs/${today}`, {
        gratitude1: g1,
        gratitude3: g3,
        gratitudePossession: gp,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      // Fire celebration only if user JUST completed all three (they weren't all filled before but now are)
      if (!allFilledBefore && allFilledNow) {
        setConfettiKey((k) => k + 1);
        playSound("sparkle");
        setJustCompleted(true);
        setTimeout(() => setJustCompleted(false), 3000);
      } else {
        playSound("check");
      }
      onSaved();
    } catch {
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const filled = [g1, g3, gp].filter((v) => v.trim()).length;

  return (
    <>
      <Confetti trigger={confettiKey} />
      <div className="card-lux p-6 md:p-8 relative overflow-hidden" data-testid="gratitude-card">
        {/* Subtle amber glow when all filled */}
        {allFilledNow && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: "radial-gradient(circle at 50% 50%, hsl(38 60% 40% / 0.15), transparent 70%)",
            }}
          />
        )}
        <div className="relative">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center gap-3">
              <Sparkles
                className="w-5 h-5"
                style={{ color: allFilledNow ? "hsl(38 75% 60%)" : "hsl(38 40% 55%)" }}
              />
              <div>
                <div className="microlabel">Morning Gratitude</div>
                <div
                  className="serif text-xl md:text-2xl uppercase mt-1"
                  style={{ letterSpacing: "0.08em", color: "hsl(38 25% 92%)" }}
                >
                  Three Anchors
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="num-display" style={{ color: "hsl(38 65% 55%)" }}>{filled}</span> / 3
            </div>
          </div>
          {justCompleted && (
            <div
              className="text-xs uppercase tracking-widest mb-3 py-1.5 px-3 rounded inline-block"
              style={{ background: "hsl(38 60% 40% / 0.15)", color: "hsl(38 80% 65%)" }}
            >
              ✦ Gratitude locked in
            </div>
          )}

          <div className="space-y-4">
            <GratitudePrompt
              label="I. What is #1 thing you're most grateful for right now?"
              value={g1}
              onChange={setG1}
              testId="input-g1"
            />
            <GratitudePrompt
              label="II. List 3 things you're grateful for right now."
              value={g3}
              onChange={setG3}
              multiline
              testId="input-g3"
            />
            <GratitudePrompt
              label="III. One possession you take for granted."
              value={gp}
              onChange={setGp}
              testId="input-gp"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="mt-5 text-xs uppercase tracking-widest px-4 py-2 rounded border transition-colors disabled:opacity-50"
            style={{
              borderColor: "hsl(38 65% 55%)",
              color: "hsl(38 80% 70%)",
              background: "hsl(38 60% 30% / 0.15)",
            }}
            data-testid="btn-save-gratitude"
          >
            {saving ? "Sealing…" : "Seal the anchors"}
          </button>
        </div>
      </div>
    </>
  );
}

function GratitudePrompt({
  label, value, onChange, multiline, testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  testId?: string;
}) {
  return (
    <div>
      <div className="microlabel mb-1.5" style={{ letterSpacing: "0.2em" }}>{label}</div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full bg-secondary/30 border border-border/50 focus:border-foreground/50 focus:outline-none rounded p-3 text-sm text-foreground resize-none"
          placeholder="Write freely…"
          data-testid={testId}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-secondary/30 border border-border/50 focus:border-foreground/50 focus:outline-none rounded p-3 text-sm text-foreground"
          placeholder="Write freely…"
          data-testid={testId}
        />
      )}
    </div>
  );
}

/* ==========================================================================
 * GOAL HERO CARDS — 12-month + 90-day + long-term
 * ========================================================================== */
function GoalHeroCards({ goals }: { goals: Goal[] }) {
  const [editing, setEditing] = useState<null | number>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState<null | Goal["horizon"]>(null);

  const active = goals.filter((g) => g.status === "active");
  const twelveMonth = active.filter((g) => g.horizon === "twelve_month");
  const ninetyDay = active.filter((g) => g.horizon === "ninety_day");
  const longTerm = active.filter((g) => g.horizon === "long_term");

  return (
    <div className="space-y-6">
      <GoalGroup
        title="12-Month Horizons"
        subtitle="Where you're going this year."
        goals={twelveMonth}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        setSaving={setSaving}
        onCreate={() => setCreating("twelve_month")}
        creating={creating === "twelve_month"}
        setCreating={(v) => setCreating(v ? "twelve_month" : null)}
        horizon="twelve_month"
        accent="hsl(38 75% 60%)"
      />
      <GoalGroup
        title="90-Day Milestones"
        subtitle="What proves you're on track."
        goals={ninetyDay}
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        setSaving={setSaving}
        onCreate={() => setCreating("ninety_day")}
        creating={creating === "ninety_day"}
        setCreating={(v) => setCreating(v ? "ninety_day" : null)}
        horizon="ninety_day"
        accent="hsl(30 65% 55%)"
      />
      {longTerm.length > 0 && (
        <GoalGroup
          title="Long Game"
          subtitle="The horizon beyond a year."
          goals={longTerm}
          editing={editing}
          setEditing={setEditing}
          saving={saving}
          setSaving={setSaving}
          onCreate={() => setCreating("long_term")}
          creating={creating === "long_term"}
          setCreating={(v) => setCreating(v ? "long_term" : null)}
          horizon="long_term"
          accent="hsl(40 15% 88%)"
        />
      )}
    </div>
  );
}

function GoalGroup({
  title, subtitle, goals, editing, setEditing, saving, setSaving,
  creating, setCreating, onCreate, horizon, accent,
}: {
  title: string;
  subtitle: string;
  goals: Goal[];
  editing: number | null;
  setEditing: (v: number | null) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  creating: boolean;
  setCreating: (v: boolean) => void;
  onCreate: () => void;
  horizon: Goal["horizon"];
  accent: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <div>
          <div
            className="serif uppercase text-lg md:text-xl"
            style={{ letterSpacing: "0.15em", color: accent }}
          >
            {title}
          </div>
          <div className="text-xs text-muted-foreground mt-1" style={{ letterSpacing: "0.1em" }}>{subtitle}</div>
        </div>
        <button
          onClick={onCreate}
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border/50 hover:border-foreground/40 rounded px-3 py-1.5 flex items-center gap-1.5 transition-colors"
          data-testid={`btn-new-goal-${horizon}`}
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      {goals.length === 0 && !creating && (
        <div
          className="rounded border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground"
          style={{ background: "hsl(0 0% 100% / 0.02)" }}
        >
          No {title.toLowerCase()} yet. Add one to make it official.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {creating && (
          <NewGoalCard
            horizon={horizon}
            accent={accent}
            onDone={() => setCreating(false)}
          />
        )}
        {goals.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            accent={accent}
            editing={editing === g.id}
            saving={saving}
            onEdit={() => setEditing(g.id)}
            onCancel={() => setEditing(null)}
            onSave={async (patch) => {
              setSaving(true);
              try {
                await apiRequest("PATCH", `/api/goals/${g.id}`, patch);
                await queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
                setEditing(null);
                playSound("check");
              } catch { alert("Save failed."); }
              finally { setSaving(false); }
            }}
            onDelete={async () => {
              if (!confirm("Delete this goal?")) return;
              setSaving(true);
              try {
                await apiRequest("DELETE", `/api/goals/${g.id}`);
                await queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
              } catch { alert("Delete failed."); }
              finally { setSaving(false); }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NewGoalCard({
  horizon, accent, onDone,
}: {
  horizon: Goal["horizon"];
  accent: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", `/api/goals`, {
        title: title.trim(),
        detail: detail.trim() || undefined,
        horizon,
        category: "personal",
        progress: 0,
        status: "active",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      playSound("flourish");
      onDone();
    } catch { alert("Save failed."); }
    finally { setSaving(false); }
  }

  return (
    <div
      className="card-lux p-5 border-dashed"
      style={{ borderColor: `${accent}80` }}
    >
      <div className="microlabel mb-3" style={{ color: accent }}>New Goal</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Goal title"
        autoFocus
        className="w-full bg-secondary/30 border border-border/40 focus:border-foreground/50 focus:outline-none rounded p-2 text-sm mb-2"
        data-testid="input-new-goal-title"
      />
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Why this matters (optional)"
        rows={2}
        className="w-full bg-secondary/30 border border-border/40 focus:border-foreground/50 focus:outline-none rounded p-2 text-sm resize-none"
      />
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={onDone}
          className="text-xs uppercase tracking-widest px-3 py-1.5 rounded border border-border text-muted-foreground"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!title.trim() || saving}
          className="text-xs uppercase tracking-widest px-3 py-1.5 rounded border disabled:opacity-40"
          style={{ borderColor: accent, color: accent, background: `${accent}12` }}
          data-testid="btn-save-new-goal"
        >
          {saving ? "Saving…" : "Enshrine"}
        </button>
      </div>
    </div>
  );
}

function GoalCard({
  goal, accent, editing, saving, onEdit, onCancel, onSave, onDelete,
}: {
  goal: Goal;
  accent: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (patch: Partial<Goal>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(goal.title);
  const [detail, setDetail] = useState(goal.detail ?? "");
  const [progress, setProgress] = useState(goal.progress);
  const [targetDate, setTargetDate] = useState(goal.targetDate ?? "");

  useEffect(() => {
    setTitle(goal.title);
    setDetail(goal.detail ?? "");
    setProgress(goal.progress);
    setTargetDate(goal.targetDate ?? "");
  }, [goal.id, goal.title, goal.detail, goal.progress, goal.targetDate]);

  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;

  return (
    <div
      className="card-lux p-5 relative overflow-hidden group"
      data-testid={`goal-card-${goal.id}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: `radial-gradient(400px 200px at 100% 0%, ${accent}22, transparent)`,
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="serif text-lg md:text-xl uppercase bg-transparent border-b border-border/40 focus:border-foreground/60 focus:outline-none py-1 w-full"
                style={{ letterSpacing: "0.05em", color: "hsl(38 25% 92%)" }}
              />
            ) : (
              <div
                className="serif text-lg md:text-xl uppercase break-words"
                style={{ letterSpacing: "0.05em", color: "hsl(38 25% 92%)", lineHeight: 1.2 }}
              >
                {goal.title}
              </div>
            )}
            {goal.targetDate && !editing && (
              <div className="text-[11px] text-muted-foreground uppercase tracking-widest mt-1.5">
                by {new Date(goal.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>

          {/* Radial progress ring */}
          <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r={r} stroke="hsl(0 0% 100% / 0.08)" strokeWidth="3" fill="none" />
              <circle
                cx="40" cy="40" r={r}
                stroke={accent}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 400ms ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="num-display text-lg" style={{ color: accent }}>
                {progress}<span className="text-xs opacity-60">%</span>
              </span>
            </div>
          </div>
        </div>

        {editing ? (
          <>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Why this matters"
              rows={2}
              className="w-full bg-secondary/30 border border-border/40 focus:border-foreground/50 focus:outline-none rounded p-2 text-sm resize-none mb-3"
            />
            <div className="flex items-center gap-2 mb-3">
              <span className="microlabel shrink-0">Target</span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="flex-1 bg-secondary/30 border border-border/40 focus:border-foreground/50 focus:outline-none rounded p-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="microlabel shrink-0">Progress</span>
              <input
                type="range"
                min={0} max={100} step={5}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="num-display text-sm w-10 text-right" style={{ color: accent }}>{progress}%</span>
            </div>
          </>
        ) : (
          goal.detail && (
            <div className="text-sm text-muted-foreground mt-2 leading-relaxed" style={{ letterSpacing: "0.02em" }}>
              {goal.detail}
            </div>
          )
        )}

        {/* Progress bar under card */}
        {!editing && (
          <div className="h-1 rounded-full bg-secondary/40 mt-4 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${accent}80, ${accent})`,
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {goal.category}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={onDelete}
                  className="text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive"
                >
                  Delete
                </button>
                <button
                  onClick={onCancel}
                  className="text-xs uppercase tracking-widest px-2.5 py-1 rounded border border-border text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onSave({ title, detail, progress, targetDate: targetDate || null })}
                  disabled={saving}
                  className="text-xs uppercase tracking-widest px-2.5 py-1 rounded border disabled:opacity-40"
                  style={{ borderColor: accent, color: accent, background: `${accent}15` }}
                  data-testid={`btn-save-goal-${goal.id}`}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <button
                onClick={onEdit}
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1"
                data-testid={`btn-edit-goal-${goal.id}`}
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * DAILY INDICATORS TABLE — Notion-style 7-day rolling
 * ========================================================================== */
function DailyIndicatorsTable({
  logs, today,
}: {
  logs: DailyLog[];
  today: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -6 + i));
  const habitsToShow = HABITS.filter((h) => h.key !== "sleepScore"); // sleepScore rarely tracked

  function label(dStr: string) {
    const d = new Date(dStr + "T00:00:00");
    return { dow: d.toLocaleDateString("en-US", { weekday: "short" }), day: d.getDate() };
  }

  return (
    <div className="card-lux p-4 md:p-6 overflow-x-auto" data-testid="daily-indicators">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="microlabel">Last 7 Days</div>
          <div className="serif text-xl md:text-2xl uppercase mt-1" style={{ letterSpacing: "0.08em" }}>
            The Ledger
          </div>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest">
          Habits × Days
        </div>
      </div>
      <table className="w-full text-sm border-collapse min-w-[640px]">
        <thead>
          <tr>
            <th className="text-left microlabel pb-2 pr-3" style={{ minWidth: 140 }}></th>
            {days.map((d) => {
              const { dow, day } = label(d);
              const isToday = d === today;
              return (
                <th
                  key={d}
                  className="text-center pb-3 px-1"
                  style={{ color: isToday ? "hsl(38 75% 60%)" : "hsl(38 30% 60%)" }}
                >
                  <div className="microlabel">{dow}</div>
                  <div className="num-display text-base mt-1">{day}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {habitsToShow.map((h) => (
            <tr key={h.key} className="border-t border-border/20">
              <td className="py-2 pr-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-foreground/80">
                  <span>{h.emoji}</span>
                  <span>{h.label}</span>
                </div>
              </td>
              {days.map((d) => {
                const log = logs.find((l) => l.date === d);
                const hit = habitHit(log, h);
                const isToday = d === today;
                if (h.kind === "num") {
                  const v = log ? (log as any)[h.key] : null;
                  return (
                    <td key={d} className="text-center py-2 px-1">
                      <div
                        className="num-display text-sm mx-auto"
                        style={{
                          color: v == null ? "hsl(0 0% 30%)" : hit ? "hsl(140 45% 60%)" : "hsl(0 0% 55%)",
                        }}
                      >
                        {v == null ? "—" : v}
                      </div>
                    </td>
                  );
                }
                return (
                  <td key={d} className="text-center py-2 px-1">
                    <div
                      className="mx-auto w-6 h-6 rounded flex items-center justify-center"
                      style={{
                        background: hit ? "hsl(38 60% 45%)" : "hsl(0 0% 100% / 0.04)",
                        border: `1px solid ${isToday ? "hsl(38 60% 55%)" : "hsl(0 0% 100% / 0.08)"}`,
                      }}
                    >
                      {hit && <Check className="w-3.5 h-3.5" style={{ color: "hsl(0 0% 5%)" }} strokeWidth={3} />}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ==========================================================================
 * THIRTY DAY SUMMARY — proof tiles
 * ========================================================================== */
function ThirtyDaySummary({
  logs, today,
}: {
  logs: DailyLog[];
  today: string;
}) {
  const rate30 = completionRate(logs, today, 30);
  const rate7 = completionRate(logs, today, 7);

  // Perfect days = day score >= 90%
  const perfectDays = useMemo(() => {
    let c = 0;
    for (let i = 0; i < 30; i++) {
      const l = logs.find((x) => x.date === addDays(today, -i));
      if (l && dayScore(l) >= 0.9) c++;
    }
    return c;
  }, [logs, today]);

  const workoutCount = useMemo(() => {
    let c = 0;
    for (let i = 0; i < 30; i++) {
      const l = logs.find((x) => x.date === addDays(today, -i));
      if (l?.workout === 1) c++;
    }
    return c;
  }, [logs, today]);

  const avgFasting = useMemo(() => {
    let sum = 0, n = 0;
    for (let i = 0; i < 30; i++) {
      const l = logs.find((x) => x.date === addDays(today, -i));
      if (l?.fastingHours != null) { sum += l.fastingHours; n++; }
    }
    return n > 0 ? sum / n : null;
  }, [logs, today]);

  const soberDays = useMemo(() => {
    let c = 0;
    for (let i = 0; i < 30; i++) {
      const l = logs.find((x) => x.date === addDays(today, -i));
      if (l?.noAlcohol === 1) c++;
    }
    return c;
  }, [logs, today]);

  return (
    <div className="card-lux p-6 md:p-8" data-testid="thirty-day-summary">
      <div className="flex items-baseline justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="microlabel">Last 30 Days</div>
          <div className="serif text-xl md:text-2xl uppercase mt-1" style={{ letterSpacing: "0.08em" }}>
            The Proof
          </div>
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-widest">
          {Math.round(rate30 * 100)}% overall
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ProofTile label="Perfect Days" value={perfectDays} unit="/ 30" accent="hsl(38 75% 60%)" />
        <ProofTile label="Workouts" value={workoutCount} unit="lifts" accent="hsl(30 65% 55%)" />
        <ProofTile
          label="Avg Fast"
          value={avgFasting != null ? avgFasting.toFixed(1) : "—"}
          unit={avgFasting != null ? "hrs" : ""}
          accent="hsl(40 15% 88%)"
        />
        <ProofTile label="Sober Days" value={soberDays} unit="/ 30" accent="hsl(38 60% 65%)" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="text-sm">
          <div className="microlabel">Last 7 days</div>
          <div className="num-display text-2xl mt-1" style={{ color: "hsl(38 70% 60%)" }}>
            {Math.round(rate7 * 100)}%
          </div>
        </div>
        <div className="text-sm">
          <div className="microlabel">Last 30 days</div>
          <div className="num-display text-2xl mt-1" style={{ color: "hsl(38 70% 60%)" }}>
            {Math.round(rate30 * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofTile({
  label, value, unit, accent,
}: {
  label: string;
  value: number | string;
  unit?: string;
  accent: string;
}) {
  return (
    <div
      className="rounded p-4 border relative overflow-hidden"
      style={{
        borderColor: "hsl(0 0% 100% / 0.06)",
        background: "hsl(0 0% 100% / 0.02)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{ background: `radial-gradient(200px at 100% 0%, ${accent}22, transparent 70%)` }}
      />
      <div className="relative">
        <div className="microlabel" style={{ color: accent, opacity: 0.8 }}>{label}</div>
        <div className="flex items-baseline gap-2 mt-2">
          <div className="num-display text-3xl md:text-4xl" style={{ color: accent }}>{value}</div>
          {unit && <div className="text-xs text-muted-foreground uppercase tracking-widest">{unit}</div>}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * PAGE
 * ========================================================================== */
export default function MorningAlignment() {
  const today = useToday();
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });
  const { data: rituals = [] } = useQuery<Ritual[]>({ queryKey: ["/api/rituals"] });
  const { data: challenges = [] } = useQuery<Challenge[]>({ queryKey: ["/api/challenges"] });

  const activeChallenge = useMemo(() => {
    const active = challenges.find((c) => today >= c.startDate && today <= c.endDate);
    return active ?? challenges[0];
  }, [challenges, today]);

  const todayLog = logs.find((l) => l.date === today);
  const streak = overallStreak(logs, today);

  const whyRitual = rituals.find((r) => r.key === "why");
  const questionsRitual = rituals.find((r) => r.key === "questions");
  const codeRitual = rituals.find((r) => r.key === "code");

  return (
    <>
      <Awakening />
      <MilestoneCelebration streak={streak} />
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-10 space-y-8 md:space-y-10">
        {/* HERO */}
        <MorningHero logs={logs} today={today} challenge={activeChallenge} />

        {/* YESTERDAY + WEEK STRIP */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          <YesterdayVerdict logs={logs} today={today} challenge={activeChallenge} />
          <WeekChain logs={logs} today={today} challenge={activeChallenge} />
        </div>

        <Fleuron size={30} className="my-4" />

        {/* GRATITUDE */}
        <GratitudeCard today={today} log={todayLog} onSaved={() => {}} />

        {/* RITUALS: WHY / QUESTIONS / CODE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {whyRitual && (
            <RitualSection
              ritual={whyRitual}
              icon={<Flame className="w-5 h-5" />}
              onSaved={() => {}}
              accentColor="hsl(38 75% 55%)"
            />
          )}
          {questionsRitual && (
            <RitualSection
              ritual={questionsRitual}
              icon={<ChevronRight className="w-5 h-5" />}
              onSaved={() => {}}
              accentColor="hsl(30 55% 55%)"
            />
          )}
        </div>
        {codeRitual && (
          <RitualSection
            ritual={codeRitual}
            icon={<ShieldCheck className="w-5 h-5" />}
            onSaved={() => {}}
            accentColor="hsl(40 15% 88%)"
          />
        )}

        <Fleuron size={30} className="my-4" />

        {/* GOALS */}
        <div>
          <div className="mb-6">
            <div className="microlabel" style={{ letterSpacing: "0.4em" }}>— The Future —</div>
            <div
              className="serif-hero uppercase mt-2"
              style={{ fontSize: "clamp(28px, 3.5vw, 44px)", color: "hsl(38 25% 92%)", letterSpacing: "0.04em" }}
            >
              Goals & Horizons
            </div>
          </div>
          <GoalHeroCards goals={goals} />
        </div>

        <Fleuron size={30} className="my-4" />

        {/* PROOF SECTION — 30-day summary first (compact), then full-width Ledger */}
        <ThirtyDaySummary logs={logs} today={today} />
        <DailyIndicatorsTable logs={logs} today={today} />
      </div>
    </>
  );
}
