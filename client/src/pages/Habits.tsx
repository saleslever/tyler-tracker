/**
 * Habits — Tyler's exact daily checklist.
 * The 10 non-negotiables from the framework. Data-derived where possible,
 * manual toggle where not. Parchment/palette-2 light theme.
 */
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, Flame, Droplet, Wine, Zap, Dumbbell, Utensils, Footprints, Pill, Cigarette, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface DailyLog {
  date: string;
  fastingHours: number | null;
  weight: number | null;
  steps: number | null;
  water: number;
  vitamins: number;
  morningDrink: number;
  noAlcohol: number;
  noEnergyDrinks: number;
  workout: number;
  lowCarb: number;
  cheatDay: number;
  creatine: number;
  noNicotineAfter3: number;
  proteinHit: number;
  caloriesHit: number;
}

interface MacroLog {
  date: string;
  calories: number | null;
  proteinG: number | null;
}

interface Fast {
  startedAt: string;
  endedAt: string | null;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function isSaturday(dateStr: string): boolean {
  return new Date(dateStr + "T00:00:00").getDay() === 6;
}

export default function Habits() {
  const [date, setDate] = useState<string>(todayStr());
  const qc = useQueryClient();

  const { data: log } = useQuery<DailyLog | null>({ queryKey: [`/api/logs/${date}`] });
  const { data: macroToday } = useQuery<MacroLog | null>({ queryKey: [`/api/fitness/macros/${date}`] });
  const { data: fasts = [] } = useQuery<Fast[]>({ queryKey: ["/api/fasts"] });

  const patch = useMutation({
    mutationFn: async (body: Partial<DailyLog>) => {
      return apiRequest("PATCH", `/api/logs/${date}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/logs/${date}`] });
      qc.invalidateQueries({ queryKey: ["/api/logs"] });
      qc.invalidateQueries({ queryKey: ["/api/fitness/dashboard"] });
    },
  });

  // Derive data-driven states
  const derived = useMemo(() => {
    const proteinOk = macroToday ? (macroToday.proteinG ?? 0) >= 200 : false;
    const calorieCap = isSaturday(date) ? 3000 : 2000;
    const calorieOk = macroToday ? (macroToday.calories ?? 0) > 0 && (macroToday.calories ?? 0) <= calorieCap : false;

    // Fast hit if any fast that day (start or end date matches) has duration >= 16h
    const dayFasts = fasts.filter(f => {
      const startDate = f.startedAt.slice(0, 10);
      const endDate = f.endedAt?.slice(0, 10);
      return startDate === date || endDate === date;
    });
    const fastOk = dayFasts.some(f => {
      if (!f.endedAt) return false;
      const hrs = (new Date(f.endedAt).getTime() - new Date(f.startedAt).getTime()) / 3.6e6;
      return hrs >= 16;
    }) || (log?.fastingHours ?? 0) >= 16;

    const stepsOk = (log?.steps ?? 0) >= 10000;

    return { proteinOk, calorieOk, fastOk, stepsOk, calorieCap, calories: macroToday?.calories ?? 0, protein: macroToday?.proteinG ?? 0 };
  }, [macroToday, fasts, log, date]);

  const isToday = date === todayStr();
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const satBadge = isSaturday(date);

  function toggle(field: keyof DailyLog) {
    const current = (log as any)?.[field] ?? 0;
    patch.mutate({ [field]: current ? 0 : 1 } as any);
  }

  // Habit rows — Tyler's framework, in order.
  // Everything is MANUAL now. Tyler ticks each box himself.
  // Data-derived numbers (protein, calories, steps, fast duration) still show
  // as `meta` for reference, but they do NOT auto-check the row.
  const rows = [
    { key: "fast", label: "Fasted 16–20h", icon: Flame, done: (log?.fastCompleted ?? 0) === 1, manual: true, field: "fastCompleted" as const, meta: log?.fastingHours ? `${log.fastingHours.toFixed(1)}h` : undefined, hint: derived.fastOk ? "data says done" : undefined },
    { key: "lowCarb", label: satBadge ? "High-carb + basketball (Sat)" : "Low-carb / keto", icon: Utensils, done: satBadge ? (log?.cheatDay ?? 0) === 1 : (log?.lowCarb ?? 0) === 1, manual: true, field: satBadge ? "cheatDay" as const : "lowCarb" as const },
    { key: "protein", label: "Protein ≥ 200g", icon: Zap, done: (log?.proteinHit ?? 0) === 1, manual: true, field: "proteinHit" as const, meta: derived.protein > 0 ? `${Math.round(derived.protein)}g` : undefined, hint: derived.proteinOk ? "data says done" : undefined },
    { key: "cals", label: `Calories ≤ ${derived.calorieCap.toLocaleString()}`, icon: Utensils, done: (log?.caloriesHit ?? 0) === 1, manual: true, field: "caloriesHit" as const, meta: derived.calories > 0 ? `${derived.calories.toLocaleString()}` : undefined, hint: derived.calorieOk ? "data says done" : undefined },
    { key: "steps", label: "10,000 steps", icon: Footprints, done: (log?.stepsCompleted ?? 0) === 1, manual: true, field: "stepsCompleted" as const, meta: (log?.steps ?? 0) > 0 ? (log?.steps ?? 0).toLocaleString() : undefined, hint: derived.stepsOk ? "data says done" : undefined },
    { key: "water", label: "1 gallon water", icon: Droplet, done: (log?.water ?? 0) === 1, manual: true, field: "water" as const },
    { key: "workout", label: "Lifted (Mon/Tue/Thu/Fri)", icon: Dumbbell, done: (log?.workout ?? 0) === 1, manual: true, field: "workout" as const },
    { key: "creatine", label: "10g creatine", icon: Pill, done: (log?.creatine ?? 0) === 1, manual: true, field: "creatine" as const },
    { key: "noAlcohol", label: "No alcohol", icon: Wine, done: (log?.noAlcohol ?? 0) === 1, manual: true, field: "noAlcohol" as const },
    { key: "noNic", label: "No nicotine past 3pm", icon: Cigarette, done: (log?.noNicotineAfter3 ?? 0) === 1, manual: true, field: "noNicotineAfter3" as const },
  ];

  const doneCount = rows.filter(r => r.done).length;
  const pct = Math.round((doneCount / rows.length) * 100);

  return (
    <div className="parchment min-h-screen pb-24">
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <header>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight leading-none">HABITS</h1>
          <p className="mt-2 text-[10px] md:text-xs tracking-[0.24em] uppercase text-primary font-medium">
            The Ten Non-Negotiables
          </p>
          <div className="mt-3 h-px w-48 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        </header>

        {/* Date nav */}
        <div className="ornament-panel">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setDate(addDays(date, -1))} className="p-2 hover:bg-accent/10 rounded" aria-label="Previous day">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <div className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground">
                {isToday ? "Today" : ""}
              </div>
              <div className="font-display text-lg font-bold">{dateLabel}</div>
              {satBadge && (
                <div className="mt-1 inline-block text-[9px] tracking-widest uppercase text-primary border border-primary/40 px-2 py-0.5 rounded">
                  Saturday · High-Carb Day
                </div>
              )}
            </div>
            <button
              onClick={() => setDate(addDays(date, 1))}
              disabled={date >= todayStr()}
              className="p-2 hover:bg-accent/10 rounded disabled:opacity-30"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Score bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground">Discipline</span>
              <span className={cn("font-mono font-bold text-sm", pct >= 80 ? "text-green-700" : pct >= 50 ? "text-primary" : "text-muted-foreground")}>
                {doneCount}/{rows.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className={cn("h-full transition-all", pct >= 80 ? "bg-green-700" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Habits list */}
        <div className="space-y-2">
          {rows.map(row => {
            const Icon = row.icon;
            return (
              <button
                key={row.key}
                onClick={() => row.manual && (row as any).field && toggle((row as any).field)}
                disabled={!row.manual}
                className={cn(
                  "w-full ornament-panel flex items-center gap-3 text-left transition-all",
                  row.done && "!border-green-700/40 bg-green-50/30",
                  !row.manual && "cursor-default",
                  row.manual && "hover:!border-primary/40 active:scale-[0.99]"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border shrink-0 transition-colors",
                  row.done ? "border-green-700/50 bg-green-100/60 text-green-700" : "border-accent/30 bg-background text-muted-foreground"
                )}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-sm font-semibold", row.done && "text-green-800")}>{row.label}</div>
                  <div className="text-[10px] tracking-widest uppercase text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>Tap to toggle</span>
                    {row.meta && <span className="font-mono text-foreground/70">· {row.meta}</span>}
                    {(row as any).hint && <span className="text-green-700/80">· {(row as any).hint}</span>}
                  </div>
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                  row.done ? "border-green-700 bg-green-700 text-white" : "border-muted-foreground/40"
                )}>
                  {row.done && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M2.5 6.5 L5 9 L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="text-center pt-4 pb-2">
          <p className="text-[10px] tracking-[0.24em] uppercase text-muted-foreground">
            Manual only — tick each box when you complete it
          </p>
        </div>
      </div>
    </div>
  );
}
