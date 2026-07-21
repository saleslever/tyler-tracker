import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DailyLog } from "@shared/schema";
import {
  HABITS,
  habitHit,
  dayScore,
  addDays as addDaysAnalytics,
  type HabitDef,
} from "@/lib/analytics";
import { useToday } from "@/hooks/useToday";
import { PageHeader } from "@/components/PageHeader";
import { Check, Flame, Volume2, VolumeX, ChevronLeft, ChevronRight, Calendar, Undo2, Trash2, Moon, Heart, Footprints, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSound, useMuteState, haptic } from "@/hooks/useSound";

// Memoized so unrelated state changes (e.g. typing in another row) don't
// re-render every row.
const HabitRow = memo(function HabitRow({
  habit, rawValue, hit, streak, rate30, onToggle, onNum,
}: {
  habit: HabitDef;
  rawValue: number | null;
  hit: boolean;
  streak: number;
  rate30: number;
  onToggle: () => void;
  onNum: (v: number | null) => void;
}) {
  // Per-row visual pulse when the habit gets checked. Reset key-triggered.
  const [pulseKey, setPulseKey] = useState(0);
  const prevHitRef = useRef(hit);
  useEffect(() => {
    if (!prevHitRef.current && hit) {
      // Only pulse on the 0 → 1 transition (a fresh check)
      setPulseKey(k => k + 1);
    }
    prevHitRef.current = hit;
  }, [hit]);
  // Local input state so typing feels instant; parent only sees debounced value.
  const [localValue, setLocalValue] = useState<string>(
    rawValue == null ? "" : String(rawValue)
  );
  const localRef = useRef(localValue);
  localRef.current = localValue;

  // Sync local -> external when the underlying data changes (date switch, reset, etc.)
  // Skip when the change came from *our* debounced flush by comparing values.
  useEffect(() => {
    const external = rawValue == null ? "" : String(rawValue);
    if (external !== localRef.current) {
      setLocalValue(external);
    }
  }, [rawValue]);

  // Debounced flush to parent.
  const debounceRef = useRef<number | null>(null);
  const flush = useCallback((v: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onNum(v === "" ? null : Number(v));
    }, 400);
  }, [onNum]);

  // On blur, flush immediately so the value is committed before leaving.
  const commitNow = useCallback(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onNum(localRef.current === "" ? null : Number(localRef.current));
  }, [onNum]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "flex items-center gap-4 py-4 border-b border-border last:border-b-0 transition-colors",
        hit ? "opacity-100" : "opacity-95"
      )}
      data-testid={`habit-row-${habit.key}`}
    >
      {habit.kind === "bool" ? (
        <div className="relative shrink-0">
          <button
            onClick={onToggle}
            className={cn(
              "relative shrink-0 w-9 h-9 rounded flex items-center justify-center border transition-all active:scale-90",
              hit
                ? "bg-foreground text-background border-foreground shadow-[0_0_0_2px_rgba(255,255,255,0.06)]"
                : "bg-transparent border-border hover:border-foreground/50"
            )}
            data-testid={`toggle-${habit.key}`}
            aria-label={`Toggle ${habit.label}`}
          >
            {hit && <Check className="w-4 h-4" strokeWidth={3} />}
          </button>
          {/* Pulse ring — fires on 0→1 transition, animates outward and fades */}
          {pulseKey > 0 && (
            <span
              key={`pulse-${pulseKey}`}
              className="pointer-events-none absolute inset-0 rounded ring-2 ring-amber-400/70 animate-habit-pulse"
              aria-hidden="true"
            />
          )}
          {/* +1 XP floater */}
          {pulseKey > 0 && (
            <span
              key={`xp-${pulseKey}`}
              className="pointer-events-none absolute left-1/2 -top-1 -translate-x-1/2 text-[10px] font-semibold tracking-wider text-amber-300 animate-habit-xp"
              aria-hidden="true"
            >
              +1
            </span>
          )}
        </div>
      ) : (
        <div className="shrink-0 w-9 h-9 rounded flex items-center justify-center border border-border text-base">
          {habit.emoji}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{habit.label}</div>
        {habit.kind === "num" && habit.goal != null && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Target: {habit.goalDirection === "lte" ? "≤" : "≥"} {habit.goal.toLocaleString()}
            {habit.unit && ` ${habit.unit}`}
          </div>
        )}
        {habit.hint && habit.kind === "bool" && (
          <div className="text-xs text-muted-foreground mt-0.5">{habit.hint}</div>
        )}
      </div>

      {habit.kind === "num" && (
        <input
          type="number"
          inputMode="decimal"
          step={habit.key === "weight" || habit.key === "fastingHours" ? "0.1" : "1"}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            flush(e.target.value);
          }}
          onBlur={commitNow}
          placeholder="—"
          className="w-24 h-9 text-right rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
          data-testid={`input-${habit.key}`}
        />
      )}

      <div className="w-16 text-right">
        <div className="text-xs text-muted-foreground">30d</div>
        <div className="text-sm font-medium">{Math.round(rate30 * 100)}%</div>
      </div>

      <div className={cn("w-14 flex items-center justify-end gap-1 text-sm", streak > 0 ? "text-foreground" : "text-muted-foreground/50")}>
        {streak > 0 ? (
          <>
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            {streak}
          </>
        ) : "—"}
      </div>
    </div>
  );
});

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatDateLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  if (dateStr === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function Habits() {
  const today = useToday();
  const [viewDate, setViewDate] = useState(today);

  // Keep viewDate anchored to today when today changes (midnight rollover)
  // unless the user is intentionally browsing history.
  const prevTodayRef = useRef(today);
  useEffect(() => {
    if (viewDate === prevTodayRef.current) {
      setViewDate(today);
    }
    prevTodayRef.current = today;
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  const isToday = viewDate === today;
  const isFuture = viewDate > today;

  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });

  // Build a date→log index ONCE per logs change. Every downstream calc reuses it.
  const byDate = useMemo(() => {
    const m = new Map<string, DailyLog>();
    for (const l of logs) m.set(l.date, l);
    return m;
  }, [logs]);

  const viewLog = byDate.get(viewDate);

  // Optimistic PATCH: write to cache immediately, server catches up.
  const patch = useMutation({
    mutationFn: async ({ date, patch: p }: { date: string; patch: Record<string, any> }) => {
      await apiRequest("PATCH", `/api/logs/${date}`, p);
    },
    onMutate: async ({ date, patch: p }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/logs"] });
      const prev = queryClient.getQueryData<DailyLog[]>(["/api/logs"]) ?? [];
      const existing = prev.find((l) => l.date === date);
      let next: DailyLog[];
      if (existing) {
        next = prev.map((l) => (l.date === date ? { ...l, ...p } : l));
      } else {
        next = [...prev, { id: -Date.now(), date, ...p } as any];
      }
      queryClient.setQueryData(["/api/logs"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/logs"], ctx.prev);
    },
    // No onSettled refetch — the optimistic write matches server state.
    // If it ever drifts, a page refresh or midnight rollover invalidates it.
  });

  const clearDay = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/logs/${viewDate}`);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/logs"] });
      const prev = queryClient.getQueryData<DailyLog[]>(["/api/logs"]) ?? [];
      queryClient.setQueryData(["/api/logs"], prev.filter((l) => l.date !== viewDate));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/logs"], ctx.prev);
    },
  });

  const score = dayScore(viewLog);

  // Precompute per-habit streak + 30d rate in a SINGLE pass over the last 30 days.
  // Previously each row rebuilt its own Map — 20× the work.
  const habitStats = useMemo(() => {
    const stats = new Map<string, { streak: number; rate30: number }>();

    // Precompute the 30 dates once.
    const dates30: string[] = [];
    for (let i = 0; i < 30; i++) dates30.push(addDaysAnalytics(today, -i));
    const yesterdayStr = addDaysAnalytics(today, -1);

    for (const h of HABITS) {
      // 30d rate
      let hits = 0;
      for (const d of dates30) {
        if (habitHit(byDate.get(d), h)) hits++;
      }
      // Current streak
      let streak = 0;
      let cursor = today;
      if (!habitHit(byDate.get(cursor), h)) {
        cursor = yesterdayStr;
      }
      while (habitHit(byDate.get(cursor), h)) {
        streak++;
        cursor = addDaysAnalytics(cursor, -1);
        if (streak > 365) break; // safety
      }
      stats.set(h.key, { streak, rate30: hits / 30 });
    }
    return stats;
  }, [byDate, today]);

  const [muted, setMutedState] = useMuteState();

  // Fire the "day perfect" flourish when TODAY's score crosses to 1.0.
  // (Don't fire when scrubbing history.)
  const prevScoreRef = useRef<number>(score);
  useEffect(() => {
    if (isToday && prevScoreRef.current < 1 && score >= 1) {
      playSound("perfect");
    }
    prevScoreRef.current = score;
  }, [score, isToday]);

  // Helper: fire the tick + haptic when a habit transitions to hit,
  // or the uncheck sound if it transitions the other way.
  function playCheckIfNewlyHit(habit: HabitDef, prevRaw: any, nextRaw: any) {
    if (habit.kind === "bool") {
      if (prevRaw !== 1 && nextRaw === 1) {
        playSound("tick");
        haptic("tick");
      } else if (prevRaw === 1 && nextRaw !== 1) {
        playSound("uncheck");
        haptic("warning");
      }
      return;
    }
    // numeric habit — evaluate hit against goal
    if (habit.goal == null) return;
    const wasHit = wasNumericHit(habit, prevRaw);
    const nowHit = wasNumericHit(habit, nextRaw);
    if (!wasHit && nowHit) {
      playSound("tick");
      haptic("tick");
    } else if (wasHit && !nowHit) {
      playSound("uncheck");
      haptic("warning");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-10 py-6 md:py-10">
      <PageHeader
        title="Daily Habits"
        subtitle={formatDateLabel(viewDate, today)}
        actions={
          <div className="text-right">
            <div className="microlabel">{isToday ? "Today" : "Score"}</div>
            <div className="num-display text-3xl text-foreground">{Math.round(score * 100)}%</div>
          </div>
        }
      />

      {/* Date navigator */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewDate(addDays(viewDate, -1))}
            className="w-9 h-9 rounded border border-border hover:border-foreground/50 flex items-center justify-center transition-colors"
            data-testid="btn-prev-day"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <input
              type="date"
              value={viewDate}
              max={today}
              onChange={(e) => e.target.value && setViewDate(e.target.value)}
              className="h-9 rounded bg-secondary/50 border border-border pl-8 pr-3 text-sm focus:outline-none focus:border-foreground/50"
              data-testid="input-date"
            />
            <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => setViewDate(addDays(viewDate, 1))}
            disabled={isToday}
            className="w-9 h-9 rounded border border-border hover:border-foreground/50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:border-border"
            data-testid="btn-next-day"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isToday && (
            <button
              onClick={() => setViewDate(today)}
              className="h-9 px-3 rounded border border-border hover:border-foreground/50 text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              data-testid="btn-back-today"
            >
              <Undo2 className="w-3.5 h-3.5" /> Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {viewLog && (
            <button
              onClick={() => {
                if (window.confirm(`Clear all habit data for ${formatDateLabel(viewDate, today)}?`)) {
                  clearDay.mutate();
                }
              }}
              className="h-9 px-3 rounded border border-border hover:border-destructive/60 text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors"
              data-testid="btn-clear-day"
              title="Clear this day"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear day
            </button>
          )}
          <button
            onClick={() => setMutedState(!muted)}
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            data-testid="toggle-sound"
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {muted ? "Sound Off" : "Sound On"}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-secondary overflow-hidden mb-8">
        <div
          className="h-full bg-foreground transition-all duration-500"
          style={{ width: `${score * 100}%` }}
        />
      </div>

      {/* Health metrics from Oura / Apple Health */}
      <HealthCard log={viewLog} />

      <div className="card-lux px-6">
        {HABITS.map((h) => {
          const stats = habitStats.get(h.key)!;
          const rawValue = viewLog ? ((viewLog as any)[h.key] ?? null) : null;
          const hit = habitHit(viewLog, h);
          return (
            <HabitRow
              key={h.key}
              habit={h}
              rawValue={rawValue}
              hit={hit}
              streak={stats.streak}
              rate30={stats.rate30}
              onToggle={() => {
                if (isFuture) return;
                const cur = viewLog ? (viewLog as any)[h.key] : 0;
                const next = cur === 1 ? 0 : 1;
                if (isToday) playCheckIfNewlyHit(h, cur, next);
                patch.mutate({ date: viewDate, patch: { [h.key]: next } });
              }}
              onNum={(v) => {
                if (isFuture) return;
                const cur = viewLog ? (viewLog as any)[h.key] : null;
                if (isToday) playCheckIfNewlyHit(h, cur, v);
                patch.mutate({ date: viewDate, patch: { [h.key]: v } });
              }}
            />
          );
        })}
      </div>

      {!isToday && (
        <div className="text-xs text-muted-foreground mt-4 text-center">
          Editing history — changes save to <span className="text-foreground">{viewDate}</span>.
        </div>
      )}
    </div>
  );
}

function wasNumericHit(habit: HabitDef, raw: any): boolean {
  if (raw == null || raw === "" || habit.goal == null) return false;
  const v = Number(raw);
  if (Number.isNaN(v)) return false;
  if (habit.goalDirection === "lte") return v <= habit.goal;
  return v >= habit.goal;
}

/**
 * HealthCard — surfaces Oura data pulled via Apple Health.
 *
 * Renders four tiles for the selected day: sleep hours, sleep score,
 * resting HR, steps. Empty tiles show "—" so the layout stays intentional
 * before the first sync. Values light up gold once they land.
 */
function HealthCard({ log }: { log?: DailyLog }) {
  const sh = log?.sleepHours ?? null;
  const ss = log?.sleepScore ?? null;
  const rhr = log?.restingHeartRate ?? null;
  const steps = log?.steps ?? null;
  const anyData = sh != null || ss != null || rhr != null || steps != null;

  return (
    <div className="mb-8 rounded-sm border border-[#2a2a2a] bg-[#0a0908] p-5" data-testid="health-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 opacity-70" />
          <div className="microlabel">Body Signals</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {anyData ? "Oura · Apple Health" : "Sync from iPhone to populate"}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthTile
          icon={<Moon className="w-4 h-4" />}
          label="Sleep"
          value={sh != null ? formatHours(sh) : "—"}
          accent={sh != null}
          testId="tile-sleep-hours"
        />
        <HealthTile
          icon={<Moon className="w-4 h-4" />}
          label="Sleep Score"
          value={ss != null ? String(ss) : "—"}
          unit={ss != null ? "/100" : undefined}
          accent={ss != null}
          testId="tile-sleep-score"
        />
        <HealthTile
          icon={<Heart className="w-4 h-4" />}
          label="Resting HR"
          value={rhr != null ? String(rhr) : "—"}
          unit={rhr != null ? "bpm" : undefined}
          accent={rhr != null}
          testId="tile-resting-hr"
        />
        <HealthTile
          icon={<Footprints className="w-4 h-4" />}
          label="Steps"
          value={steps != null ? steps.toLocaleString() : "—"}
          accent={steps != null}
          testId="tile-steps"
        />
      </div>
    </div>
  );
}

function HealthTile({
  icon,
  label,
  value,
  unit,
  accent,
  testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  accent: boolean;
  testId: string;
}) {
  return (
    <div
      className="rounded-sm border border-[#2a2a2a] bg-[#0a0908] px-4 py-3"
      data-testid={testId}
    >
      <div className="flex items-center gap-1.5 opacity-70">
        {icon}
        <div className="microlabel">{label}</div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <div
          className="num-display text-2xl leading-none"
          style={{ color: accent ? "#e0b74f" : "#4a4a4a" }}
        >
          {value}
        </div>
        {unit && (
          <div
            className="text-[10px] uppercase tracking-[0.2em] opacity-60"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {unit}
          </div>
        )}
      </div>
    </div>
  );
}

function formatHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
}
