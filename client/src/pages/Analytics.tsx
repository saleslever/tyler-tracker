import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import {
  HABITS,
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
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

export default function Analytics() {
  const today = useToday();
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);

  const compound = useMemo(() => compoundSeries(logs, today, range), [logs, today, range]);

  const weekly = useMemo(() => {
    const out: { label: string; date: string; pct: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const log = logs.find((l) => l.date === d);
      const [y, m, dd] = d.split("-").map(Number);
      const label = new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short" });
      out.push({ label, date: d, pct: Math.round(dayScore(log) * 100) });
    }
    return out;
  }, [logs, today]);

  // Year-view heatmap: 30x variable — go with last 91 days (13 weeks × 7)
  const heatmap = useMemo(() => {
    const days = 91;
    const cells: { date: string; score: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      cells.push({ date: d, score: dayScore(logs.find((l) => l.date === d)) });
    }
    return cells;
  }, [logs, today]);

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
          {HABITS.map((h) => {
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
    </div>
  );
}
