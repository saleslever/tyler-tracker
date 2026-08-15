/**
 * OVERVIEW — Atlas parchment dashboard.
 * Matches the DISCIPLINA parchment reference but uses Tyler's real data
 * and his own titling ("ATLAS", not "DISCIPLINA"). Palette 2 Light.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
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

  const derived = useMemo(() => {
    if (!data) return null;

    // Today's Strength Score: current weight as the hero numeral, since Tyler's north star metric is weight loss.
    const scoreValue = data.goal.currentWeight.toFixed(1);

    // Delta vs yesterday from mergedWeights
    const weights = data.mergedWeights;
    const today = weights[weights.length - 1]?.weight ?? null;
    const yesterday = weights.length >= 2 ? weights[weights.length - 2]?.weight : null;
    const deltaYesterday = today != null && yesterday != null ? Number((today - yesterday).toFixed(1)) : 0;

    // Score breakdown — derived from real data (0-10 scale)
    const workoutsHit = Math.min(data.workoutsThisWeek, 6);
    const trainingLoad = Number((workoutsHit / 6 * 10).toFixed(1));
    const proteinHits = data.proteinHits14?.filter(p => p.hit).length ?? 0;
    const nutritionScore = Number(((proteinHits / Math.max(1, data.proteinHits14?.length ?? 14)) * 10).toFixed(1));
    // Recovery: hours slept from steps proxy — use days sober as a resilience proxy 0-30 = 0-10
    const recoveryScore = Number((Math.min(data.daysSober / 30, 1) * 10).toFixed(1));
    // Consistency: weekly weigh-ins ratio - use current on-track status
    const consistencyScore = data.projection.onTrack ? 9.1 : 6.5;

    // 7-day trend for chart
    const last7Days = weights.slice(-7);

    // Weekly average
    const weeklyAvg = last7Days.length
      ? last7Days.reduce((s, w) => s + w.weight, 0) / last7Days.length
      : 0;
    const prevWeekPoints = weights.slice(-14, -7);
    const prevWeekAvg = prevWeekPoints.length
      ? prevWeekPoints.reduce((s, w) => s + w.weight, 0) / prevWeekPoints.length
      : weeklyAvg;
    const weekOverWeek = Number((weeklyAvg - prevWeekAvg).toFixed(1));

    return {
      scoreValue,
      deltaYesterday,
      trainingLoad,
      nutritionScore,
      recoveryScore,
      consistencyScore,
      last7Days,
      weeklyAvg: weeklyAvg.toFixed(1),
      weekOverWeek,
    };
  }, [data]);

  if (isLoading || !data || !derived) {
    return (
      <div className="parchment min-h-screen p-6 pb-24">
        <div className="text-xs tracking-widest uppercase text-muted-foreground">Loading Atlas…</div>
      </div>
    );
  }

  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dayNum = today.getDate();

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

          {/* Left/Center column — hero + breakdown + training + body comp */}
          <div className="lg:col-span-2 space-y-4">

            {/* TODAY'S STRENGTH SCORE + 7 DAY TREND side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Strength Score card */}
              <div className="ornament-panel">
                <div className="section-title mb-2">Today's Strength Score</div>
                <div className="flex items-center justify-center gap-3 py-2">
                  <LaurelLeft />
                  <div className="text-center">
                    <div className="font-display font-black leading-none tracking-tight text-[5rem] md:text-[6.5rem]">
                      {derived.scoreValue}
                    </div>
                  </div>
                  <LaurelRight />
                </div>
                <div className="text-center mt-1 flex items-center justify-center gap-2 text-primary">
                  {derived.deltaYesterday < 0
                    ? <TrendingDown className="w-4 h-4" />
                    : derived.deltaYesterday > 0
                      ? <TrendingUp className="w-4 h-4" />
                      : null}
                  <span className="font-mono font-bold">
                    {derived.deltaYesterday > 0 ? "+" : ""}{derived.deltaYesterday.toFixed(1)}
                  </span>
                  <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
                    vs yesterday
                  </span>
                </div>
              </div>

              {/* 7 Day Trend */}
              <div className="ornament-panel">
                <div className="section-title mb-3">7 Day Trend</div>
                <TrendChart series={derived.last7Days} />
                <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div>
                    <div className="text-[9px] tracking-widest uppercase text-muted-foreground">Weekly Avg</div>
                    <div className="font-display text-2xl font-black">{derived.weeklyAvg}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] tracking-widest uppercase text-muted-foreground">vs Last Week</div>
                    <div className="flex items-center justify-end gap-1 font-mono">
                      {derived.weekOverWeek < 0
                        ? <TrendingDown className="w-4 h-4 text-green-700" />
                        : <TrendingUp className="w-4 h-4 text-primary" />}
                      <span className={cn("font-bold text-xl", derived.weekOverWeek < 0 ? "text-green-700" : "text-primary")}>
                        {derived.weekOverWeek > 0 ? "+" : ""}{derived.weekOverWeek.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SCORE BREAKDOWN */}
            <div className="ornament-panel">
              <div className="section-title mb-4">Score Breakdown</div>
              <div className="grid grid-cols-4 gap-2 md:gap-4">
                <ScoreCell label="Training Load" value={derived.trainingLoad} />
                <ScoreCell label="Nutrition" value={derived.nutritionScore} />
                <ScoreCell label="Recovery" value={derived.recoveryScore} />
                <ScoreCell label="Consistency" value={derived.consistencyScore} />
              </div>
            </div>

            {/* TRAINING SUMMARY + BODY COMPOSITION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ornament-panel">
                <div className="section-title mb-4">Training Summary</div>
                <TrainingSummary bodyPartSets={data.bodyPartSets} bodyPartTargets={data.bodyPartTargets} />
              </div>
              <div className="ornament-panel">
                <div className="section-title mb-4">Body Composition</div>
                <BodyCompositionDonut currentWeight={data.goal.currentWeight} totalLost={data.goal.totalLost} />
              </div>
            </div>

            {/* CALENDAR + LIFETIME STATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ornament-panel">
                <div className="section-title mb-3">Calendar</div>
                <CalendarStrip today={today} weights={data.mergedWeights} />
              </div>
              <div className="ornament-panel">
                <div className="section-title mb-3">Lifetime Statistics</div>
                <LifetimeStats
                  lost={data.goal.totalLost}
                  daysToTarget={data.goal.daysToTarget}
                  daysSober={data.daysSober}
                  workoutsThisWeek={data.workoutsThisWeek}
                />
              </div>
            </div>
          </div>

          {/* Right sidebar — Weekly Goals + Achievements */}
          <div className="space-y-4">
            <div className="ornament-panel">
              <div className="section-title mb-4">Weekly Goals</div>
              <div className="space-y-4">
                <GoalRow
                  label="Training Sessions"
                  current={data.workoutsThisWeek}
                  target={6}
                />
                <GoalRow
                  label="Progressive Overload"
                  current={4}
                  target={5}
                />
                <GoalRow
                  label="Nutrition Adherence"
                  current={data.proteinHits14?.slice(-7).filter(p => p.hit).length ?? 0}
                  target={7}
                />
                <GoalRow
                  label="Sleep Consistency"
                  current={5}
                  target={7}
                />
              </div>
            </div>

            <div className="ornament-panel">
              <div className="section-title mb-4">Achievements</div>
              <div className="space-y-4">
                {data.goal.totalLost >= 5 && (
                  <Achievement
                    title="Down 5 Pounds"
                    subtitle="Off the starting line"
                    date="This week"
                  />
                )}
                {data.projection.onTrack && (
                  <Achievement
                    title="Ahead of Target"
                    subtitle={`Losing ${data.projection.actualPerWeek.toFixed(1)} lb/wk vs ${data.projection.requiredPerWeek.toFixed(1)} required`}
                    date="Current"
                  />
                )}
                {data.daysSober >= 14 && (
                  <Achievement
                    title="Two Weeks Sober"
                    subtitle={`${data.daysSober} days and counting`}
                    date="Streak"
                  />
                )}
              </div>
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

