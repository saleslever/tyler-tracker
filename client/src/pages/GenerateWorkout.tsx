/**
 * Generate Workout — plan review + set-by-set logging.
 *
 * Flow:
 *   1. Pick date + day type → hit Generate.
 *   2. Coach returns a proposal. You can edit exercise names (in case you swap
 *      at the gym) and add/remove exercises before saving.
 *   3. "Save as today's plan" persists to workout_plans.
 *   4. Log the workout live: enter reps + weight per set. Submit-when-done
 *      writes every set to workout_logs (immutable) and marks the workout done.
 *
 * Weekly ledger cap: any body part already at or above target for the current
 * week is highlighted RED at generate time and Coach is instructed not to add
 * sets to it. The client also validates the returned proposal and warns.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Zap, CheckCircle2, RefreshCcw, Dumbbell,
  Plus, Trash2, GripVertical, MessageCircle, Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface Exercise {
  name: string;
  targetBodyPart: string;
  sets: number;
  repsMin?: number;
  repsMax?: number;
  loadHint?: string;
  notes?: string;
}

interface Proposal {
  date: string;
  dayType: string;
  exercises: Exercise[];
  targetSetsByBodyPart?: Record<string, number>;
  error?: string;
}

interface GenerateResponse {
  proposal: Proposal;
  context: {
    ledger: Record<string, number>;
    weeklyTarget: number;
    recovery: any;
  };
}

interface SetLog {
  reps: string;
  loadLbs: string;
  rpe: string;
}

// Direct-target body parts (bench = chest, not triceps). Bicep = 2 heads + brachialis.
const BODY_PART_ORDER = [
  "chest", "back", "quads", "hamstrings", "glutes",
  "front_delts", "side_delts", "rear_delts",
  "biceps_long", "biceps_short", "brachialis", "triceps",
  "core", "calves", "forearms", "traps",
];

const DAY_TYPES = [
  { value: "strength", label: "Strength (full body)" },
  { value: "basketball", label: "Basketball" },
  { value: "cardio", label: "Cardio / Swim" },
  { value: "rest", label: "Rest" },
] as const;

function todayInDenver(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const d = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function prettyPart(p: string): string {
  return p.replace(/_/g, " ");
}

export default function GenerateWorkout() {
  const { toast } = useToast();
  const [date, setDate] = useState(todayInDenver());
  const [dayType, setDayType] = useState<string>("strength");
  const [editedPlan, setEditedPlan] = useState<Exercise[] | null>(null);
  const [savedPlanDate, setSavedPlanDate] = useState<string | null>(null);
  // key = `${exerciseIdx}-${setIdx}`
  const [setLogs, setSetLogs] = useState<Record<string, SetLog>>({});

  const contextQuery = useQuery<any>({ queryKey: ["/api/coach/context"] });
  const ledgerQuery = useQuery<Record<string, number>>({
    queryKey: ["/api/fitness/workouts/ledger", date],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/fitness/workouts/ledger/${date}`);
      return r.json();
    },
  });
  const savedPlanQuery = useQuery<any>({
    queryKey: ["/api/fitness/workouts/plan", date],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/fitness/workouts/plan/${date}`);
      return r.json();
    },
  });

  const weeklyTarget = contextQuery.data?.settings?.weeklySetsPerBodyPart ?? 24;
  const ledger = ledgerQuery.data ?? {};

  // Load an existing saved plan into the editor if we have one for this date.
  useEffect(() => {
    const p = savedPlanQuery.data;
    if (p && p.date === date && Array.isArray(p.exercises)) {
      setEditedPlan(p.exercises);
      setSavedPlanDate(p.date);
    } else if (!p) {
      setSavedPlanDate(null);
    }
  }, [savedPlanQuery.data, date]);

  const cappedParts = useMemo(() => {
    const cap = new Set<string>();
    for (const part of BODY_PART_ORDER) {
      if ((ledger[part] ?? 0) >= weeklyTarget) cap.add(part);
    }
    return cap;
  }, [ledger, weeklyTarget]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/fitness/workouts/generate", {
        date, dayType,
        cappedBodyParts: Array.from(cappedParts),
      });
      return (await r.json()) as GenerateResponse;
    },
    onSuccess: (data) => {
      if (data.proposal?.error) {
        toast({ title: "Coach couldn't generate", description: data.proposal.error, variant: "destructive" });
        return;
      }
      // Client-side guard: strip exercises that only credit capped parts
      const filtered = data.proposal.exercises.filter(ex => !cappedParts.has(ex.targetBodyPart));
      const removedCount = data.proposal.exercises.length - filtered.length;
      setEditedPlan(filtered);
      if (removedCount > 0) {
        toast({
          title: `Removed ${removedCount} capped exercise${removedCount > 1 ? "s" : ""}`,
          description: `Body part${removedCount > 1 ? "s were" : " was"} already at ${weeklyTarget}/wk.`,
        });
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editedPlan) return;
      const r = await apiRequest("POST", "/api/fitness/workouts/plan", {
        date, dayType,
        exercises: editedPlan,
        targetSetsByBodyPart: editedPlan.reduce((acc, ex) => {
          acc[ex.targetBodyPart] = (acc[ex.targetBodyPart] ?? 0) + ex.sets;
          return acc;
        }, {} as Record<string, number>),
        source: "coach_generated",
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/workouts/plan", date] });
      setSavedPlanDate(date);
      toast({ title: "Plan saved", description: "Log your sets as you finish them." });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!editedPlan) return;
      const sets: any[] = [];
      editedPlan.forEach((ex, exIdx) => {
        for (let s = 1; s <= ex.sets; s++) {
          const key = `${exIdx}-${s}`;
          const log = setLogs[key];
          if (!log) continue;
          const reps = log.reps ? Number(log.reps) : null;
          const load = log.loadLbs ? Number(log.loadLbs) : null;
          const rpe = log.rpe ? Number(log.rpe) : null;
          if (reps == null && load == null) continue; // skip completely blank sets
          sets.push({
            date,
            exercise: ex.name,
            targetBodyPart: ex.targetBodyPart,
            setNumber: s,
            reps, loadLbs: load, rpe,
            isSubstitution: 0,
            notes: `${dayType} — ${ex.repsMin ?? ""}-${ex.repsMax ?? ""} target`,
          });
        }
      });
      if (sets.length === 0) throw new Error("No sets to log — fill in reps or weight first.");
      const r = await apiRequest("POST", "/api/fitness/workouts/log", sets);
      return { rowsWritten: sets.length, response: await r.json() };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/workouts/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
      toast({
        title: `Workout logged`,
        description: `${data?.rowsWritten ?? 0} sets recorded — immutable audit entry.`,
      });
      setSetLogs({});
    },
    onError: (err: any) => {
      toast({ title: "Couldn't log workout", description: err?.message ?? String(err), variant: "destructive" });
    },
  });

  function updateExercise(i: number, patch: Partial<Exercise>) {
    if (!editedPlan) return;
    const next = [...editedPlan];
    next[i] = { ...next[i], ...patch };
    setEditedPlan(next);
  }

  function removeExercise(i: number) {
    if (!editedPlan) return;
    const next = editedPlan.filter((_, idx) => idx !== i);
    setEditedPlan(next);
  }

  function addExercise() {
    const next = [...(editedPlan ?? []), { name: "", targetBodyPart: "chest", sets: 3, repsMin: 8, repsMax: 12 }];
    setEditedPlan(next);
  }

  function updateSetLog(key: string, patch: Partial<SetLog>) {
    setSetLogs(prev => ({ ...prev, [key]: { reps: "", loadLbs: "", rpe: "", ...prev[key], ...patch } }));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6" data-testid="page-generate-workout">
      <header>
        <div className="text-xs uppercase tracking-widest text-primary/70 font-semibold mb-1">Session Builder</div>
        <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-page-title">Generate Workout</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Reads your 7-day ledger and refuses to add sets to body parts already at {weeklyTarget}/wk.
          Prefer the Coach chat if you want to talk it through — she can generate and save the same plan.
        </p>
        <Link href="/coach" className="inline-flex items-center gap-1.5 mt-2 text-xs uppercase tracking-widest text-primary/70 hover:text-primary transition-colors">
          <MessageCircle className="w-3 h-3" /> Talk to Coach instead
        </Link>
      </header>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-auto"
              data-testid="input-date"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground block mb-1">Day type</label>
            <select
              value={dayType}
              onChange={(e) => setDayType(e.target.value)}
              className="border rounded-md px-3 py-2 bg-background text-sm h-10"
              data-testid="select-day-type"
            >
              {DAY_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="ml-auto"
            data-testid="button-generate"
          >
            {generateMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating</>
              : <><Zap className="w-4 h-4 mr-2" /> Generate workout</>}
          </Button>
        </CardContent>
      </Card>

      {/* Weekly ledger */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4" /> Weekly ledger (target {weeklyTarget}/wk · direct-target only)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="ledger-grid">
            {BODY_PART_ORDER.map(part => {
              const count = ledger[part] ?? 0;
              const pct = weeklyTarget > 0 ? Math.min(100, (count / weeklyTarget) * 100) : 0;
              const capped = cappedParts.has(part);
              const isDeficit = count < weeklyTarget * 0.5;
              return (
                <div
                  key={part}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    capped ? "border-primary/60 bg-primary/5" : "border-border bg-card",
                  )}
                  data-testid={`ledger-${part}`}
                  data-capped={capped ? "true" : undefined}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium">{prettyPart(part)}</span>
                    <span className={cn("font-mono text-sm tabular-nums", isDeficit && "text-destructive", capped && "text-primary font-semibold")}>
                      {count}/{weeklyTarget}
                    </span>
                  </div>
                  <div className="h-1.5 mt-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", capped ? "bg-primary" : isDeficit ? "bg-destructive/60" : "bg-primary/70")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {cappedParts.size > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Capped this week: <span className="text-primary font-medium">{Array.from(cappedParts).map(prettyPart).join(", ")}</span>. Coach won't add more sets to these.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Plan editor + logger */}
      {editedPlan && editedPlan.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">
                {savedPlanDate === date ? "Today's plan" : "Draft plan"} · {dayType}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Edit exercise names, sets, and reps. Fill in reps/weight per set as you finish.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-regenerate">
                <RefreshCcw className="w-3 h-3 mr-1" /> Regenerate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-plan"
              >
                <Save className="w-3 h-3 mr-1" /> {savedPlanDate === date ? "Update plan" : "Save plan"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editedPlan.map((ex, i) => (
              <div key={i} className="rounded-md border bg-card/50" data-testid={`exercise-${i}`}>
                {/* Exercise header — editable */}
                <div className="p-3 border-b bg-muted/30 flex flex-wrap items-center gap-2">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                  <Input
                    value={ex.name}
                    onChange={(e) => updateExercise(i, { name: e.target.value })}
                    placeholder="Exercise name (e.g. Flat DB Bench)"
                    className="flex-1 min-w-[180px] h-9 font-medium"
                    data-testid={`input-exercise-name-${i}`}
                  />
                  <select
                    value={ex.targetBodyPart}
                    onChange={(e) => updateExercise(i, { targetBodyPart: e.target.value })}
                    className="border rounded-md px-2 py-1.5 bg-background text-xs h-9 capitalize"
                    data-testid={`select-body-part-${i}`}
                  >
                    {BODY_PART_ORDER.map(bp => <option key={bp} value={bp}>{prettyPart(bp)}</option>)}
                  </select>
                  <Input
                    type="number"
                    value={ex.sets}
                    onChange={(e) => updateExercise(i, { sets: Math.max(1, Number(e.target.value)) })}
                    className="w-16 h-9 text-center"
                    min={1}
                    max={10}
                    data-testid={`input-sets-${i}`}
                  />
                  <span className="text-xs text-muted-foreground">sets ×</span>
                  <Input
                    type="number"
                    value={ex.repsMin ?? ""}
                    onChange={(e) => updateExercise(i, { repsMin: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-14 h-9 text-center"
                    placeholder="min"
                    data-testid={`input-reps-min-${i}`}
                  />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input
                    type="number"
                    value={ex.repsMax ?? ""}
                    onChange={(e) => updateExercise(i, { repsMax: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-14 h-9 text-center"
                    placeholder="max"
                    data-testid={`input-reps-max-${i}`}
                  />
                  <button
                    onClick={() => removeExercise(i)}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    data-testid={`button-remove-${i}`}
                    aria-label="Remove exercise"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Per-set logging inputs */}
                <div className="p-3 space-y-1.5">
                  <div className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 text-[10px] uppercase tracking-widest text-muted-foreground pb-1">
                    <span></span>
                    <span>Weight (lb)</span>
                    <span>Reps</span>
                    <span>RPE</span>
                  </div>
                  {Array.from({ length: ex.sets }, (_, s) => {
                    const key = `${i}-${s + 1}`;
                    const log = setLogs[key] ?? { reps: "", loadLbs: "", rpe: "" };
                    return (
                      <div key={key} className="grid grid-cols-[24px_1fr_1fr_1fr] gap-2 items-center">
                        <span className="text-xs font-mono text-muted-foreground text-center">{s + 1}</span>
                        <Input
                          type="number" step="any" inputMode="decimal"
                          value={log.loadLbs}
                          onChange={(e) => updateSetLog(key, { loadLbs: e.target.value })}
                          className="h-9 text-sm"
                          data-testid={`input-load-${i}-${s + 1}`}
                        />
                        <Input
                          type="number" inputMode="numeric"
                          value={log.reps}
                          onChange={(e) => updateSetLog(key, { reps: e.target.value })}
                          className="h-9 text-sm"
                          data-testid={`input-reps-${i}-${s + 1}`}
                        />
                        <Input
                          type="number" step="0.5" inputMode="decimal"
                          value={log.rpe}
                          onChange={(e) => updateSetLog(key, { rpe: e.target.value })}
                          className="h-9 text-sm"
                          placeholder="opt"
                          data-testid={`input-rpe-${i}-${s + 1}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={addExercise}
              className="w-full border border-dashed border-border rounded-md py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors flex items-center justify-center gap-1.5"
              data-testid="button-add-exercise"
            >
              <Plus className="w-4 h-4" /> Add exercise
            </button>

            {/* Submit-when-done */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="w-full h-12 text-base"
                data-testid="button-submit-workout"
              >
                {submitMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging…</>
                  : submitMutation.isSuccess
                    ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Workout logged — great work</>
                    : <><CheckCircle2 className="w-4 h-4 mr-2" /> Submit workout as complete</>}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Only sets with reps or weight entered get logged. Immutable — the audit trail is real.
              </p>
            </div>

            {/* Session credits summary */}
            <div className="pt-3 border-t">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">This session credits:</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(
                  editedPlan.reduce((acc, ex) => {
                    acc[ex.targetBodyPart] = (acc[ex.targetBodyPart] ?? 0) + ex.sets;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([bp, sets]) => (
                  <Badge key={bp} variant="outline" className="capitalize">
                    {prettyPart(bp)} +{sets}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {editedPlan && editedPlan.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">Empty plan. Add an exercise or generate one.</p>
            <Button variant="outline" onClick={addExercise} className="mt-3">
              <Plus className="w-4 h-4 mr-2" /> Add exercise manually
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
