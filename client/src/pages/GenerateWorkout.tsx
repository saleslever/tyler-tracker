/**
 * Generate Workout — one-tap workout builder.
 * Reads the weekly ledger + recent workouts + recovery to prescribe today's session.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, CheckCircle2, RefreshCcw, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ledger { [bodyPart: string]: number }

interface GenerateResponse {
  proposal: {
    date: string;
    dayType: string;
    exercises: Array<{
      name: string;
      targetBodyPart: string;
      sets: number;
      repsMin?: number;
      repsMax?: number;
      loadHint?: string;
      notes?: string;
    }>;
    targetSetsByBodyPart?: Record<string, number>;
    error?: string;
  };
  context: {
    ledger: Ledger;
    weeklyTarget: number;
    recovery: any;
  };
}

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

export default function GenerateWorkout() {
  const [date, setDate] = useState(todayInDenver());
  const [dayType, setDayType] = useState<string>("strength");
  const [proposal, setProposal] = useState<GenerateResponse["proposal"] | null>(null);

  const contextQuery = useQuery<any>({
    queryKey: ["/api/coach/context"],
  });

  const ledgerQuery = useQuery<Ledger>({
    queryKey: ["/api/fitness/workouts/ledger", date],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/fitness/workouts/generate", { date, dayType });
      return (await r.json()) as GenerateResponse;
    },
    onSuccess: (data) => {
      setProposal(data.proposal);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!proposal) return;
      const r = await apiRequest("POST", "/api/fitness/workouts/plan", {
        date: proposal.date,
        dayType: proposal.dayType,
        exercises: proposal.exercises,
        targetSetsByBodyPart: proposal.targetSetsByBodyPart ?? {},
        source: "coach_generated",
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness/workouts/plan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/context"] });
    },
  });

  const weeklyTarget = contextQuery.data?.settings?.weeklySetsPerBodyPart ?? 24;
  const ledger = ledgerQuery.data ?? {};

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6" data-testid="page-generate-workout">
      <header>
        <div className="serif gold mb-1">Session Builder</div>
        <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-page-title">Generate Workout</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Reads your 7-day ledger, recovery, and past sessions. Even distribution across all muscle groups.
        </p>
      </header>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border rounded px-3 py-2 bg-background"
              data-testid="input-date"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Day type</label>
            <select
              value={dayType}
              onChange={(e) => setDayType(e.target.value)}
              className="border rounded px-3 py-2 bg-background"
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
            <Dumbbell className="w-4 h-4" /> Weekly ledger (target {weeklyTarget}/wk)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="ledger-grid">
            {BODY_PART_ORDER.map(part => {
              const count = ledger[part] ?? 0;
              const pct = weeklyTarget > 0 ? Math.min(100, (count / weeklyTarget) * 100) : 0;
              const isDeficit = count < weeklyTarget * 0.5;
              return (
                <div
                  key={part}
                  className="ledger-tile"
                  data-testid={`ledger-${part}`}
                  data-deficit={isDeficit ? "true" : undefined}
                  data-hit={count >= weeklyTarget ? "true" : undefined}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize font-medium">{part.replace(/_/g, " ")}</span>
                    <span className={cn("num-display text-sm", isDeficit && "text-destructive", count >= weeklyTarget && "text-primary")}>
                      {count}/{weeklyTarget}
                    </span>
                  </div>
                  <div className="h-1.5 mt-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", isDeficit ? "bg-destructive/60" : "bg-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Proposal */}
      {proposal && !proposal.error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Proposal for {proposal.date} · {proposal.dayType}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  data-testid="button-regenerate"
                >
                  <RefreshCcw className="w-3 h-3 mr-1" /> Regenerate
                </Button>
                <Button
                  size="sm"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending || acceptMutation.isSuccess}
                  data-testid="button-accept"
                >
                  {acceptMutation.isSuccess
                    ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Accepted</>
                    : "Save as today's plan"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {proposal.exercises?.map((ex, i) => (
              <div key={i} className="flex items-start gap-3 border-b pb-2 last:border-0" data-testid={`exercise-${i}`}>
                <div className="text-xs font-mono opacity-40 w-6">{i + 1}.</div>
                <div className="flex-1">
                  <div className="font-medium">{ex.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-0.5">
                    <span className="capitalize">{ex.targetBodyPart?.replace(/_/g, " ")}</span>
                    <span>{ex.sets} sets</span>
                    {(ex.repsMin || ex.repsMax) && <span>{ex.repsMin}-{ex.repsMax} reps</span>}
                    {ex.loadHint && <span>{ex.loadHint}</span>}
                  </div>
                  {ex.notes && <div className="text-xs italic mt-1 text-muted-foreground">{ex.notes}</div>}
                </div>
              </div>
            ))}
            {proposal.targetSetsByBodyPart && (
              <div className="pt-3 mt-3 border-t">
                <div className="text-xs text-muted-foreground mb-1">This session credits:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(proposal.targetSetsByBodyPart).map(([bp, sets]) => (
                    <Badge key={bp} variant="outline">
                      {bp.replace(/_/g, " ")} +{sets as any}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {proposal?.error && (
        <Card className="border-red-500/40">
          <CardContent className="pt-6 text-sm text-red-600 dark:text-red-400" data-testid="text-error">
            {proposal.error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
