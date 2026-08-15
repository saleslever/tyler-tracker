/**
 * DataCenter — the categorized data store that Atlas pulls from.
 * Tyler can see everything Atlas knows: weights, macros, workouts,
 * fasts, sleep, steps, habits, uploads. Read-only tables, sortable
 * by newest first. Parchment/palette-2 light.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Weight, Utensils, Dumbbell, Flame, Bed, Footprints, Camera, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface BodyScan { date: string; weight: number | null; bodyFatPct: number | null; source: string | null; }
interface MacroLog { date: string; calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; }
interface WorkoutLog { id?: number; date: string; exercise: string; targetBodyPart: string; setNumber: number; reps: number | null; loadLbs: number | null; }
interface Fast { id: number; startedAt: string; endedAt: string | null; }
interface DailyLog { date: string; steps: number | null; sleepHours: number | null; sleepScore: number | null; restingHeartRate: number | null; water: number; workout: number; lowCarb: number; noAlcohol: number; }
interface Upload { id: number; category: string; filename: string; url?: string; createdAt: string; }

type Tab = "weights" | "macros" | "workouts" | "fasts" | "sleep" | "steps" | "habits" | "uploads";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "weights", label: "Weights", icon: Weight },
  { key: "macros", label: "Macros", icon: Utensils },
  { key: "workouts", label: "Workouts", icon: Dumbbell },
  { key: "fasts", label: "Fasts", icon: Flame },
  { key: "sleep", label: "Sleep", icon: Bed },
  { key: "steps", label: "Steps", icon: Footprints },
  { key: "habits", label: "Habits", icon: CheckSquare },
  { key: "uploads", label: "Uploads", icon: Camera },
];

function fmtDate(s: string): string {
  return new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
function fmtDateTime(s: string): string {
  return new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3.6e6;
}

export default function DataCenter() {
  const [tab, setTab] = useState<Tab>("weights");

  const { data: scans = [] } = useQuery<BodyScan[]>({ queryKey: ["/api/fitness/scans"] });
  const { data: macros = [] } = useQuery<MacroLog[]>({ queryKey: ["/api/fitness/macros?start=2020-01-01&end=2099-12-31"] });
  const { data: workouts = [] } = useQuery<WorkoutLog[]>({ queryKey: ["/api/fitness/workouts"] });
  const { data: fasts = [] } = useQuery<Fast[]>({ queryKey: ["/api/fasts"] });
  const { data: dailyLogs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: uploads = [] } = useQuery<Upload[]>({ queryKey: ["/api/uploads"] });

  // Sort newest first
  const scansSorted = [...scans].sort((a, b) => b.date.localeCompare(a.date));
  const macrosSorted = [...macros].sort((a, b) => b.date.localeCompare(a.date));
  const workoutsSorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date));
  const fastsSorted = [...fasts].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const dailySorted = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date));
  const uploadsSorted = [...uploads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const counts: Record<Tab, number> = {
    weights: scansSorted.length,
    macros: macrosSorted.length,
    workouts: workoutsSorted.length,
    fasts: fastsSorted.length,
    sleep: dailySorted.filter(d => d.sleepHours != null).length,
    steps: dailySorted.filter(d => d.steps != null).length,
    habits: dailySorted.length,
    uploads: uploadsSorted.length,
  };

  return (
    <div className="parchment min-h-screen pb-24">
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <header>
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight leading-none">DATA</h1>
          <p className="mt-2 text-[10px] md:text-xs tracking-[0.24em] uppercase text-primary font-medium">
            Everything Atlas Can See
          </p>
          <div className="mt-3 h-px w-48 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
        </header>

        {/* Tab bar */}
        <div className="ornament-panel">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-1 rounded transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[9px] tracking-widest uppercase font-semibold">{t.label}</span>
                  <span className={cn("text-[10px] font-mono", active ? "text-primary" : "text-muted-foreground/70")}>
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {tab === "weights" && (
          <DataTable
            headers={["Date", "Weight", "BF %", "Source"]}
            rows={scansSorted.map(s => [
              fmtDate(s.date),
              s.weight != null ? `${s.weight.toFixed(1)} lb` : "—",
              s.bodyFatPct != null ? `${s.bodyFatPct.toFixed(1)}%` : "—",
              s.source ?? "—",
            ])}
            empty="No weight entries yet. Screenshot your scale to Atlas."
          />
        )}

        {tab === "macros" && (
          <DataTable
            headers={["Date", "Calories", "Protein", "Carbs", "Fat"]}
            rows={macrosSorted.map(m => [
              fmtDate(m.date),
              m.calories != null ? m.calories.toLocaleString() : "—",
              m.proteinG != null ? `${Math.round(m.proteinG)}g` : "—",
              m.carbsG != null ? `${Math.round(m.carbsG)}g` : "—",
              m.fatG != null ? `${Math.round(m.fatG)}g` : "—",
            ])}
            empty="No macro entries yet. Screenshot MacroFactor/Cronometer to Atlas."
          />
        )}

        {tab === "workouts" && (
          <DataTable
            headers={["Date", "Exercise", "Body Part", "Set", "Reps", "Load"]}
            rows={workoutsSorted.map(w => [
              fmtDate(w.date),
              w.exercise,
              w.targetBodyPart,
              w.setNumber.toString(),
              w.reps?.toString() ?? "—",
              w.loadLbs != null ? `${w.loadLbs}lb` : "—",
            ])}
            empty="No workout sets logged yet."
          />
        )}

        {tab === "fasts" && (
          <DataTable
            headers={["Started", "Ended", "Duration"]}
            rows={fastsSorted.map(f => {
              const dur = f.endedAt ? `${hoursBetween(f.startedAt, f.endedAt).toFixed(1)}h` : "ongoing";
              return [fmtDateTime(f.startedAt), f.endedAt ? fmtDateTime(f.endedAt) : "—", dur];
            })}
            footer={<p className="text-[10px] tracking-widest uppercase text-muted-foreground text-center py-2">Edit or delete fasts on the Fast tab</p>}
            empty="No fasts logged."
          />
        )}

        {tab === "sleep" && (
          <DataTable
            headers={["Date", "Hours", "Score", "RHR"]}
            rows={dailySorted.filter(d => d.sleepHours != null).map(d => [
              fmtDate(d.date),
              d.sleepHours != null ? `${d.sleepHours.toFixed(1)}h` : "—",
              d.sleepScore?.toString() ?? "—",
              d.restingHeartRate != null ? `${d.restingHeartRate} bpm` : "—",
            ])}
            empty="No sleep data yet."
          />
        )}

        {tab === "steps" && (
          <DataTable
            headers={["Date", "Steps"]}
            rows={dailySorted.filter(d => d.steps != null).map(d => [
              fmtDate(d.date),
              d.steps!.toLocaleString(),
            ])}
            empty="No step data yet."
          />
        )}

        {tab === "habits" && (
          <DataTable
            headers={["Date", "Water", "Workout", "Low-Carb", "No Alcohol"]}
            rows={dailySorted.map(d => [
              fmtDate(d.date),
              d.water ? "✓" : "—",
              d.workout ? "✓" : "—",
              d.lowCarb ? "✓" : "—",
              d.noAlcohol ? "✓" : "—",
            ])}
            empty="No habit entries yet."
          />
        )}

        {tab === "uploads" && (
          <div className="space-y-2">
            {uploadsSorted.length === 0 ? (
              <div className="ornament-panel text-center py-8">
                <p className="text-sm text-muted-foreground">No uploads yet.</p>
              </div>
            ) : uploadsSorted.map(u => (
              <div key={u.id} className="ornament-panel flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-secondary/40 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{u.filename}</div>
                  <div className="text-[10px] tracking-widest uppercase text-muted-foreground">
                    {u.category} · {fmtDateTime(u.createdAt)}
                  </div>
                </div>
                {u.url && (
                  <a href={u.url} target="_blank" rel="noreferrer" className="text-[10px] tracking-widest uppercase text-primary hover:underline">
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DataTable({ headers, rows, empty, footer }: { headers: string[]; rows: (string | number)[][]; empty: string; footer?: React.ReactNode }) {
  if (rows.length === 0) {
    return (
      <div className="ornament-panel text-center py-8">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <div className="ornament-panel overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] tracking-widest uppercase text-muted-foreground font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn("border-b border-border/30", i % 2 === 0 && "bg-secondary/10")}>
              {row.map((cell, j) => (
                <td key={j} className={cn("px-3 py-2", j === 0 ? "font-mono text-xs text-muted-foreground" : "text-foreground")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
