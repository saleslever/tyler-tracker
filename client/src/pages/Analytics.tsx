/**
 * OVERVIEW — Atlas parchment dashboard.
 *
 * Restored framework metrics (goal countdown, projection, weight trend,
 * weekly deltas, silhouette, fasting, sober, calories, steps, protein hits,
 * workouts this week) presented inside the parchment mockup shell.
 *
 * NO invented data. Every number comes from /api/fitness/dashboard.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp, Target, Flame, Footprints, Wine, Timer, Utensils, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Dashboard {
  today: string;
  goal: { startWeight: number; currentWeight: number; targetWeight: number; targetDate: string; totalLost: number; remaining: number; daysToTarget: number };
  projection: { requiredPerWeek: number; actualPerWeek: number; projectedDate: string | null; onTrack: boolean };
  weeklyDeltas: { week: string; weight: number; delta: number }[];
  mergedWeights: { date: string; weight: number }[];
  bodyPartSets: Record<string, number>;
  bodyPartTargets: Record<string, number>;
  fasting: { current: number | null; longest: number; average: number; totalCount: number };
  daysSober: number;
  weeklyCalories: { week: string; total: number; dailyAvg: number }[];
  stepSeries: { date: string; steps: number; hit10k: boolean }[];
  avgSteps: number;
  proteinHits14: { date: string; hit: boolean }[];
  workoutsThisWeek: number;
}

export default function Analytics() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["/api/fitness/dashboard"],
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="parchment min-h-screen p-6 pb-24">
        <div className="text-xs tracking-widest uppercase text-muted-foreground">Loading Atlas…</div>
      </div>
    );
  }

  const today = new Date();
  const proteinHitsCount = data.proteinHits14.filter(p => p.hit).length;

  return (
    <div className="parchment min-h-screen pb-24">
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 space-y-4">

        {/* Header — matches "OVERVIEW / ALL THAT STANDS BETWEEN YOU AND GREATNESS IS DISCIPLINE" */}
        <header className="pb-2">
          <h1 className="font-display text-4xl md:text-5xl font-black tracking-tight leading-none">
            OVERVIEW
          </h1>
          <p className="mt-2 text-[10px] md:text-xs tracking-[0.24em] uppercase text-primary font-semibold">
            All that stands between you and greatness is discipline.
          </p>
          <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left/Center column — the framework metrics */}
          <div className="lg:col-span-2 space-y-4">

            {/* Goal countdown hero — Lost / Current / To Go */}
            <div className="ornament-panel">
              <div className="section-title mb-4">Goal Countdown</div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Lost" value={`${data.goal.totalLost.toFixed(1)}`} unit="lb" tone={data.goal.totalLost > 0 ? "green" : "neutral"} />
                <Stat label="Current" value={`${data.goal.currentWeight.toFixed(1)}`} unit="lb" />
                <Stat label="To Go" value={`${data.goal.remaining.toFixed(1)}`} unit="lb" tone="accent" />
              </div>
              <div className="mt-4 h-2 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (data.goal.totalLost / (data.goal.startWeight - data.goal.targetWeight)) * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] tracking-widest uppercase text-muted-foreground">
                <span>{data.goal.startWeight.toFixed(1)} lb start</span>
                <span className="text-primary font-semibold">{data.goal.daysToTarget} days left</span>
                <span>{data.goal.targetWeight} lb goal</span>
              </div>
            </div>

            {/* Projection card — actual vs required lb/wk */}
            <div className={cn("ornament-panel", data.projection.onTrack ? "!border-green-600/30" : "!border-primary/40")}>
              <div className="flex items-center gap-2 mb-3">
                <Target className={cn("w-4 h-4", data.projection.onTrack ? "text-green-700" : "text-primary")} />
                <span className="text-[10px] tracking-[0.24em] uppercase font-semibold">
                  {data.projection.onTrack ? "On Track" : "Push Harder"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Actual rate</div>
                  <div className="font-display font-black text-2xl">
                    {data.projection.actualPerWeek > 0 ? `-${data.projection.actualPerWeek.toFixed(2)}` : "—"}
                    <span className="text-xs font-normal ml-1 opacity-70">lb/wk</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Required</div>
                  <div className="font-display font-black text-2xl">
                    -{data.projection.requiredPerWeek.toFixed(2)}
                    <span className="text-xs font-normal ml-1 opacity-70">lb/wk</span>
                  </div>
                </div>
              </div>
              {data.projection.projectedDate && (
                <div className="mt-3 text-xs text-muted-foreground">
                  At this pace you hit <span className="text-foreground font-semibold">{data.projection.projectedDate}</span>
                  {" · "}
                  <span className={cn("font-semibold", data.projection.onTrack ? "text-green-700" : "text-primary")}>
                    {data.projection.onTrack ? "ahead of target." : "behind target."}
                  </span>
                </div>
              )}
            </div>

            {/* Weight trend + weekly deltas side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ornament-panel">
                <div className="section-title mb-4">Weight Trend</div>
                <WeightChart series={data.mergedWeights} targetWeight={data.goal.targetWeight} />
              </div>
              <div className="ornament-panel">
                <div className="section-title mb-4">Week Over Week</div>
                <div className="space-y-2">
                  {data.weeklyDeltas.slice(-6).reverse().map(w => (
                    <div key={w.week} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-mono text-xs">{w.week}</span>
                      <span className="font-semibold">{w.weight.toFixed(1)} lb</span>
                      <span className={cn(
                        "flex items-center gap-1 font-mono text-xs w-16 justify-end",
                        w.delta < 0 ? "text-green-700" : w.delta > 0 ? "text-primary" : "text-muted-foreground"
                      )}>
                        {w.delta < 0 ? <TrendingDown className="w-3 h-3" /> : w.delta > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                        {w.delta > 0 ? "+" : ""}{w.delta.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Body-part sets silhouette + status grid */}
            <div className="ornament-panel">
              <div className="section-title mb-4">This Week's Sets</div>
              <BodySilhouette sets={data.bodyPartSets} targets={data.bodyPartTargets} />
            </div>

            {/* Weekly calories */}
            <div className="ornament-panel">
              <div className="section-title mb-4">Calorie Intake</div>
              {data.weeklyCalories.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Log macros to see weekly totals.</div>
              ) : (
                <div className="space-y-2">
                  {data.weeklyCalories.slice().reverse().map(w => (
                    <div key={w.week} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-mono text-xs">{w.week}</span>
                      <span className="font-mono">{w.total.toLocaleString()} <span className="text-[10px] opacity-60">total</span></span>
                      <span className={cn("font-semibold", w.dailyAvg >= 1800 && w.dailyAvg <= 2100 ? "text-green-700" : "text-primary")}>
                        {w.dailyAvg.toLocaleString()}
                        <span className="text-[10px] font-normal ml-1 opacity-60">/day</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Steps last 14 days */}
            <div className="ornament-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="section-title">Steps</div>
                <div className="text-xs text-muted-foreground">
                  Avg <span className="text-foreground font-semibold">{data.avgSteps.toLocaleString()}</span>
                </div>
              </div>
              {data.stepSeries.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">No step data yet.</div>
              ) : (
                <>
                  <div className="flex items-end gap-1 h-24">
                    {data.stepSeries.map(s => (
                      <div key={s.date} className="flex-1 flex flex-col justify-end group">
                        <div
                          className={cn("w-full rounded-t transition-all", s.hit10k ? "bg-green-700" : s.steps > 0 ? "bg-primary/50" : "bg-secondary/40")}
                          style={{ height: `${Math.min(100, (s.steps / 15000) * 100)}%`, minHeight: s.steps > 0 ? 4 : 0 }}
                          title={`${s.steps.toLocaleString()} steps · ${s.date}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] tracking-widest uppercase text-muted-foreground mt-2">
                    <span>{data.stepSeries[0]?.date.slice(5)}</span>
                    <span>10K target</span>
                    <span>Today</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right sidebar — Fasting + Sober + Workouts + Protein + This Week's Calendar */}
          <div className="space-y-4">

            <div className="ornament-panel">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="w-4 h-4 text-primary" />
                <span className="text-[10px] tracking-[0.24em] uppercase font-semibold">Fasting</span>
              </div>
              <div className="space-y-2 text-sm">
                <FastStat label="Now" value={data.fasting.current != null ? `${data.fasting.current.toFixed(1)}h` : "—"} highlight={data.fasting.current != null && data.fasting.current >= 16} />
                <FastStat label="Longest" value={`${data.fasting.longest.toFixed(1)}h`} />
                <FastStat label="Avg" value={`${data.fasting.average.toFixed(1)}h`} />
                <FastStat label="Total" value={`${data.fasting.totalCount}`} />
              </div>
            </div>

            <div className="ornament-panel">
              <div className="flex items-center gap-2 mb-3">
                <Wine className="w-4 h-4 text-primary line-through" />
                <span className="text-[10px] tracking-[0.24em] uppercase font-semibold">Sober</span>
              </div>
              <div className="font-display font-black text-5xl text-center leading-none">{data.daysSober}</div>
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1 text-center">days clean</div>
            </div>

            <div className="ornament-panel">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="w-4 h-4 text-primary" />
                <span className="text-[10px] tracking-[0.24em] uppercase font-semibold">This Week</span>
              </div>
              <div className="font-display font-black text-4xl leading-none">{data.workoutsThisWeek}</div>
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1">of 4 workouts</div>
            </div>

            <div className="ornament-panel">
              <div className="flex items-center gap-2 mb-2">
                <Utensils className="w-4 h-4 text-primary" />
                <span className="text-[10px] tracking-[0.24em] uppercase font-semibold">Protein Hits</span>
              </div>
              <div className="font-display font-black text-4xl leading-none">
                {proteinHitsCount}
                <span className="text-xl opacity-50">/{data.proteinHits14.length || 14}</span>
              </div>
              <div className="text-[10px] tracking-widest uppercase text-muted-foreground mt-1">14 days · 200g+</div>
            </div>

            <div className="ornament-panel">
              <div className="section-title mb-3">This Week</div>
              <CalendarStrip today={today} weights={data.mergedWeights} />
            </div>

            <div className="text-center py-2">
              <div className="font-display text-lg tracking-widest uppercase text-primary font-bold">
                Discipline<br />Equals Freedom
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small stat cell ───
function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: "green" | "accent" | "neutral" }) {
  return (
    <div>
      <div className="text-[9px] tracking-widest uppercase text-muted-foreground mb-1">{label}</div>
      <div className={cn(
        "font-display font-black text-2xl md:text-3xl leading-none",
        tone === "green" && "text-green-700",
        tone === "accent" && "text-primary",
      )}>
        {value}<span className="text-xs font-normal ml-1 opacity-70">{unit}</span>
      </div>
    </div>
  );
}

function FastStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[10px] tracking-widest uppercase text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", highlight && "text-green-700")}>{value}</span>
    </div>
  );
}

// ─── Weight chart SVG ───
function WeightChart({ series, targetWeight }: { series: { date: string; weight: number }[]; targetWeight: number }) {
  const chart = useMemo(() => {
    if (series.length === 0) return null;
    const min = Math.min(...series.map(s => s.weight), targetWeight) - 2;
    const max = Math.max(...series.map(s => s.weight)) + 2;
    const range = max - min;
    const W = 320, H = 140, P = 8;
    const iw = W - P * 2, ih = H - P * 2;
    const points = series.map((s, i) => {
      const x = P + (i / Math.max(1, series.length - 1)) * iw;
      const y = P + ((max - s.weight) / range) * ih;
      return { x, y, ...s };
    });
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const targetY = P + ((max - targetWeight) / range) * ih;
    return { path, points, targetY, W, H };
  }, [series, targetWeight]);

  if (!chart) return <div className="text-xs text-muted-foreground text-center py-6">No weight data yet.</div>;
  return (
    <svg viewBox={`0 0 ${chart.W} ${chart.H}`} className="w-full h-32">
      {/* Target line */}
      <line x1={0} x2={chart.W} y1={chart.targetY} y2={chart.targetY} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeWidth={1} opacity={0.5} />
      <text x={chart.W - 4} y={chart.targetY - 3} fontSize="8" textAnchor="end" fill="hsl(var(--primary))" opacity={0.7}>
        {targetWeight}
      </text>
      {/* Line */}
      <path d={chart.path} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.5} />
      {/* Points */}
      {chart.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={1.5} fill="hsl(var(--primary))" />
      ))}
    </svg>
  );
}

// ─── Body silhouette with per-part set counts ───
function BodySilhouette({ sets, targets }: { sets: Record<string, number>; targets: Record<string, number> }) {
  const legend = (part: string) => {
    const s = sets[part] ?? 0;
    const t = targets[part] ?? 18;
    return `${s}/${t}`;
  };

  function statusColor(part: string): { dot: string; text: string; bg: string; label: string } {
    const s = sets[part] ?? 0;
    const t = targets[part] ?? 18;
    if (s === 0) return { dot: "hsl(var(--muted-foreground) / 0.4)", text: "text-muted-foreground", bg: "bg-muted/50", label: "NONE" };
    if (s >= t) return { dot: "hsl(140 55% 42%)", text: "text-green-700 dark:text-green-500", bg: "bg-green-500/10", label: "HIT" };
    if (s >= t * 0.66) return { dot: "hsl(38 80% 45%)", text: "text-[#8B6F3E]", bg: "bg-[#8B6F3E]/10", label: "NEAR" };
    return { dot: "hsl(var(--primary))", text: "text-primary", bg: "bg-primary/10", label: "UNDER" };
  }

  const groups: Array<[string, string]> = [
    ["shoulders", "Shoulders"],
    ["chest", "Chest"],
    ["back", "Back"],
    ["biceps", "Biceps"],
    ["triceps", "Triceps"],
    ["legs", "Legs"],
    ["abs", "Abs"],
  ];

  return (
    <div className="space-y-4">
      {/* Anatomical figures — front + back photographic renders */}
      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        <div className="flex flex-col items-center">
          <img src="/body-front.png" alt="Front anatomy" className="h-56 md:h-72 object-contain" />
          <div className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1">Front</div>
        </div>
        <div className="flex flex-col items-center">
          <img src="/body-back.png" alt="Back anatomy" className="h-56 md:h-72 object-contain" />
          <div className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1">Back</div>
        </div>
      </div>

      {/* Muscle status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {groups.map(([k, label]) => {
          const c = statusColor(k);
          return (
            <div key={k} className={cn("rounded-lg border border-border/60 p-2.5", c.bg)}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
                <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
              </div>
              <div className={cn("font-mono text-lg font-bold", c.text)}>{legend(k)}</div>
              <div className={cn("text-[9px] uppercase tracking-wider font-bold", c.text)}>{c.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── This week strip (Sun-Sat) — highlights today and days with a weigh-in ───
function CalendarStrip({ today, weights }: { today: Date; weights: { date: string; weight: number }[] }) {
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const todayStr = today.toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map(d => {
        const iso = d.toISOString().slice(0, 10);
        const isToday = iso === todayStr;
        const hasWeigh = weights.some(w => w.date === iso);
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 1);
        return (
          <div key={iso} className={cn(
            "flex flex-col items-center justify-center rounded p-1 border",
            isToday
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background/40 border-border"
          )}>
            <div className={cn("text-[9px] tracking-widest font-semibold", isToday ? "opacity-80" : "text-muted-foreground")}>
              {dayLabel}
            </div>
            <div className={cn("font-display font-black text-base leading-none", isToday && "text-primary-foreground")}>
              {d.getDate()}
            </div>
            <div className="mt-1 h-1.5 w-1.5 rounded-full" style={{
              background: hasWeigh
                ? (isToday ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))")
                : "transparent"
            }} />
          </div>
        );
      })}
    </div>
  );
}
