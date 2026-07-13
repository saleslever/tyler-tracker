import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DailyLog, Task } from "@shared/schema";
import {
  HABITS,
  todayStr,
  habitHit,
  dayScore,
  currentStreak,
  overallStreak,
  completionRate,
  habitRate,
  compoundSeries,
  shortDate,
  type HabitDef,
} from "@/lib/analytics";
import { Check, Plus, Flame, Trash2, ChevronRight, Sparkles, TrendingUp, ArrowUpRight, ArrowDownRight, Zap } from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { cn } from "@/lib/utils";

/* ============================================================================
   Header — clock + hero line
   ============================================================================ */
function Header() {
  const now = new Date();
  const dateLine = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLine = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Logo />
          <div className="text-xs uppercase tracking-[0.3em] text-primary/80 mono">
            System Online
          </div>
          <span className="w-2 h-2 rounded-full bg-primary pulse-glow" />
        </div>
        <h1 className="display-serif text-4xl md:text-5xl leading-none">
          <span className="shimmer-text">Tyler's Daily Tracker</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground mono">
          {dateLine} · {timeLine} MDT
        </p>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-label="TDT" className="shrink-0">
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#7DD3FC" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="url(#lg)" opacity="0.12" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" fill="none" stroke="url(#lg)" strokeOpacity="0.6" />
      <path d="M8 22 L16 8 L24 22 Z" fill="none" stroke="url(#lg)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="16" cy="17" r="1.8" fill="#7DD3FC" />
    </svg>
  );
}

/* ============================================================================
   Top stat cards — HUD
   ============================================================================ */
function StatCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={cn("glass rounded-2xl p-5 hud-corners relative overflow-hidden", accent && "glow-ice")}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mono">{label}</div>
        {icon && <div className="text-primary/80">{icon}</div>}
      </div>
      <div className="display-serif text-4xl leading-none">{value}</div>
      {sub && <div className="mt-2 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ============================================================================
   Habit row
   ============================================================================ */
function HabitRow({
  habit,
  log,
  streak,
  onToggle,
  onNumChange,
}: {
  habit: HabitDef;
  log?: DailyLog;
  streak: number;
  onToggle: () => void;
  onNumChange: (val: number | null) => void;
}) {
  const hit = habitHit(log, habit);
  const raw = log ? (log as any)[habit.key] : null;

  return (
    <div
      className={cn(
        "group flex items-center gap-4 p-3 rounded-xl transition-all",
        hit ? "bg-primary/5 border border-primary/20" : "border border-transparent hover:border-white/5 hover:bg-white/[0.02]"
      )}
      data-testid={`row-habit-${habit.key}`}
    >
      {/* Left: check button or number input */}
      {habit.kind === "bool" ? (
        <button
          onClick={onToggle}
          className={cn(
            "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all border",
            hit
              ? "bg-primary text-primary-foreground border-primary/50 glow-ice"
              : "bg-white/[0.02] border-white/10 hover:border-primary/40 hover:bg-primary/5"
          )}
          data-testid={`button-toggle-${habit.key}`}
          aria-label={`Toggle ${habit.label}`}
        >
          {hit && <Check className="w-5 h-5" strokeWidth={3} />}
        </button>
      ) : (
        <div
          className={cn(
            "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border text-base",
            hit
              ? "bg-primary/20 border-primary/50 text-primary"
              : "bg-white/[0.02] border-white/10 text-muted-foreground"
          )}
        >
          <span>{habit.emoji}</span>
        </div>
      )}

      {/* Middle: name + goal hint */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{habit.label}</span>
          {habit.hint && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mono">
              {habit.hint}
            </span>
          )}
        </div>
        {habit.kind === "num" && habit.goal != null && (
          <div className="text-[11px] text-muted-foreground mono mt-0.5">
            Target: {habit.goalDirection === "lte" ? "≤" : "≥"} {habit.goal.toLocaleString()}
            {habit.unit && ` ${habit.unit}`}
          </div>
        )}
      </div>

      {/* Right: numeric input OR just streak */}
      <div className="flex items-center gap-3">
        {habit.kind === "num" && (
          <input
            type="number"
            inputMode="decimal"
            step={habit.key === "weight" || habit.key === "fastingHours" ? "0.1" : "1"}
            value={raw ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onNumChange(v === "" ? null : Number(v));
            }}
            placeholder="—"
            className="w-20 h-9 text-right rounded-lg glass-inset px-3 mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
            data-testid={`input-${habit.key}`}
          />
        )}
        <div
          className={cn(
            "flex items-center gap-1 min-w-[52px] justify-end mono text-sm",
            streak > 0 ? "text-primary" : "text-muted-foreground/50"
          )}
        >
          {streak > 0 ? (
            <>
              <Flame className="w-3.5 h-3.5" />
              {streak}
            </>
          ) : (
            <span className="text-[11px]">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Todo item
   ============================================================================ */
const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 border-red-400/30",
  med: "bg-primary/15 text-primary border-primary/30",
  low: "bg-white/[0.04] text-muted-foreground border-white/10",
};

function TaskRow({
  task,
  onToggle,
  onDelete,
  onMove,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-xl border transition-all",
        task.completed
          ? "border-white/5 bg-white/[0.01] opacity-50"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
      )}
      data-testid={`row-task-${task.id}`}
    >
      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 w-6 h-6 rounded-md flex items-center justify-center border transition-all",
          task.completed
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-transparent border-white/20 hover:border-primary/60"
        )}
        data-testid={`button-toggle-task-${task.id}`}
      >
        {task.completed === 1 && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={cn("text-sm truncate", task.completed && "line-through text-muted-foreground")}>
          {task.title}
        </div>
      </div>

      <span
        className={cn(
          "text-[10px] uppercase mono tracking-wider px-1.5 py-0.5 rounded border",
          PRIORITY_STYLES[task.priority]
        )}
      >
        {task.priority}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMove}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-muted-foreground hover:text-primary"
          title={task.list === "today" ? "Move to backlog" : "Pull to today"}
          data-testid={`button-move-${task.id}`}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
          data-testid={`button-delete-${task.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   Task adder
   ============================================================================ */
function TaskAdder({ list, onAdd }: { list: "today" | "backlog"; onAdd: (title: string, priority: string, list: string) => void }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("med");

  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), priority, list);
    setTitle("");
    setPriority("med");
  };

  return (
    <div className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={list === "today" ? "Add a task for today…" : "Add to backlog…"}
        className="flex-1 h-10 rounded-xl glass-inset px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        data-testid={`input-new-task-${list}`}
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="h-10 rounded-xl glass-inset px-3 mono text-xs uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/50"
        data-testid={`select-priority-${list}`}
      >
        <option value="high">High</option>
        <option value="med">Med</option>
        <option value="low">Low</option>
      </select>
      <button
        onClick={submit}
        className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:brightness-110 transition-all glow-ice shrink-0"
        data-testid={`button-add-task-${list}`}
        aria-label="Add task"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ============================================================================
   Main Dashboard
   ============================================================================ */
export default function Dashboard() {
  const today = todayStr();

  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });

  const todayLog = useMemo(() => logs.find((l) => l.date === today), [logs, today]);

  /* --- Mutations --- */
  const patchLog = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      await apiRequest("PATCH", `/api/logs/${today}`, patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/logs"] }),
  });

  const createTask = useMutation({
    mutationFn: async (t: { title: string; priority: string; list: string }) => {
      await apiRequest("POST", "/api/tasks", t);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: any }) => {
      await apiRequest("PATCH", `/api/tasks/${id}`, patch);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  /* --- Derived analytics --- */
  const score = dayScore(todayLog);
  const overall = overallStreak(logs, today);
  const week = completionRate(logs, today, 7);
  const month = completionRate(logs, today, 30);
  const monthPrev = completionRate(logs, todayStr(new Date(Date.now() - 30 * 86400000)), 30);
  const monthDelta = month - monthPrev;

  const compound30 = useMemo(() => compoundSeries(logs, today, 30), [logs, today]);
  const compound90 = useMemo(() => compoundSeries(logs, today, 90), [logs, today]);
  const [compoundRange, setCompoundRange] = useState<30 | 90>(30);
  const compoundData = compoundRange === 30 ? compound30 : compound90;

  const weeklyBars = useMemo(() => {
    const data: { date: string; label: string; pct: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = todayStr(new Date(Date.now() - i * 86400000));
      const log = logs.find((l) => l.date === d);
      const [y, m, dd] = d.split("-").map(Number);
      const label = new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short" });
      data.push({ date: d, label, pct: Math.round(dayScore(log) * 100) });
    }
    return data;
  }, [logs, today]);

  /* --- Tasks partitioned --- */
  const todayTasks = tasks.filter((t) => t.list === "today").sort((a, b) => a.completed - b.completed);
  const backlogTasks = tasks.filter((t) => t.list === "backlog").sort((a, b) => a.completed - b.completed);

  /* --- Handlers --- */
  const toggleBool = (key: string) => {
    const current = todayLog ? (todayLog as any)[key] : 0;
    patchLog.mutate({ [key]: current === 1 ? 0 : 1 });
  };

  const setNum = (key: string, val: number | null) => {
    patchLog.mutate({ [key]: val });
  };

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        <Header />

        {/* TOP STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Today"
            value={<span>{Math.round(score * 100)}<span className="text-2xl text-muted-foreground">%</span></span>}
            sub={<span className="mono text-primary/80">{HABITS.filter((h) => habitHit(todayLog, h)).length} of {HABITS.length} hit</span>}
            icon={<Sparkles className="w-4 h-4" />}
            accent={score >= 0.7}
          />
          <StatCard
            label="Streak"
            value={<span>{overall}<span className="text-2xl text-muted-foreground"> d</span></span>}
            sub={<span className="mono text-muted-foreground">≥ 70% completion</span>}
            icon={<Flame className="w-4 h-4" />}
            accent={overall >= 3}
          />
          <StatCard
            label="7d Avg"
            value={<span>{Math.round(week * 100)}<span className="text-2xl text-muted-foreground">%</span></span>}
            sub={<span className="mono text-muted-foreground">last week</span>}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard
            label="30d Avg"
            value={<span>{Math.round(month * 100)}<span className="text-2xl text-muted-foreground">%</span></span>}
            sub={
              <span className="mono flex items-center gap-1">
                {monthDelta >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-primary" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-red-400" />
                )}
                <span className={monthDelta >= 0 ? "text-primary" : "text-red-400"}>
                  {monthDelta >= 0 ? "+" : ""}
                  {Math.round(monthDelta * 100)}%
                </span>
                <span className="text-muted-foreground">vs prior</span>
              </span>
            }
            icon={<Zap className="w-4 h-4" />}
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* HABITS */}
          <section className="lg:col-span-5 glass-strong rounded-2xl p-6" data-testid="section-habits">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mono">Section 01</div>
                <h2 className="display-serif text-2xl mt-1">Daily Habits</h2>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mono">Progress</div>
                <div className="display-serif text-2xl text-primary">{Math.round(score * 100)}%</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden mb-5">
              <div
                className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
                style={{ width: `${score * 100}%` }}
              />
            </div>

            <div className="space-y-1.5">
              {HABITS.map((h) => (
                <HabitRow
                  key={h.key}
                  habit={h}
                  log={todayLog}
                  streak={currentStreak(logs, h, today)}
                  onToggle={() => toggleBool(h.key)}
                  onNumChange={(v) => setNum(h.key, v)}
                />
              ))}
            </div>
          </section>

          {/* TASKS */}
          <section className="lg:col-span-7 space-y-6">
            {/* Today */}
            <div className="glass-strong rounded-2xl p-6" data-testid="section-today">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mono">Section 02</div>
                  <h2 className="display-serif text-2xl mt-1">Today</h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mono">Focus</div>
                  <div className="display-serif text-2xl text-primary">
                    {todayTasks.filter((t) => !t.completed).length}
                  </div>
                </div>
              </div>

              <TaskAdder list="today" onAdd={(title, priority, list) => createTask.mutate({ title, priority, list })} />

              <div className="mt-4 space-y-1.5">
                {todayTasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tasks yet. Add one above to lock in today's focus.
                  </div>
                )}
                {todayTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() =>
                      updateTask.mutate({
                        id: t.id,
                        patch: {
                          completed: t.completed ? 0 : 1,
                          completedAt: t.completed ? null : new Date().toISOString(),
                        },
                      })
                    }
                    onDelete={() => deleteTask.mutate(t.id)}
                    onMove={() => updateTask.mutate({ id: t.id, patch: { list: "backlog" } })}
                  />
                ))}
              </div>
            </div>

            {/* Backlog */}
            <div className="glass rounded-2xl p-6" data-testid="section-backlog">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mono">Section 03</div>
                  <h2 className="display-serif text-2xl mt-1 text-muted-foreground">Backlog</h2>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mono">Queue</div>
                  <div className="display-serif text-2xl text-muted-foreground">
                    {backlogTasks.filter((t) => !t.completed).length}
                  </div>
                </div>
              </div>

              <TaskAdder list="backlog" onAdd={(title, priority, list) => createTask.mutate({ title, priority, list })} />

              <div className="mt-4 space-y-1.5">
                {backlogTasks.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground/70 text-sm">
                    Backlog is clear.
                  </div>
                )}
                {backlogTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() =>
                      updateTask.mutate({
                        id: t.id,
                        patch: {
                          completed: t.completed ? 0 : 1,
                          completedAt: t.completed ? null : new Date().toISOString(),
                        },
                      })
                    }
                    onDelete={() => deleteTask.mutate(t.id)}
                    onMove={() => updateTask.mutate({ id: t.id, patch: { list: "today" } })}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ANALYTICS ROW */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Compound chart */}
          <section className="lg:col-span-8 glass-strong rounded-2xl p-6" data-testid="section-compound">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mono">Section 04</div>
                <h2 className="display-serif text-2xl mt-1">The Compound Effect</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Total habits stacked over time. Every check compounds.
                </p>
              </div>
              <div className="flex gap-1 glass-inset rounded-lg p-1">
                {[30, 90].map((r) => (
                  <button
                    key={r}
                    onClick={() => setCompoundRange(r as 30 | 90)}
                    className={cn(
                      "px-3 h-7 rounded-md text-xs mono uppercase tracking-wider transition-all",
                      compoundRange === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={compoundData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(199 89% 65%)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(199 89% 65%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 25% 20%)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    stroke="hsl(210 15% 50%)"
                    style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                    interval={compoundRange === 30 ? 4 : 14}
                  />
                  <YAxis
                    stroke="hsl(210 15% 50%)"
                    style={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 40% 6%)",
                      border: "1px solid hsl(199 89% 65% / 0.3)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={shortDate}
                    formatter={(v: number, k: string) => [v, k === "cumulative" ? "Cumulative" : "Daily hits"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="hsl(199 89% 65%)"
                    strokeWidth={2}
                    fill="url(#grad1)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Weekly bars */}
          <section className="lg:col-span-4 glass-strong rounded-2xl p-6" data-testid="section-weekly">
            <div className="mb-5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-primary/70 mono">Section 05</div>
              <h2 className="display-serif text-2xl mt-1">Last 7 Days</h2>
            </div>

            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBars} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(210 25% 20%)" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(210 15% 50%)" style={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                  <YAxis stroke="hsl(210 15% 50%)" style={{ fontSize: 10, fontFamily: "JetBrains Mono" }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(220 40% 6%)",
                      border: "1px solid hsl(199 89% 65% / 0.3)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v}%`, "Completion"]}
                  />
                  <Bar dataKey="pct" fill="hsl(199 89% 65%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Per-habit rates */}
          <section className="lg:col-span-12 glass rounded-2xl p-6" data-testid="section-habit-rates">
            <div className="mb-5 flex items-baseline justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mono">Section 06</div>
                <h2 className="display-serif text-2xl mt-1">Habit Performance · 30d</h2>
              </div>
              <div className="text-xs text-muted-foreground mono">Rate = days hit ÷ 30</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {HABITS.map((h) => {
                const rate = habitRate(logs, h, today, 30);
                const streak7 = currentStreak(logs, h, today);
                return (
                  <div key={h.key} className="glass-inset rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg">{h.emoji}</span>
                      <div className="flex items-center gap-1 text-primary mono text-xs">
                        <Flame className="w-3 h-3" /> {streak7}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mb-1">{h.label}</div>
                    <div className="display-serif text-2xl">
                      {Math.round(rate * 100)}<span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary/60 to-primary"
                        style={{ width: `${rate * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="mt-10 py-6 flex items-center justify-between border-t border-white/5">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mono">
            Tyler's Daily Tracker · v1.0
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mono">
            Iron Man Mode · Engaged
          </div>
        </footer>
      </div>
    </div>
  );
}
