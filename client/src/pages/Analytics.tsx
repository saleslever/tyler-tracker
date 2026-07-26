import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog, Fast } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import {
  useHabits,
  dayScore,
  habitRate,
  currentStreak,
  compoundSeries,
  shortDate,
  addDays,
} from "@/lib/analytics";
import { useToday } from "@/hooks/useToday";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { Flame, Timer, Trophy, TrendingDown, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

export default function Analytics() {
  const today = useToday();
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: fasts = [] } = useQuery<Fast[]>({ queryKey: ["/api/fasts"] });
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const habits = useHabits();
  const compound = useMemo(() => compoundSeries(logs, today, range, habits), [logs, today, range, habits]);

  const weekly = useMemo(() => {
    const out: { label: string; date: string; pct: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const log = logs.find((l) => l.date === d);
      const [y, m, dd] = d.split("-").map(Number);
      const label = new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short" });
      out.push({ label, date: d, pct: Math.round(dayScore(log, habits) * 100) });
    }
    return out;
  }, [logs, today, habits]);

  // Year-view heatmap: 30x variable — go with last 91 days (13 weeks × 7)
  const heatmap = useMemo(() => {
    const days = 91;
    const cells: { date: string; score: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      cells.push({ date: d, score: dayScore(logs.find((l) => l.date === d), habits) });
    }
    return cells;
  }, [logs, today, habits]);

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-10">
      <PageHeader
        title="Analytics"
        subtitle="Where the compound effect becomes visible."
        actions={
          <div className="seg">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn("seg-btn", r === range && "active")}
              >
                {r}D
              </button>
            ))}
          </div>
        }
      />

      {/* Compound curve */}
      <section className="card-plain p-6 mb-6">
        <div className="mb-4">
          <div className="serif text-base">Compound Curve</div>
          <div className="text-xs text-muted-foreground mt-1">Cumulative habits hit across the range.</div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={compound} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="anaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(40 15% 85%)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="hsl(40 15% 85%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(40 6% 15%)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                stroke="hsl(40 6% 40%)"
                style={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(40 6% 15%)" }}
                interval={Math.floor(compound.length / 7)}
              />
              <YAxis stroke="hsl(40 6% 40%)" style={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(240 5% 8%)", border: "1px solid hsl(40 8% 20%)", borderRadius: 6, fontSize: 12 }}
                labelFormatter={shortDate}
              />
              <Area type="monotone" dataKey="cumulative" stroke="hsl(40 15% 88%)" strokeWidth={1.5} fill="url(#anaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Weekly bars */}
        <section className="card-plain p-6">
          <div className="mb-4">
            <div className="serif text-base">Last 7 Days</div>
            <div className="text-xs text-muted-foreground mt-1">Daily completion %</div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(40 6% 15%)" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(40 6% 40%)" style={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="hsl(40 6% 40%)" style={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 5% 8%)", border: "1px solid hsl(40 8% 20%)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Completion"]}
                />
                <Bar dataKey="pct" fill="hsl(40 15% 82%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Heatmap */}
        <section className="card-plain p-6 lg:col-span-2">
          <div className="mb-4">
            <div className="serif text-base">90-Day Heatmap</div>
            <div className="text-xs text-muted-foreground mt-1">Every square is a day. Brighter = more habits hit.</div>
          </div>
          <div className="flex flex-wrap gap-1">
            {heatmap.map((c) => (
              <div
                key={c.date}
                className="w-4 h-4 rounded-sm"
                style={{
                  background: c.score === 0
                    ? "hsl(240 5% 10%)"
                    : `hsl(40 15% ${20 + c.score * 65}%)`,
                }}
                title={`${c.date} · ${Math.round(c.score * 100)}%`}
              />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map((s) => (
              <div
                key={s}
                className="w-3 h-3 rounded-sm"
                style={{ background: s === 0 ? "hsl(240 5% 10%)" : `hsl(40 15% ${20 + s * 65}%)` }}
              />
            ))}
            <span>More</span>
          </div>
        </section>
      </div>

      {/* Habit rates grid */}
      <section className="card-plain p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <div className="serif text-base">Habit Performance · 30 days</div>
            <div className="text-xs text-muted-foreground mt-1">Rate = days habit was hit ÷ 30</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {habits.map((h) => {
            const rate = habitRate(logs, h, today, 30);
            const streak = currentStreak(logs, h, today);
            return (
              <div key={h.key} className="border border-border rounded p-4 bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base">{h.emoji}</span>
                  <div className="flex items-center gap-1 text-xs">
                    <Flame className="w-3 h-3 text-orange-400" />
                    <span>{streak}</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground truncate mb-1">{h.label}</div>
                <div className="num-display text-2xl text-foreground">
                  {Math.round(rate * 100)}<span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-foreground/80" style={{ width: `${rate * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==== FASTING ANALYTICS ==== */}
      <FastingAnalytics fasts={fasts} today={today} />
    </div>
  );
}

/* =============================================================
   FASTING ANALYTICS — avg / longest / shortest / success rate
   + 30-day duration bars + current streak of days with a fast
   ============================================================= */
function FastingAnalytics({ fasts, today }: { fasts: Fast[]; today: string }) {
  const closed = fasts.filter((f) => f.endedAt);

  const { count, avg, longest, shortest, successPct } = useMemo(() => {
    if (closed.length === 0) return { count: 0, avg: 0, longest: 0, shortest: 0, successPct: 0 };
    const durs = closed.map((f) => (new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime()) / 3600000);
    const successes = closed.filter((f) => {
      const d = (new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime()) / 3600000;
      return d >= f.goalHours;
    }).length;
    return {
      count: durs.length,
      avg: durs.reduce((a, b) => a + b, 0) / durs.length,
      longest: Math.max(...durs),
      shortest: Math.min(...durs),
      successPct: Math.round((successes / durs.length) * 100),
    };
  }, [closed]);

  // 30-day bars: for each day, sum of fast hours whose ENDED-date falls on that day
  const bars = useMemo(() => {
    const out: { label: string; date: string; hours: number; goal: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      const dayFasts = closed.filter((f) => {
        const end = new Date(f.endedAt!);
        const y = end.getFullYear();
        const m = String(end.getMonth() + 1).padStart(2, "0");
        const dd = String(end.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}` === d;
      });
      const hours = dayFasts.reduce((sum, f) => sum + (new Date(f.endedAt!).getTime() - new Date(f.startedAt).getTime()) / 3600000, 0);
      const goal = dayFasts.length > 0 ? Math.max(...dayFasts.map((f) => f.goalHours)) : 0;
      const [y, m, dd] = d.split("-").map(Number);
      const label = new Date(y, m - 1, dd).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
      out.push({ label, date: d, hours: Math.round(hours * 10) / 10, goal });
    }
    return out;
  }, [closed, today]);

  // Streak of consecutive days ending in `today` that have at least one closed fast
  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; ; i++) {
      const d = addDays(today, -i);
      const has = closed.some((f) => {
        const end = new Date(f.endedAt!);
        const y = end.getFullYear();
        const m = String(end.getMonth() + 1).padStart(2, "0");
        const dd = String(end.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}` === d;
      });
      if (has) s += 1;
      else break;
      if (i > 500) break;
    }
    return s;
  }, [closed, today]);

  if (fasts.length === 0) {
    return (
      <section className="card-plain p-6 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Timer className="w-4 h-4 text-muted-foreground" />
          <div className="serif text-base">Fasting</div>
        </div>
        <div className="text-xs text-muted-foreground">No fasts logged yet. Start one from the Fasting tab — stats and trends will appear here.</div>
      </section>
    );
  }

  const maxBar = Math.max(24, ...bars.map((b) => b.hours));

  const fmtDur = (h: number) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    if (hh === 0) return `${mm}m`;
    if (mm === 0) return `${hh}h`;
    return `${hh}h ${mm}m`;
  };

  return (
    <section className="card-plain p-6 mt-6">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#e0b74f]" />
            <div className="serif text-base">Fasting</div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">{count} fasts · {successPct}% goal-hit rate</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-muted-foreground">Streak</span>
          <span className="num-display text-lg text-[#e0b74f]">{streak}</span>
          <span className="text-muted-foreground">{streak === 1 ? "day" : "days"}</span>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-border rounded p-4 bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2"><Target className="w-3.5 h-3.5" /><div className="microlabel">Average</div></div>
          <div className="num-display text-2xl">{fmtDur(avg)}</div>
        </div>
        <div className="border border-border rounded p-4 bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2"><Trophy className="w-3.5 h-3.5" /><div className="microlabel">Longest</div></div>
          <div className="num-display text-2xl text-[#e0b74f]">{fmtDur(longest)}</div>
        </div>
        <div className="border border-border rounded p-4 bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2"><TrendingDown className="w-3.5 h-3.5" /><div className="microlabel">Shortest</div></div>
          <div className="num-display text-2xl">{fmtDur(shortest)}</div>
        </div>
        <div className="border border-border rounded p-4 bg-secondary/30">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-2"><Timer className="w-3.5 h-3.5" /><div className="microlabel">Total Fasts</div></div>
          <div className="num-display text-2xl">{count}</div>
        </div>
      </div>

      {/* 30-day duration bars */}
      <div className="mb-2 flex items-baseline justify-between">
        <div className="microlabel">Last 30 days · duration</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Gold = goal hit</div>
      </div>
      <div className="h-40 flex items-end gap-1">
        {bars.map((b) => {
          const h = b.hours > 0 ? Math.max(3, (b.hours / maxBar) * 100) : 0;
          const hit = b.goal > 0 && b.hours >= b.goal;
          return (
            <div key={b.date} className="flex-1 flex flex-col items-center justify-end h-full group relative">
              <div
                className={cn(
                  "w-full rounded-t transition-all",
                  hit ? "bg-[#e0b74f]" : b.hours > 0 ? "bg-foreground/60" : "bg-secondary"
                )}
                style={{ height: `${h}%` }}
                title={`${b.label} · ${b.hours > 0 ? fmtDur(b.hours) : "no fast"}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>{bars[0]?.label}</span>
        <span>{bars[Math.floor(bars.length / 2)]?.label}</span>
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </section>
  );
}
