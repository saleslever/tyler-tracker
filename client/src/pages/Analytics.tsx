import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { TrendingDown, Target, Flame, Dumbbell, Utensils } from "lucide-react";

/**
 * Analytics — warm-gold rebuild.
 *
 * The five things that matter:
 *   1. Weight trend (cut trajectory + goal remaining)
 *   2. BF% trend (real fat loss vs weight loss)
 *   3. Protein hit-rate (last 14 days)
 *   4. Weekly set ledger (bar chart of sets vs 24/wk cap by body part)
 *   5. Fasting weekly pattern
 *
 * Every panel is data-derived. No fake numbers, no toggles, no gamification.
 */

interface BodyScan {
  date: string;
  weight: number | null;
  bodyFatPct: number | null;
  source: string | null;
}
interface MacroLog {
  date: string;
  calories: number | null;
  proteinG: number | null;
}
interface Fast {
  id: number;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
}
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d);
}

// ─── Panel scaffolding ──────────────────────────────────────
function Panel({
  title,
  subtitle,
  icon,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="card-lux rounded-md p-5 md:p-6 border border-border">
      <header className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-primary">{icon}</div>
          <div>
            <h2 className="font-display text-base md:text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function StatBlock({ label, value, delta, unit }: { label: string; value: string; delta?: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-2xl font-semibold tabular-nums mt-1">
        {value}{unit && <span className="text-sm text-muted-foreground ml-1">{unit}</span>}
      </div>
      {delta && <div className="text-xs text-muted-foreground mt-0.5 font-mono">{delta}</div>}
    </div>
  );
}

