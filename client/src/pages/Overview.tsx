import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog, Task, Goal } from "@shared/schema";
import crestFull from "@assets/crest_full.png";
import { useToday } from "@/hooks/useToday";
import {
  HABITS,
  habitHit,
  dayScore,
  overallStreak,
  completionRate,
  compoundSeries,
  shortDate,
  addDays,
} from "@/lib/analytics";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Flame, CheckCircle2, Target as TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { SobrietyCard } from "@/components/SobrietyCard";
import { ChallengeCard } from "@/components/ChallengeCard";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "YTD", days: 365 },
  { label: "All", days: 365 },
];

function StatCard({
  label, value, sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="microlabel">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="num-display text-4xl leading-none text-foreground">{value}</div>
      </div>
      {sub && <div className="mt-3 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function Overview() {
  const today = useToday();
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: goals = [] } = useQuery<Goal[]>({ queryKey: ["/api/goals"] });

  const [rangeIdx, setRangeIdx] = useState(1); // 30D default
  const range = RANGES[rangeIdx];

  const todayLog = logs.find((l) => l.date === today);
  const score = dayScore(todayLog);
  const streak = overallStreak(logs, today);
  const rate7 = completionRate(logs, today, 7);
  const rate30 = completionRate(logs, today, 30);
  const ratePrev = completionRate(logs, addDays(today, -30), 30);
  const delta = rate30 - ratePrev;

  const compound = useMemo(() => compoundSeries(logs, today, range.days), [logs, today, range.days]);
  const totalHitsInRange = compound.length ? compound[compound.length - 1].cumulative : 0;
  const hitsToday = HABITS.filter((h) => habitHit(todayLog, h)).length;

  const openTodayTasks = tasks.filter((t) => t.list === "today" && !t.completed).length;
  const activeGoals = goals.filter((g) => g.status === "active").length;

  const dateLine = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-8">
      {/* Header row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="serif text-xs text-foreground tracking-widest">Tyler's Daily Discipline</div>
          <div className="microlabel mt-1">DISCIPLINE · GROWTH · LEGACY</div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live · {dateLine}</span>
        </div>
      </div>

      {/* HERO PANEL */}
      <section className="hero-panel px-6 md:px-16 py-14 md:py-20 mb-8">
        <div className="corner corner-tl" />
        <div className="corner corner-tr" />
        <div className="corner corner-bl" />
        <div className="corner corner-br" />

        <div className="relative flex flex-col md:flex-row items-center gap-10 md:gap-16 max-w-5xl mx-auto text-center md:text-left">
          <div className="hidden md:block flex-1">
            <div className="microlabel mb-4">WELCOME BACK</div>
            <div className="serif-hero text-3xl md:text-4xl leading-[1.15]">
              <div>Tyler's Daily</div>
              <div>Discipline</div>
            </div>
            <div className="mt-6 ornament">EST. 2026</div>
          </div>

          <div className="md:hidden">
            <div className="microlabel mb-3">WELCOME BACK</div>
            <div className="serif-hero text-xl">Tyler's Daily Discipline</div>
          </div>

          <div className="text-foreground shrink-0 drop-shadow-2xl">
            <img
              src={crestFull}
              alt="Tyler's Daily Discipline crest"
              className="w-[240px] h-[240px] object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              draggable={false}
            />
          </div>

          <div className="flex-1 md:max-w-xs">
            <div className="microlabel mb-3">DISCIPLINE · GROWTH · LEGACY</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              &ldquo;Every habit compounds. Every discipline builds legacy. This is the standard — held daily.&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* CHALLENGE — 30-day active challenge */}
      <ChallengeCard />

      {/* SOBRIETY — hero-priority tracker */}
      <SobrietyCard />

      {/* Range control */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="microlabel">Date Range</div>
          <div className="seg">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className={cn("seg-btn", i === rangeIdx && "active")}
                data-testid={`range-${r.label}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Showing: <span className="text-foreground font-medium">{range.label === "All" ? "All time" : `Last ${range.days} days`}</span>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Today's Discipline"
          value={<span>{Math.round(score * 100)}<span className="text-xl text-muted-foreground ml-1">%</span></span>}
          sub={<span>{hitsToday} of {HABITS.length} habits hit today</span>}
        />
        <StatCard
          label="Current Streak"
          value={<span className="flex items-baseline gap-2">{streak}<span className="text-xl text-muted-foreground">days</span></span>}
          sub={<span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-400" /> Days ≥ 70% complete</span>}
        />
        <StatCard
          label="30-Day Average"
          value={<span>{Math.round(rate30 * 100)}<span className="text-xl text-muted-foreground ml-1">%</span></span>}
          sub={
            <span className={cn("flex items-center gap-1", delta >= 0 ? "text-emerald-400" : "text-red-400")}>
              {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {delta >= 0 ? "+" : ""}{Math.round(delta * 100)}% vs prior 30d
            </span>
          }
        />
        <StatCard
          label="Last 7 Days"
          value={<span>{Math.round(rate7 * 100)}<span className="text-xl text-muted-foreground ml-1">%</span></span>}
          sub={<span className="text-muted-foreground">rolling average</span>}
        />
      </div>

      {/* MAIN CHART */}
      <section className="card-lux p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="serif text-base">Compound Curve</div>
            <div className="text-xs text-muted-foreground mt-1">
              Every habit checked today adds to this curve. It only goes up when you show up.
              {hitsToday > 0 && (
                <> <span className="text-foreground">+{hitsToday} today.</span></>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="microlabel">Total habits hit</div>
            <div className="num-display text-3xl mt-1 text-foreground">{totalHitsInRange}</div>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={compound} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="platinumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(40 22% 85%)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="hsl(40 22% 85%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(40 6% 15%)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                stroke="hsl(40 6% 45%)"
                style={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(40 6% 15%)" }}
                interval={Math.floor(compound.length / 6)}
              />
              <YAxis stroke="hsl(40 6% 45%)" style={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(240 5% 8%)",
                  border: "1px solid hsl(40 15% 22%)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelFormatter={shortDate}
                formatter={(v: number) => [v, "Habits hit"]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="hsl(40 25% 90%)"
                strokeWidth={2}
                fill="url(#platinumGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* SNAPSHOTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-lux p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="serif text-base">Today's Focus</div>
              <div className="text-xs text-muted-foreground mt-1">{openTodayTasks} open task{openTodayTasks !== 1 ? "s" : ""}</div>
            </div>
            <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <div className="space-y-2">
            {tasks.filter((t) => t.list === "today").slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
                <CheckCircle2 className={cn("w-4 h-4", t.completed ? "text-emerald-400" : "text-muted-foreground/40")} />
                <span className={cn("text-sm flex-1 truncate", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
                <span className={cn(
                  "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                  t.priority === "high" && "bg-red-500/10 text-red-300",
                  t.priority === "med" && "bg-white/5 text-muted-foreground",
                  t.priority === "low" && "bg-white/[0.03] text-muted-foreground/70",
                )}>{t.priority}</span>
              </div>
            ))}
            {tasks.filter((t) => t.list === "today").length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No tasks yet. <Link href="/tasks" className="text-foreground hover:underline">Add one →</Link>
              </div>
            )}
          </div>
        </section>

        <section className="card-lux p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="serif text-base">Active Goals</div>
              <div className="text-xs text-muted-foreground mt-1">{activeGoals} in flight</div>
            </div>
            <Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          <div className="space-y-3">
            {goals.filter((g) => g.status === "active").slice(0, 4).map((g) => (
              <div key={g.id} className="py-2 border-b border-border last:border-b-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <TargetIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm">{g.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{g.progress}%</span>
                </div>
                <div className="h-1 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-foreground/80" style={{ width: `${g.progress}%` }} />
                </div>
              </div>
            ))}
            {goals.filter((g) => g.status === "active").length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No active goals. <Link href="/goals" className="text-foreground hover:underline">Set one →</Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
