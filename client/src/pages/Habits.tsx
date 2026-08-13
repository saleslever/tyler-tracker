import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { useToday } from "@/hooks/useToday";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Target, Check, X as XIcon, Minus } from "lucide-react";

/**
 * Habits — warm-gold rebuild.
 *
 * NOT a gamified checkbox tracker. Instead, this is a read-only mirror of the
 * Feb 2027 cut goals that auto-populates from:
 *   - body_scans        (weight)
 *   - macro_logs        (protein hit, calories hit)
 *   - workout_logs      (sets logged that day)
 *   - fasts             (fasting window hit)
 *
 * Rows the user cares about:
 *   1. Weigh in (AM)                — from body_scans (source=wyze_daily)
 *   2. Protein ≥ target             — from macro_logs
 *   3. Calories ≤ target            — from macro_logs
 *   4. Fasted 16-18h                — from fasts (Fasting page)
 *   5. Sets logged (moved bodyparts under 24/wk cap forward) — from workout_logs
 *
 * No manual toggling. Every row is data-derived; if the data is there, the row
 * is green. Uploading a screenshot in Coach populates the underlying tables,
 * which flip these rows.
 */

interface FitnessTarget {
  calories: number | null;
  proteinGramsMin: number | null;
  proteinGramsMax: number | null;
  fastingHoursMin: number | null;
  fastingHoursMax: number | null;
  effectiveDate: string;
}

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

interface WorkoutLog {
  date: string;
  exercise: string;
  targetBodyPart: string;
  setNumber: number;
  reps: number | null;
  loadLbs: number | null;
}

interface Fast {
  startAt: string;
  endAt: string | null;
  durationMinutes?: number | null;
}

interface FitnessGoal {
  targetWeight: number | null;
  targetBodyFatPct: number | null;
  targetDate: string | null;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return toDateStr(d);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

type RowState = "hit" | "miss" | "pending";

function StatusPill({ state, label }: { state: RowState; label: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-widest font-semibold",
        state === "hit" && "bg-primary/15 text-primary border border-primary/30",
        state === "miss" && "bg-destructive/10 text-destructive border border-destructive/30",
        state === "pending" && "bg-muted text-muted-foreground border border-border",
      )}
    >
      {state === "hit" && <Check className="w-3 h-3" strokeWidth={3} />}
      {state === "miss" && <XIcon className="w-3 h-3" strokeWidth={3} />}
      {state === "pending" && <Minus className="w-3 h-3" strokeWidth={3} />}
      {label}
    </div>
  );
}

