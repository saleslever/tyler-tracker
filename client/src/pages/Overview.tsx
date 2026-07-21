import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog, Task, Goal, Quest, QuestCompletion, BossSeal, Record_, Challenge, MoodLog } from "@shared/schema";
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
import { rollupChallenge } from "@/lib/challenge";
import { totalXP, rankProgress, XP } from "@/lib/xp";
import { computeQuestProgress } from "@/lib/questMetrics";
import { RankShield } from "@/components/RankShield";
import { XPBar } from "@/components/XPBar";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Flame, CheckCircle2, Target as TargetIcon, Swords, Trophy, Award, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { SobrietyCard } from "@/components/SobrietyCard";
import { ChallengeCard } from "@/components/ChallengeCard";
import { Fleuron } from "@/components/Ornament";

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "YTD", days: 365 },
  { label: "All", days: 365 },
];

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
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
  const { data: quests = [] } = useQuery<Quest[]>({ queryKey: ["/api/quests"] });
  const { data: seals = [] } = useQuery<BossSeal[]>({ queryKey: ["/api/boss-seals"] });
  const { data: records = [] } = useQuery<Record_[]>({ queryKey: ["/api/records"] });
  const { data: challenge } = useQuery<Challenge | null>({ queryKey: ["/api/challenges/active"] });
  const { data: completions = [] } = useQuery<QuestCompletion[]>({ queryKey: ["/api/quest-completions"] });
  const { data: moods = [] } = useQuery<MoodLog[]>({ queryKey: ["/api/moods"] });

  const [rangeIdx, setRangeIdx] = useState(1);
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

  const xp = useMemo(() => totalXP(logs, seals, quests, completions), [logs, seals, quests, completions]);
  const rp = rankProgress(xp);

  // Active quests: not fully claimed, sorted by proximity to completion.
  const activeQuests = useMemo(() => {
    return [...quests]
      .filter((q) => !q.claimedAt)
      .map((q) => ({ q, progress: computeQuestProgress(q.metric, logs, seals, challenge) }))
      .sort((a, b) => (b.progress / b.q.goal) - (a.progress / a.q.goal))
      .slice(0, 6);
  }, [quests, logs, seals, challenge]);

  // Challenge rollup for the live grid strip
  const chRoll = useMemo(() => (challenge ? rollupChallenge(challenge, logs, today) : null), [challenge, logs, today]);

  // Top records to celebrate
  const topRecords = records.filter((r) => r.value > 0).slice(0, 3);

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-8">
      {/* ==== HUD HERO ==== */}
      <section className="relative overflow-hidden mb-8 rounded-sm border" style={{
        borderColor: rp.rank.color + "55",
        background: `radial-gradient(circle at 15% 20%, ${rp.rank.bgColor} 0%, #0b0908 55%, #060504 100%)`,
      }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.02) 75%, transparent 75%)",
          backgroundSize: "24px 24px",
        }} />
        <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-8 items-center p-6 md:p-10">
          {/* Rank Shield */}
          <div className="flex flex-col items-center gap-3 shrink-0">
            <RankShield rank={rp.rank} size={140} glow />
            <div className="text-center">
              <div className="text-[10px] tracking-[0.45em] uppercase opacity-70" style={{ color: rp.rank.color, fontFamily: "'Inter', sans-serif" }}>
                Tier {rp.rank.numeral}
              </div>
              <div className="serif-hero uppercase text-2xl leading-none mt-1" style={{ color: rp.rank.color, letterSpacing: "0.06em" }}>
                {rp.rank.name}
              </div>
            </div>
          </div>

          {/* XP Column */}
          <div className="min-w-0 flex flex-col gap-4">
            <div>
              <div className="text-[10px] tracking-[0.45em] uppercase opacity-70" style={{ color: rp.rank.color, fontFamily: "'Inter', sans-serif" }}>
                Lifetime Progress
              </div>
              <div className="mt-1 serif italic text-lg opacity-90" style={{ color: "hsl(38 20% 88%)" }}>
                "{rp.rank.motto}"
              </div>
            </div>
            <XPBar xp={xp} />
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Today" value={`+${hitsToday}`} sub={`${HABITS.length} habits`} tone={rp.rank.color} />
              <MiniStat label="Streak" value={`${streak}`} sub="days" tone="#f5a742" icon={<Flame className="w-3.5 h-3.5" />} />
              <MiniStat label="Seals" value={`${seals.length}`} sub="days sealed" tone={rp.rank.color} icon={<Trophy className="w-3.5 h-3.5" />} />
            </div>
          </div>

          {/* Right column: Records */}
          <div className="hidden md:flex flex-col gap-2 min-w-[220px]">
            <div className="text-[10px] tracking-[0.45em] uppercase opacity-70 flex items-center gap-2" style={{ color: rp.rank.color, fontFamily: "'Inter', sans-serif" }}>
              <Award className="w-3.5 h-3.5" /> Personal Records
            </div>
            {topRecords.length === 0 ? (
              <div className="text-xs opacity-50 py-3">Log habits to start setting records.</div>
            ) : (
              topRecords.map((r) => (
                <div key={r.key} className="flex items-baseline justify-between py-1.5 border-b" style={{ borderColor: `${rp.rank.color}22` }}>
                  <div className="text-[11px] opacity-80" style={{ fontFamily: "'Inter', sans-serif" }}>{r.label}</div>
                  <div className="num-display text-base" style={{ color: rp.rank.color }}>{r.value}<span className="text-[10px] opacity-70 ml-1">{r.unit}</span></div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ==== TODAY'S MISSION ==== */}
      <section className="mb-8 rounded-sm border p-6" style={{ borderColor: "hsl(40 15% 22%)", background: "linear-gradient(160deg, #14100a 0%, #0a0908 100%)" }}>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="microlabel">Today's Mission</div>
            <div className="serif text-lg mt-0.5">{hitsToday === HABITS.length ? "COMPLETE — Day is Sealed" : `${HABITS.length - hitsToday} habits remain`}</div>
          </div>
          <Link href="/habits" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground">Enter the Field →</Link>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-2">
          {HABITS.map((h) => {
            const hit = habitHit(todayLog, h);
            return (
              <div
                key={h.field}
                className={cn(
                  "aspect-square rounded-sm border flex items-center justify-center text-center px-1 transition-all",
                  hit ? "shadow-[0_0_12px_rgba(234,179,8,0.35)]" : "opacity-40",
                )}
                style={{
                  borderColor: hit ? "hsl(38 60% 60%)" : "hsl(40 15% 22%)",
                  background: hit ? "hsl(38 40% 18%)" : "#0a0908",
                }}
                data-testid={`mission-${h.field}`}
              >
                <div className={cn("text-[9px] tracking-widest uppercase leading-tight")}
                  style={{ fontFamily: "'Inter', sans-serif", color: hit ? "hsl(38 80% 75%)" : "hsl(40 10% 55%)" }}>
                  {h.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==== ACTIVE QUESTS STRIP ==== */}
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 opacity-70" />
            <div className="microlabel">Active Quests</div>
          </div>
          <Link href="/quests" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground">All quests →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {activeQuests.map(({ q, progress }) => {
            const pct = Math.min(1, progress / q.goal);
            const done = pct >= 1;
            return (
              <Link key={q.key} href="/quests">
                <div
                  className={cn(
                    "cursor-pointer rounded-sm border p-3 transition-all hover:border-foreground/40",
                    done && "shadow-[0_0_18px_rgba(224,183,79,0.35)]",
                  )}
                  style={{ borderColor: "hsl(40 15% 22%)", background: "#0a0908" }}
                  data-testid={`quest-strip-${q.key}`}
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-xl">{q.icon}</div>
                    <div className="text-[9px] tracking-[0.3em] opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>+{q.xpReward} XP</div>
                  </div>
                  <div className="serif text-xs mt-2 uppercase tracking-[0.05em]">{q.title}</div>
                  <div className="mt-2 h-1 rounded-sm overflow-hidden" style={{ background: "#0e0d0b" }}>
                    <div className="h-full transition-all duration-700" style={{ width: `${pct * 100}%`, background: done ? "hsl(38 80% 60%)" : "hsl(40 40% 60%)" }} />
                  </div>
                  <div className="text-[10px] tabular-nums mt-1 opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>{progress}/{q.goal}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ==== CHALLENGE ==== */}
      <ChallengeCard />

      {/* ==== MOOD ==== */}
      <MoodMini moods={moods} />

      {/* ==== SOBRIETY ==== */}
      <SobrietyCard />

      {/* ==== ANALYTICS ==== */}
      <div className="flex items-center justify-between mb-4 mt-8">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Today's Discipline" value={<span>{Math.round(score * 100)}<span className="text-xl text-muted-foreground ml-1">%</span></span>} sub={<span>{hitsToday} of {HABITS.length} habits hit today</span>} />
        <StatCard label="Current Streak" value={<span className="flex items-baseline gap-2">{streak}<span className="text-xl text-muted-foreground">days</span></span>} sub={<span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-400" /> Days ≥ 70% complete</span>} />
        <StatCard label="30-Day Average" value={<span>{Math.round(rate30 * 100)}<span className="text-xl text-muted-foreground ml-1">%</span></span>} sub={<span className={cn("flex items-center gap-1", delta >= 0 ? "text-emerald-400" : "text-red-400")}>{delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{delta >= 0 ? "+" : ""}{Math.round(delta * 100)}% vs prior 30d</span>} />
        <StatCard label="Last 7 Days" value={<span>{Math.round(rate7 * 100)}<span className="text-xl text-muted-foreground ml-1">%</span></span>} sub={<span className="text-muted-foreground">rolling average</span>} />
      </div>

      <section className="card-lux p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="serif text-base">Compound Curve</div>
            <div className="text-xs text-muted-foreground mt-1">
              Every habit checked today adds to this curve. It only goes up when you show up.
              {hitsToday > 0 && (<> <span className="text-foreground">+{hitsToday} today.</span></>)}
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
              <XAxis dataKey="date" tickFormatter={shortDate} stroke="hsl(40 6% 45%)" style={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: "hsl(40 6% 15%)" }} interval={Math.floor(compound.length / 6)} />
              <YAxis stroke="hsl(40 6% 45%)" style={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(240 5% 8%)", border: "1px solid hsl(40 15% 22%)", borderRadius: 6, fontSize: 12 }} labelFormatter={shortDate} formatter={(v: number) => [v, "Habits hit"]} />
              <Area type="monotone" dataKey="cumulative" stroke="hsl(40 25% 90%)" strokeWidth={2} fill="url(#platinumGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ==== SNAPSHOTS ==== */}
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

      <div className="mt-14 flex justify-center opacity-30">
        <Fleuron size={30} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, tone, icon }: { label: string; value: React.ReactNode; sub?: string; tone: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-sm border p-3" style={{ borderColor: `${tone}44`, background: "#0a0908" }}>
      <div className="flex items-center gap-1 text-[9px] tracking-[0.35em] uppercase opacity-80" style={{ color: tone, fontFamily: "'Inter', sans-serif" }}>
        {icon}
        {label}
      </div>
      <div className="mt-1 num-display text-2xl" style={{ color: tone }}>{value}</div>
      {sub && <div className="text-[10px] opacity-65 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>{sub}</div>}
    </div>
  );
}

function MoodMini({ moods }: { moods: MoodLog[] }) {
  const sorted = [...moods].sort(
    (a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime(),
  );
  const latest = sorted[0];
  const week = moods.filter(
    (m) => Date.now() - new Date(m.loggedAt).getTime() < 7 * 24 * 60 * 60 * 1000,
  );
  const weekAvg = week.length
    ? week.reduce((a, b) => a + b.value, 0) / week.length
    : null;
  const prev = sorted[1];
  const delta = latest && prev ? latest.value - prev.value : 0;

  const color = latest
    ? latest.value <= 3
      ? "#c94848"
      : latest.value <= 5
        ? "#8a8578"
        : latest.value <= 7
          ? "#c9995a"
          : "#e0b74f"
    : "#4a4a4a";

  const label = latest
    ? latest.value <= 2
      ? "Rock bottom"
      : latest.value <= 4
        ? "Low"
        : latest.value <= 6
          ? "Steady"
          : latest.value <= 8
            ? "Strong"
            : "Peak"
    : "No check-ins yet";

  return (
    <div className="mt-8 rounded-sm border border-[#2a2a2a] bg-[#0a0908] p-5" data-testid="mood-mini">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 opacity-70" />
          <div className="microlabel">Mood</div>
        </div>
        <Link
          href="/mood"
          className="text-xs tracking-widest uppercase text-muted-foreground hover:text-foreground"
        >
          Log &amp; chart →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 items-center">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-sm border-2 num-display text-3xl"
            style={{ borderColor: color, color, background: "#0a0908" }}
          >
            {latest ? latest.value : "—"}
          </div>
          <div className="min-w-0">
            <div
              className="text-sm"
              style={{ color, fontFamily: "'Inter', sans-serif" }}
            >
              {label}
            </div>
            {latest && (
              <div className="text-[11px] opacity-60" style={{ fontFamily: "'Inter', sans-serif" }}>
                {new Date(latest.loggedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            )}
            {latest && prev && delta !== 0 && (
              <div
                className="mt-1 flex items-center gap-1 text-[11px]"
                style={{
                  color: delta > 0 ? "#7fb069" : "#c94848",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                {delta > 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {delta > 0 ? "+" : ""}
                {delta} vs. previous
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <div className="microlabel">7-Day Avg</div>
          <div className="mt-1 num-display text-2xl" style={{ color: "#e0b74f" }}>
            {weekAvg ? weekAvg.toFixed(1) : "—"}
          </div>
          <div className="text-[10px] opacity-60 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
            {week.length} check-in{week.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="text-center">
          <div className="microlabel">All Time</div>
          <div className="mt-1 num-display text-2xl">{moods.length}</div>
          <div className="text-[10px] opacity-60 mt-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>
            logged
          </div>
        </div>
      </div>
    </div>
  );
}
