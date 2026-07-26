import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DailyLog } from "@shared/schema";
import {
  useHabits,
  habitHit,
  dayScore,
  addDays as addDaysAnalytics,
  type HabitDef,
} from "@/lib/analytics";
import { useToday } from "@/hooks/useToday";
import { PageHeader } from "@/components/PageHeader";
import { Check, Flame, Volume2, VolumeX, ChevronLeft, ChevronRight, Calendar, Undo2, Trash2, Plus, Settings, X, GripVertical } from "lucide-react";
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

      {habit.kind === "num" && (() => {
        const stepSize = habit.key === "weight" || habit.key === "fastingHours" ? 0.1 : 1;
        const stepBig = habit.key === "steps" ? 500 : habit.key === "water" || habit.key === "vitamins" ? 1 : stepSize;
        const bump = (delta: number) => {
          const cur = parseFloat(localValue || "0") || 0;
          const next = Math.max(0, +(cur + delta).toFixed(2));
          const str = String(next);
          setLocalValue(str);
          flush(str);
        };
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => bump(-stepBig)}
              className="w-8 h-9 rounded bg-secondary/40 border border-border text-sm text-muted-foreground active:bg-secondary/70"
              aria-label={`Decrease ${habit.label}`}
              data-testid={`dec-${habit.key}`}
            >−</button>
            <input
              type="number"
              inputMode="decimal"
              enterKeyHint="done"
              step={stepSize}
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value);
                flush(e.target.value);
              }}
              onBlur={commitNow}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  commitNow();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="—"
              className="w-20 h-9 text-right rounded bg-secondary/50 border border-border px-2 text-sm focus:outline-none focus:border-foreground/50"
              data-testid={`input-${habit.key}`}
            />
            <button
              type="button"
              onClick={() => bump(stepBig)}
              className="w-8 h-9 rounded bg-secondary/40 border border-border text-sm text-muted-foreground active:bg-secondary/70"
              aria-label={`Increase ${habit.label}`}
              data-testid={`inc-${habit.key}`}
            >+</button>
          </div>
        );
      })()}

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

  const habits = useHabits();
  const score = dayScore(viewLog, habits);

  // Precompute per-habit streak + 30d rate in a SINGLE pass over the last 30 days.
  // Previously each row rebuilt its own Map — 20× the work.
  const habitStats = useMemo(() => {
    const stats = new Map<string, { streak: number; rate30: number }>();

    // Precompute the 30 dates once.
    const dates30: string[] = [];
    for (let i = 0; i < 30; i++) dates30.push(addDaysAnalytics(today, -i));
    const yesterdayStr = addDaysAnalytics(today, -1);

    for (const h of habits) {
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
  }, [byDate, today, habits]);

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

  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-10 py-6 md:py-10">
      {manageOpen && <ManageHabitsSheet onClose={() => setManageOpen(false)} habits={habits} />}
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

      <div className="flex items-center justify-between mb-3">
        <div className="microlabel text-muted-foreground">Habits</div>
        <button
          onClick={() => setManageOpen(true)}
          className="h-8 px-3 rounded border border-border hover:border-foreground/50 text-xs uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="btn-manage-habits"
        >
          <Settings className="w-3.5 h-3.5" /> Manage
        </button>
      </div>

      <div className="card-lux px-6">
        {habits.map((h) => {
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

// ============================================================================
// Manage Habits sheet — add / edit / delete / reorder
// ============================================================================
function ManageHabitsSheet({ onClose, habits }: { onClose: () => void; habits: HabitDef[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<HabitDef | null>(null);

  const createHabit = useMutation({
    mutationFn: async (data: Partial<HabitDef>) => {
      return await apiRequest("POST", "/api/habits", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      setShowAdd(false);
    },
  });

  const updateHabit = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<HabitDef> }) => {
      return await apiRequest("PATCH", `/api/habits/${id}`, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      setEditing(null);
    },
  });

  const deleteHabit = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/habits/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/habits"] }),
  });

  const reorder = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("POST", "/api/habits/reorder", { ids });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/habits"] }),
  });

  function move(idx: number, delta: number) {
    const next = [...habits];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    reorder.mutate(next.map((h) => h.id!).filter(Boolean));
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto" data-testid="sheet-manage-habits">
      <div className="max-w-2xl mx-auto px-6 md:px-10 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="microlabel text-muted-foreground">Settings</div>
            <h2 className="serif text-2xl md:text-3xl mt-1">Manage Habits</h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded border border-border hover:border-foreground/50 flex items-center justify-center transition-colors"
            data-testid="btn-close-manage"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="w-full h-11 rounded border-2 border-dashed border-border hover:border-foreground/50 hover:text-foreground text-muted-foreground text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-colors mb-4"
          data-testid="btn-add-habit"
        >
          <Plus className="w-4 h-4" /> Add new habit
        </button>

        {showAdd && <HabitEditor onSave={(d) => createHabit.mutate(d)} onCancel={() => setShowAdd(false)} saving={createHabit.isPending} />}

        <div className="card-lux divide-y divide-border">
          {habits.map((h, idx) => (
            <div key={h.id ?? h.key} className="py-3 flex items-center gap-3" data-testid={`habit-manage-${h.key}`}>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="w-6 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
                  aria-label="Move up"
                >↑</button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === habits.length - 1}
                  className="w-6 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20"
                  aria-label="Move down"
                >↓</button>
              </div>
              <div className="text-2xl w-8 flex justify-center">{h.emoji ?? "•"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{h.label}</div>
                <div className="text-xs text-muted-foreground">
                  {h.kind === "bool" ? "Yes / no" : `Number • ${h.goalDirection === "lte" ? "≤" : "≥"} ${h.goal ?? "—"}${h.unit ? " " + h.unit : ""}`}
                  {h.builtin === 1 && <span className="ml-2 text-[10px] uppercase tracking-wider">• Built-in</span>}
                </div>
              </div>
              <button
                onClick={() => setEditing(h)}
                className="h-8 px-2 rounded text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
                data-testid={`btn-edit-${h.key}`}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  const label = h.builtin === 1 ? `Hide “${h.label}”? (Built-ins keep their history and can be re-enabled later.)` : `Delete “${h.label}”? This removes it and all its logged values.`;
                  if (window.confirm(label)) deleteHabit.mutate(h.id!);
                }}
                className="h-8 w-8 rounded flex items-center justify-center text-muted-foreground hover:text-destructive border border-transparent hover:border-destructive/60"
                data-testid={`btn-delete-${h.key}`}
                aria-label={h.builtin === 1 ? "Hide" : "Delete"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {editing && (
          <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md card-lux p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="serif text-lg">Edit “{editing.label}”</div>
                <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              <HabitEditor
                initial={editing}
                onSave={(d) => updateHabit.mutate({ id: editing.id!, patch: d })}
                onCancel={() => setEditing(null)}
                saving={updateHabit.isPending}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HabitEditor({ initial, onSave, onCancel, saving }: {
  initial?: HabitDef;
  onSave: (h: Partial<HabitDef>) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [kind, setKind] = useState<"bool" | "num">(initial?.kind ?? "bool");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [goal, setGoal] = useState<string>(initial?.goal != null ? String(initial.goal) : "");
  const [goalDirection, setGoalDirection] = useState<"gte" | "lte">(initial?.goalDirection ?? "gte");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");

  const isBuiltin = initial?.builtin === 1;

  return (
    <div className="card-lux p-4 mb-4 space-y-3" data-testid="habit-editor">
      <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
          placeholder="🔥"
          className="h-10 rounded bg-secondary/50 border border-border text-center text-xl focus:outline-none focus:border-foreground/50"
          data-testid="input-habit-emoji"
          aria-label="Emoji"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Habit name (e.g. No Nicotine)"
          className="h-10 rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
          data-testid="input-habit-label"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setKind("bool")}
          disabled={isBuiltin}
          className={cn("flex-1 h-9 rounded border text-xs uppercase tracking-wider", kind === "bool" ? "border-foreground text-foreground" : "border-border text-muted-foreground", isBuiltin && "opacity-50")}
          data-testid="btn-kind-bool"
        >Yes / No</button>
        <button
          onClick={() => setKind("num")}
          disabled={isBuiltin}
          className={cn("flex-1 h-9 rounded border text-xs uppercase tracking-wider", kind === "num" ? "border-foreground text-foreground" : "border-border text-muted-foreground", isBuiltin && "opacity-50")}
          data-testid="btn-kind-num"
        >Number</button>
      </div>

      {kind === "num" && (
        <div className="grid grid-cols-[1fr_80px_1fr] gap-2">
          <div>
            <div className="microlabel mb-1">Direction</div>
            <div className="flex gap-1">
              <button onClick={() => setGoalDirection("gte")} className={cn("flex-1 h-9 rounded border text-xs", goalDirection === "gte" ? "border-foreground" : "border-border text-muted-foreground")}>≥ Goal</button>
              <button onClick={() => setGoalDirection("lte")} className={cn("flex-1 h-9 rounded border text-xs", goalDirection === "lte" ? "border-foreground" : "border-border text-muted-foreground")}>≤ Goal</button>
            </div>
          </div>
          <div>
            <div className="microlabel mb-1">Goal</div>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              inputMode="decimal"
              className="w-full h-9 rounded bg-secondary/50 border border-border px-2 text-sm text-center focus:outline-none focus:border-foreground/50"
              data-testid="input-habit-goal"
            />
          </div>
          <div>
            <div className="microlabel mb-1">Unit</div>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value.slice(0, 8))}
              placeholder="hrs, lb, bpm"
              className="w-full h-9 rounded bg-secondary/50 border border-border px-2 text-sm focus:outline-none focus:border-foreground/50"
              data-testid="input-habit-unit"
            />
          </div>
        </div>
      )}

      <div>
        <div className="microlabel mb-1">Hint (optional)</div>
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Short description"
          className="w-full h-9 rounded bg-secondary/50 border border-border px-3 text-sm focus:outline-none focus:border-foreground/50"
          data-testid="input-habit-hint"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 h-10 rounded border border-border text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground"
          data-testid="btn-cancel-habit"
        >Cancel</button>
        <button
          onClick={() => {
            if (!label.trim()) return;
            const payload: Partial<HabitDef> = {
              label: label.trim(),
              kind,
              emoji: emoji.trim() || null,
              hint: hint.trim() || null,
              goal: kind === "num" && goal !== "" ? Number(goal) : null,
              goalDirection: kind === "num" ? goalDirection : null,
              unit: kind === "num" ? (unit.trim() || null) : null,
            };
            onSave(payload);
          }}
          disabled={!label.trim() || !!saving}
          className="flex-1 h-10 rounded bg-foreground text-background text-sm uppercase tracking-wider font-medium disabled:opacity-50"
          data-testid="btn-save-habit"
        >{saving ? "Saving…" : (initial ? "Save" : "Create")}</button>
      </div>
    </div>
  );
}