// ─── Sparkline (SVG) ─────────────────────────────────────────
function Sparkline({
  points,
  width = 320,
  height = 80,
  strokeClass = "stroke-primary",
  fillClass = "fill-primary/10",
  invert = false, // if true, "up" is worse (weight, BF%)
  goalLine,
}: {
  points: { date: string; value: number }[];
  width?: number;
  height?: number;
  strokeClass?: string;
  fillClass?: string;
  invert?: boolean;
  goalLine?: number;
}) {
  if (points.length === 0) return <div className="text-xs text-muted-foreground italic py-8 text-center">No data yet</div>;
  const values = points.map(p => p.value);
  const min = Math.min(...values, goalLine ?? Infinity);
  const max = Math.max(...values, goalLine ?? -Infinity);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const y = (v: number) => height - ((v - min) / range) * height;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${((points.length - 1) * stepX).toFixed(1)} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height + 4}`} className="w-full h-24 md:h-28" preserveAspectRatio="none">
      <path d={areaPath} className={fillClass} />
      <path d={path} fill="none" strokeWidth="2" className={cn(strokeClass, "drop-shadow-sm")} />
      {goalLine !== undefined && (
        <line x1="0" x2={width} y1={y(goalLine)} y2={y(goalLine)} strokeDasharray="4 4" strokeWidth="1" className="stroke-primary/50" />
      )}
      {/* dots */}
      {points.map((p, i) => (
        <circle key={i} cx={i * stepX} cy={y(p.value)} r="2.5" className={strokeClass.replace("stroke", "fill")} />
      ))}
    </svg>
  );
}

// ─── Weight/BF trend logic ──────────────────────────────────
function useDaySeries<T extends { date: string }>(rows: T[] | undefined, key: keyof T, days: number = 30) {
  return useMemo(() => {
    if (!rows) return [];
    const cutoff = daysAgo(days);
    const filtered = rows
      .filter(r => r.date >= cutoff && (r[key] as any) != null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    return filtered.map(r => ({ date: r.date, value: Number(r[key]) }));
  }, [rows, key, days]);
}

export default function Analytics() {
  const [range, setRange] = useState<14 | 30 | 90>(30);

  const scansQuery = useQuery<BodyScan[]>({ queryKey: ["/api/fitness/scans"], staleTime: 60_000 });
  const contextQuery = useQuery<any>({ queryKey: ["/api/coach/context"], staleTime: 60_000 });
  const macrosQuery = useQuery<MacroLog[]>({
    queryKey: ["/api/fitness/macros", "range-14"],
    queryFn: async () => {
      const start = daysAgo(14);
      const end = daysAgo(0);
      const r = await fetch(`/api/fitness/macros?start=${start}&end=${end}`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });
  const fastsQuery = useQuery<Fast[]>({ queryKey: ["/api/fasts"], staleTime: 60_000 });
  const targetQuery = useQuery<any>({ queryKey: ["/api/fitness/target"], staleTime: 60_000 });

  const goal = contextQuery.data?.goal ?? null;
  const target = targetQuery.data;
  const proteinTarget = target?.proteinGramsMin ?? null;

  // Weight
  const weightSeries = useDaySeries(scansQuery.data, "weight" as any, range);
  const bfSeries = useDaySeries(scansQuery.data, "bodyFatPct" as any, range);

  const latestWeight = weightSeries.length > 0 ? weightSeries[weightSeries.length - 1].value : null;
  const startWeight = weightSeries.length > 0 ? weightSeries[0].value : null;
  const weightDelta = latestWeight != null && startWeight != null ? latestWeight - startWeight : null;

  const latestBf = bfSeries.length > 0 ? bfSeries[bfSeries.length - 1].value : null;
  const startBf = bfSeries.length > 0 ? bfSeries[0].value : null;
  const bfDelta = latestBf != null && startBf != null ? latestBf - startBf : null;

  // Protein hit-rate (last 14 days regardless of range for clarity)
  const proteinRows = macrosQuery.data ?? [];
  const proteinHits = useMemo(() => {
    if (!proteinTarget) return { pct: null, hitDays: 0, totalDays: 0, series: [] as { date: string; value: number }[] };
    const cutoff = daysAgo(14);
    const relevant = proteinRows.filter(m => m.date >= cutoff);
    let hits = 0;
    const series: { date: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dateStr = daysAgo(i);
      const row = relevant.find(m => m.date === dateStr);
      const hit = row?.proteinG != null && row.proteinG >= proteinTarget;
      if (hit) hits++;
      series.push({ date: dateStr, value: row?.proteinG ?? 0 });
    }
    return { pct: (hits / 14) * 100, hitDays: hits, totalDays: 14, series };
  }, [proteinRows, proteinTarget]);

  // Weekly set ledger — use context's weeklyLedger which is already computed
  const ledger: Record<string, number> = contextQuery.data?.weeklyLedger ?? {};
  const weeklyTarget = contextQuery.data?.settings?.weeklySetsPerBodyPart ?? 24;
  const sortedLedger = useMemo(() => {
    const entries = Object.entries(ledger);
    return entries.sort((a, b) => b[1] - a[1]);
  }, [ledger]);

  // Fasting last 14 days
  const fastPattern = useMemo(() => {
    const fasts = fastsQuery.data ?? [];
    const rows: { date: string; hours: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dateStr = daysAgo(i);
      const f = fasts.find(fx => {
        const startDay = fx.startAt?.slice(0, 10);
        const endDay = fx.endAt?.slice(0, 10);
        return startDay === dateStr || endDay === dateStr;
      });
      const hours = f
        ? f.durationMinutes != null
          ? f.durationMinutes / 60
          : f.endAt
          ? (new Date(f.endAt).getTime() - new Date(f.startAt).getTime()) / 3_600_000
          : 0
        : 0;
      rows.push({ date: dateStr, hours });
    }
    const totalHit = rows.filter(r => r.hours >= 16).length;
    return { rows, totalHit };
  }, [fastsQuery.data]);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6" data-testid="page-analytics">
      <PageHeader title="Analytics" subtitle="The trend lines that decide Feb 2027." />

      {/* Range switcher */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-widest text-muted-foreground mr-2">Weight & BF% range</span>
        {[14, 30, 90].map(n => (
          <button
            key={n}
            onClick={() => setRange(n as 14 | 30 | 90)}
            className={cn(
              "px-3 py-1.5 rounded-sm text-xs font-semibold uppercase tracking-widest border transition-colors",
              range === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent border-border text-muted-foreground hover:border-primary/50",
            )}
            data-testid={`range-${n}`}
          >
            {n} days
          </button>
        ))}
      </div>

      {/* Weight trend */}
      <Panel
        title="Weight trend"
        subtitle={`${range}-day trajectory · goal ${goal?.targetWeight ?? "?"} lb by ${goal?.targetDate ?? "?"}`}
        icon={<TrendingDown className="w-5 h-5" />}
      >
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatBlock
            label="Latest"
            value={latestWeight != null ? latestWeight.toFixed(1) : "—"}
            unit="lb"
          />
          <StatBlock
            label={`${range}d change`}
            value={weightDelta != null ? (weightDelta > 0 ? "+" : "") + weightDelta.toFixed(1) : "—"}
            unit="lb"
            delta={weightDelta != null && weightDelta < 0 ? "cutting" : weightDelta != null && weightDelta > 0 ? "gaining" : undefined}
          />
          <StatBlock
            label="To goal"
            value={
              goal?.targetWeight != null && latestWeight != null
                ? (latestWeight - goal.targetWeight).toFixed(1)
                : "—"
            }
            unit="lb"
          />
        </div>
        <Sparkline points={weightSeries} goalLine={goal?.targetWeight ?? undefined} />
      </Panel>

      {/* BF% trend */}
      <Panel
        title="Body fat percentage"
        subtitle={`${range}-day trajectory · goal ${goal?.targetBodyFatPct ?? "?"}%`}
        icon={<Target className="w-5 h-5" />}
      >
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatBlock
            label="Latest"
            value={latestBf != null ? latestBf.toFixed(1) : "—"}
            unit="%"
          />
          <StatBlock
            label={`${range}d change`}
            value={bfDelta != null ? (bfDelta > 0 ? "+" : "") + bfDelta.toFixed(1) : "—"}
            unit="pts"
          />
          <StatBlock
            label="To goal"
            value={
              goal?.targetBodyFatPct != null && latestBf != null
                ? (latestBf - goal.targetBodyFatPct).toFixed(1)
                : "—"
            }
            unit="pts"
          />
        </div>
        <Sparkline points={bfSeries} goalLine={goal?.targetBodyFatPct ?? undefined} strokeClass="stroke-primary" fillClass="fill-primary/10" />
      </Panel>

      {/* Protein hit-rate */}
      <Panel
        title="Protein hit-rate"
        subtitle={`Days ≥ ${proteinTarget ?? "?"}g protein · last 14 days`}
        icon={<Utensils className="w-5 h-5" />}
      >
        {proteinHits.pct == null ? (
          <div className="text-xs text-muted-foreground italic py-4">No protein target set</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <StatBlock
                label="Hit rate"
                value={proteinHits.pct.toFixed(0)}
                unit="%"
                delta={`${proteinHits.hitDays} of ${proteinHits.totalDays} days`}
              />
              <StatBlock
                label="Target"
                value={String(proteinTarget)}
                unit="g/day"
              />
              <StatBlock
                label="14d avg"
                value={
                  proteinHits.series.length > 0
                    ? Math.round(
                        proteinHits.series.reduce((a, b) => a + b.value, 0) / proteinHits.series.filter(s => s.value > 0).length,
                      ).toString()
                    : "—"
                }
                unit="g"
              />
            </div>
            {/* Hit calendar strip */}
            <div className="flex gap-1">
              {proteinHits.series.map((d, i) => {
                const hit = proteinTarget != null && d.value >= proteinTarget;
                const missed = d.value === 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 h-8 rounded-sm border",
                      hit && "bg-primary border-primary",
                      !hit && !missed && "bg-destructive/20 border-destructive/40",
                      missed && "bg-muted border-border",
                    )}
                    title={`${d.date} · ${d.value}g`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              <span>{proteinHits.series[0]?.date.slice(5)}</span>
              <span>today</span>
            </div>
          </>
        )}
      </Panel>

      {/* Weekly set ledger */}
      <Panel
        title="Weekly set ledger"
        subtitle={`Rolling 7-day sets by body part · cap ${weeklyTarget}/wk`}
        icon={<Dumbbell className="w-5 h-5" />}
      >
        {sortedLedger.length === 0 ? (
          <div className="text-xs text-muted-foreground italic py-4">No workout sets logged in the last 7 days</div>
        ) : (
          <div className="space-y-2">
            {sortedLedger.map(([part, count]) => {
              const pct = Math.min(100, (count / weeklyTarget) * 100);
              const capped = count >= weeklyTarget;
              return (
                <div key={part}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm font-semibold">{part}</span>
                    <span className="font-mono text-xs tabular-nums">
                      <span className={cn(capped ? "text-primary" : "text-foreground")}>{count}</span>
                      <span className="text-muted-foreground"> / {weeklyTarget}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-sm overflow-hidden">
                    <div
                      className={cn("h-full transition-all", capped ? "bg-primary" : "bg-primary/60")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Fasting pattern */}
      <Panel
        title="Fasting pattern"
        subtitle={`Days ≥ 16h fast · last 14 days · ${fastPattern.totalHit} of 14 hit`}
        icon={<Flame className="w-5 h-5" />}
      >
        <div className="flex gap-1 mb-2">
          {fastPattern.rows.map((d, i) => {
            const hit = d.hours >= 16;
            const partial = d.hours > 0 && d.hours < 16;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 h-16 rounded-sm border relative",
                  hit && "bg-primary border-primary",
                  partial && "bg-primary/30 border-primary/40",
                  !hit && !partial && "bg-muted border-border",
                )}
                title={`${d.date} · ${d.hours.toFixed(1)}h`}
              >
                <div className="absolute inset-x-0 bottom-0.5 text-center text-[9px] font-mono tabular-nums text-primary-foreground/70 mix-blend-difference">
                  {d.hours > 0 ? d.hours.toFixed(0) : ""}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          <span>{fastPattern.rows[0]?.date.slice(5)}</span>
          <span>today</span>
        </div>
      </Panel>

      <div className="text-xs text-muted-foreground text-center py-4">
        Every number here is derived from the source of truth. No fake data, no averaging tricks.
      </div>
    </div>
  );
}