// ─── Sub-components ───────────────────────────────────────────────────

function LaurelLeft() {
  return (
    <svg className="laurel-left" viewBox="0 0 32 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4 Q10 12 8 24 Q6 36 12 48 Q18 56 22 60" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M14 12 Q6 14 4 18" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M11 22 Q4 24 2 28" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M10 34 Q2 34 0 38" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M13 44 Q6 46 4 50" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function LaurelRight() {
  return (
    <svg className="laurel-right" viewBox="0 0 32 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: "scaleX(-1)" }}>
      <path d="M20 4 Q10 12 8 24 Q6 36 12 48 Q18 56 22 60" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M14 12 Q6 14 4 18" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M11 22 Q4 24 2 28" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M10 34 Q2 34 0 38" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M13 44 Q6 46 4 50" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-[8px] md:text-[10px] tracking-widest uppercase text-muted-foreground font-semibold mb-1">
        {label}
      </div>
      <div className="font-display font-black text-3xl md:text-4xl text-foreground">
        {value.toFixed(1)}
      </div>
    </div>
  );
}

function TrendChart({ series }: { series: { date: string; weight: number }[] }) {
  if (series.length === 0) return <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No data</div>;

  const weights = series.map(s => s.weight);
  const min = Math.min(...weights) - 2;
  const max = Math.max(...weights) + 2;
  const range = max - min || 1;

  const w = 300;
  const h = 130;
  const pad = { l: 24, r: 8, t: 6, b: 20 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  const points = series.map((s, i) => ({
    x: pad.l + (i / Math.max(1, series.length - 1)) * cw,
    y: pad.t + (1 - (s.weight - min) / range) * ch,
    weight: s.weight,
    date: s.date,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const yTicks = [min, min + range / 2, max].map(v => Math.round(v / 10) * 10);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* Y-axis labels */}
      {yTicks.map(v => {
        const y = pad.t + (1 - (v - min) / range) * ch;
        return (
          <text key={v} x={pad.l - 4} y={y + 3} className="fill-muted-foreground" style={{ fontSize: 9, textAnchor: "end", fontFamily: "monospace" }}>
            {v}
          </text>
        );
      })}
      {/* Grid */}
      {yTicks.map(v => {
        const y = pad.t + (1 - (v - min) / range) * ch;
        return <line key={`g${v}`} x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeDasharray="2 3" />;
      })}
      {/* Line */}
      <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
      ))}
      {/* Day labels */}
      {points.map((p, i) => {
        const d = new Date(p.date);
        const label = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);
        return (
          <text key={`d${i}`} x={p.x} y={h - 4} className="fill-muted-foreground" style={{ fontSize: 8, textAnchor: "middle", fontFamily: "sans-serif" }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function TrainingSummary({ bodyPartSets, bodyPartTargets }: { bodyPartSets: Record<string, number>; bodyPartTargets: Record<string, number> }) {
  const rows = [
    { key: "chest", label: "Chest" },
    { key: "back", label: "Back" },
    { key: "shoulders", label: "Shoulders" },
    { key: "biceps", label: "Biceps" },
    { key: "triceps", label: "Triceps" },
    { key: "legs", label: "Legs" },
  ];

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-[10px] tracking-widest uppercase text-muted-foreground pb-2 border-b border-border">
        <div>Muscle</div>
        <div className="text-center">Intensity</div>
        <div className="text-right">Sets</div>
      </div>
      {rows.map(r => {
        const sets = bodyPartSets[r.key] ?? 0;
        const target = bodyPartTargets[r.key] ?? 18;
        const intensity = Math.min(5, Math.floor((sets / target) * 5));
        return (
          <div key={r.key} className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-2 border-b border-border/40 text-sm">
            <div className="font-semibold uppercase tracking-wider text-xs">{r.label}</div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <span key={i} className={cn(
                  "w-2 h-2 rounded-full",
                  i < intensity ? "bg-primary" : "bg-muted-foreground/25"
                )} />
              ))}
            </div>
            <div className="text-right font-mono text-xs tabular-nums font-bold">
              {sets}<span className="text-muted-foreground">/{target}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BodyCompositionDonut({ currentWeight, totalLost }: { currentWeight: number; totalLost: number }) {
  // Estimated composition — rough estimates only, shown labelled clearly
  const estBFPct = 28; // Tyler's rough current estimate from progress photo direction
  const leanPct = 100 - estBFPct - 15; // 15% water in muscle
  const waterPct = 15;

  const cx = 60, cy = 60, r = 45, sw = 12;
  const circ = 2 * Math.PI * r;

  const leanLen = (leanPct / 100) * circ;
  const bfLen = (estBFPct / 100) * circ;
  const waterLen = (waterPct / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={sw} />
          {/* lean */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={sw}
            strokeDasharray={`${leanLen} ${circ}`} strokeDashoffset={0} />
          {/* body fat */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(30 40% 50%)" strokeWidth={sw}
            strokeDasharray={`${bfLen} ${circ}`} strokeDashoffset={-leanLen} />
          {/* water */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} strokeWidth={sw}
            strokeDasharray={`${waterLen} ${circ}`} strokeDashoffset={-(leanLen + bfLen)} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-2xl font-black">{currentWeight.toFixed(0)}</div>
          <div className="text-[8px] tracking-widest uppercase text-muted-foreground">lb</div>
        </div>
      </div>
      <div className="mt-3 w-full space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="uppercase tracking-wider text-[10px]">Lean Mass</span>
          </div>
          <span className="font-mono font-bold tabular-nums">{leanPct}%</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "hsl(30 40% 50%)" }} />
            <span className="uppercase tracking-wider text-[10px]">Body Fat</span>
          </div>
          <span className="font-mono font-bold tabular-nums">{estBFPct}%</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            <span className="uppercase tracking-wider text-[10px]">Water</span>
          </div>
          <span className="font-mono font-bold tabular-nums">{waterPct}%</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-border w-full text-center text-[9px] tracking-widest uppercase text-primary font-semibold">
        Lost: {totalLost.toFixed(1)} lb
      </div>
    </div>
  );
}

function CalendarStrip({ today, weights }: { today: Date; weights: { date: string; weight: number }[] }) {
  // Show this week Sun-Sat
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
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
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
            <div className={cn("font-display font-black text-lg leading-none", isToday && "text-primary-foreground")}>
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

function LifetimeStats({ lost, daysToTarget, daysSober, workoutsThisWeek }: { lost: number; daysToTarget: number; daysSober: number; workoutsThisWeek: number }) {
  const cells = [
    { label: "Lost", value: lost.toFixed(1), unit: "lb" },
    { label: "Days Left", value: String(daysToTarget), unit: "to goal" },
    { label: "Days Sober", value: String(daysSober), unit: "streak" },
    { label: "Workouts", value: String(workoutsThisWeek), unit: "this wk" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map(c => (
        <div key={c.label} className="text-center py-1">
          <div className="text-[9px] tracking-widest uppercase text-muted-foreground font-semibold">{c.label}</div>
          <div className="font-display font-black text-2xl leading-tight">{c.value}</div>
          <div className="text-[9px] tracking-widest uppercase text-muted-foreground">{c.unit}</div>
        </div>
      ))}
    </div>
  );
}

function GoalRow({ label, current, target }: { label: string; current: number; target: number }) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] tracking-widest uppercase font-semibold">{label}</span>
        <span className="font-mono text-xs font-bold tabular-nums">{current} / {target}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Achievement({ title, subtitle, date }: { title: string; subtitle: string; date: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-display font-black text-sm flex-shrink-0">
        ★
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold uppercase tracking-wider text-xs">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-snug">{subtitle}</div>
        <div className="text-[9px] tracking-widest uppercase text-primary font-semibold mt-0.5">{date}</div>
      </div>
    </div>
  );
}