function HabitRow({
  label,
  hint,
  value,
  target,
  state,
  progressPct,
}: {
  label: string;
  hint: string;
  value: string;
  target: string;
  state: RowState;
  progressPct?: number;
}) {
  return (
    <div className="py-5 border-b border-border last:border-b-0" data-testid={`habit-row-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <div>
          <div className="font-display text-sm md:text-base font-semibold tracking-tight">
            {label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        </div>
        <StatusPill state={state} label={state === "hit" ? "hit" : state === "miss" ? "miss" : "pending"} />
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <div className="font-mono text-lg md:text-xl font-semibold tabular-nums">
          {value}
        </div>
        <div className="text-xs text-muted-foreground font-mono tabular-nums">
          target · {target}
        </div>
      </div>
      {progressPct !== undefined && (
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              state === "hit" ? "bg-primary" : state === "miss" ? "bg-destructive/60" : "bg-muted-foreground/40",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function Habits() {
  const today = useToday();
  const [selectedDate, setSelectedDate] = useState(today);

  const targetQuery = useQuery<FitnessTarget | null>({
    queryKey: ["/api/fitness/target"],
    staleTime: 60_000,
  });

  const contextQuery = useQuery<any>({
    queryKey: ["/api/coach/context"],
    staleTime: 60_000,
  });
  const goal: FitnessGoal | null = contextQuery.data?.goal ?? null;

  const scansQuery = useQuery<BodyScan[]>({
    queryKey: ["/api/fitness/scans"],
    staleTime: 60_000,
  });

  const macrosQuery = useQuery<MacroLog | null>({
    queryKey: ["/api/fitness/macros", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/fitness/macros/${selectedDate}`);
      if (!r.ok) return null;
      const j = await r.json();
      return j ?? null;
    },
    staleTime: 30_000,
  });

  const dayWorkoutQuery = useQuery<WorkoutLog[]>({
    queryKey: ["/api/fitness/workouts/log", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/fitness/workouts/log/${selectedDate}`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const fastsQuery = useQuery<Fast[]>({
    queryKey: ["/api/fasts"],
    staleTime: 60_000,
  });

  const target = targetQuery.data;

  // Weight for the selected day (either full scan or wyze_daily)
  const dayScan = useMemo(() => {
    return (scansQuery.data ?? []).find(s => s.date === selectedDate) ?? null;
  }, [scansQuery.data, selectedDate]);

  // Latest scan for goal-remaining calc
  const latestScan = useMemo(() => {
    const arr = scansQuery.data ?? [];
    if (arr.length === 0) return null;
    return [...arr].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  }, [scansQuery.data]);

  // Fast for selected day (any fast that ended on this day or is still active today)
  const dayFast = useMemo(() => {
    const fasts = fastsQuery.data ?? [];
    return fasts.find(f => {
      const startDay = f.startAt?.slice(0, 10);
      const endDay = f.endAt?.slice(0, 10);
      return startDay === selectedDate || endDay === selectedDate;
    }) ?? null;
  }, [fastsQuery.data, selectedDate]);

  // Fast duration in hours (either recorded, or elapsed if still open)
  const fastHours = useMemo(() => {
    if (!dayFast) return null;
    if (dayFast.durationMinutes != null) return dayFast.durationMinutes / 60;
    if (!dayFast.endAt) {
      // Ongoing fast
      const ms = Date.now() - new Date(dayFast.startAt).getTime();
      return ms / 3_600_000;
    }
    const ms = new Date(dayFast.endAt).getTime() - new Date(dayFast.startAt).getTime();
    return ms / 3_600_000;
  }, [dayFast]);

  // Sets on this day (grouped by body part)
  const setsByBodyPart = useMemo(() => {
    const m = new Map<string, number>();
    (dayWorkoutQuery.data ?? []).forEach(w => {
      m.set(w.targetBodyPart, (m.get(w.targetBodyPart) ?? 0) + 1);
    });
    return m;
  }, [dayWorkoutQuery.data]);
  const totalSetsToday = useMemo(
    () => Array.from(setsByBodyPart.values()).reduce((a, b) => a + b, 0),
    [setsByBodyPart],
  );

  // Row states
  const weightState: RowState = dayScan?.weight != null ? "hit" : "pending";
  const proteinTarget = target?.proteinGramsMin ?? null;
  const proteinLogged = macrosQuery.data?.proteinG ?? null;
  const proteinState: RowState =
    proteinLogged == null || proteinTarget == null
      ? "pending"
      : proteinLogged >= proteinTarget
      ? "hit"
      : "miss";
  const proteinPct = proteinLogged && proteinTarget ? (proteinLogged / proteinTarget) * 100 : undefined;

  const calorieTarget = target?.calories ?? null;
  const caloriesLogged = macrosQuery.data?.calories ?? null;
  const calorieState: RowState =
    caloriesLogged == null || calorieTarget == null
      ? "pending"
      : caloriesLogged <= calorieTarget
      ? "hit"
      : "miss";
  const caloriePct = caloriesLogged && calorieTarget ? (caloriesLogged / calorieTarget) * 100 : undefined;

  const fastMin = target?.fastingHoursMin ?? 16;
  const fastMax = target?.fastingHoursMax ?? 18;
  const fastState: RowState =
    fastHours == null
      ? "pending"
      : fastHours >= fastMin
      ? "hit"
      : "miss";
  const fastPct = fastHours != null ? (fastHours / fastMax) * 100 : undefined;

  const setsState: RowState =
    totalSetsToday === 0 ? "pending" : totalSetsToday >= 6 ? "hit" : "miss";

  // Progress toward Feb 2027 goal
  const weightRemaining =
    latestScan?.weight != null && goal?.targetWeight != null
      ? latestScan.weight - goal.targetWeight
      : null;

  const bfRemaining =
    latestScan?.bodyFatPct != null && goal?.targetBodyFatPct != null
      ? latestScan.bodyFatPct - goal.targetBodyFatPct
      : null;

  const isToday = selectedDate === today;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10" data-testid="page-habits">
      <PageHeader title="Discipline" subtitle="The five daily levers that move the Feb 2027 cut." />

      {/* Goal banner */}
      {goal && (
        <div className="mt-4 mb-6 p-4 md:p-5 card-lux rounded-md border border-primary/30">
          <div className="flex items-start gap-3">
            <Target className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Goal weight</div>
                <div className="font-mono text-lg font-semibold tabular-nums">{goal.targetWeight ?? "?"} lb</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Goal BF%</div>
                <div className="font-mono text-lg font-semibold tabular-nums">{goal.targetBodyFatPct ?? "?"}%</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">To lose</div>
                <div className="font-mono text-lg font-semibold tabular-nums text-primary">
                  {weightRemaining != null ? `${weightRemaining.toFixed(1)} lb` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">BF% to drop</div>
                <div className="font-mono text-lg font-semibold tabular-nums text-primary">
                  {bfRemaining != null ? `${bfRemaining.toFixed(1)} pts` : "—"}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Deadline · {goal.targetDate ?? "not set"}
          </div>
        </div>
      )}

      {/* Date navigator */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="p-2 rounded hover:bg-muted transition-colors"
          data-testid="prev-day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="font-display text-lg md:text-xl font-semibold tracking-tight">
            {isToday ? "Today" : formatDate(selectedDate)}
          </div>
          <div className="text-xs text-muted-foreground font-mono">{selectedDate}</div>
        </div>
        <button
          onClick={() => selectedDate < today && setSelectedDate(addDays(selectedDate, 1))}
          className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-30"
          disabled={selectedDate >= today}
          data-testid="next-day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Habit rows */}
      <div className="card-lux rounded-md p-4 md:p-6 border border-border">
        <HabitRow
          label="Weigh in (AM)"
          hint="Auto-mirrored from Wyze daily. Log a screenshot in Coach to fill this."
          value={dayScan?.weight != null ? `${dayScan.weight.toFixed(1)} lb` : "no weight logged"}
          target={goal?.targetWeight ? `≤ ${goal.targetWeight} lb someday` : "any"}
          state={weightState}
        />
        <HabitRow
          label="Protein"
          hint="From MacroFactor logs. Screenshot in Coach flips this row."
          value={proteinLogged != null ? `${Math.round(proteinLogged)}g` : "not logged"}
          target={proteinTarget ? `≥ ${proteinTarget}g` : "no target set"}
          state={proteinState}
          progressPct={proteinPct}
        />
        <HabitRow
          label="Calories"
          hint="From MacroFactor logs. Under the target = hit."
          value={caloriesLogged != null ? `${Math.round(caloriesLogged)} kcal` : "not logged"}
          target={calorieTarget ? `≤ ${calorieTarget} kcal` : "no target set"}
          state={calorieState}
          progressPct={caloriePct}
        />
        <HabitRow
          label="Fast 16–18h"
          hint="From the Fasting page. Timer must reach at least 16h."
          value={fastHours != null ? `${fastHours.toFixed(1)}h` : "no fast today"}
          target={`${fastMin}–${fastMax}h`}
          state={fastState}
          progressPct={fastPct}
        />
        <HabitRow
          label="Sets logged"
          hint="Immutable sets from workout_logs. Rest days show pending."
          value={totalSetsToday > 0 ? `${totalSetsToday} sets` : "no sets logged"}
          target="≥ 6 sets on training days"
          state={setsState}
        />
      </div>

      {/* Sets breakdown for the day */}
      {totalSetsToday > 0 && (
        <div className="mt-6 card-lux rounded-md p-4 md:p-6 border border-border">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Body parts trained today
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from(setsByBodyPart.entries()).sort((a, b) => b[1] - a[1]).map(([part, count]) => (
              <div
                key={part}
                className="px-3 py-1.5 rounded-sm bg-primary/10 border border-primary/30 text-xs"
              >
                <span className="font-semibold">{part}</span>
                <span className="text-muted-foreground ml-1.5 font-mono">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-xs text-muted-foreground text-center">
        No toggles here. Discipline is what the numbers show — upload a screenshot in Coach to move them.
      </div>
    </div>
  );
}
