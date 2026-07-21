import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DailyLog, Challenge as ChallengeT } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/useToday";
import {
  rollupChallenge,
  requiredDailyHabits,
  requiredWeeklyHabits,
  optionalHabits,
  dayScoreForChallenge,
  isPerfectDay,
} from "@/lib/challenge";
import { HABITS, habitHit, addDays } from "@/lib/analytics";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trophy, Plus, Check, X, Flame, Sparkles } from "lucide-react";

export default function ChallengePage() {
  const today = useToday();
  const { data: activeChallenge, isLoading } = useQuery<ChallengeT | null>({
    queryKey: ["/api/challenges/active"],
  });
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: allChallenges = [] } = useQuery<ChallengeT[]>({
    queryKey: ["/api/challenges"],
  });

  const upcoming = useMemo(() => {
    if (activeChallenge) return null;
    return allChallenges
      .filter((c) => c.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  }, [activeChallenge, allChallenges, today]);

  const challenge = activeChallenge || upcoming || null;

  const rollup = useMemo(
    () => (challenge ? rollupChallenge(challenge, logs, today) : null),
    [challenge, logs, today],
  );

  const todayLog = useMemo(
    () => logs.find((l) => l.date === today),
    [logs, today],
  );

  // Cheat-day toggle for today
  const cheatMutation = useMutation({
    mutationFn: async (nextValue: 0 | 1) => {
      return apiRequest("PATCH", `/api/logs/${today}`, { cheatDay: nextValue });
    },
    onMutate: async (nextValue) => {
      await queryClient.cancelQueries({ queryKey: ["/api/logs"] });
      const previous = queryClient.getQueryData<DailyLog[]>(["/api/logs"]);
      queryClient.setQueryData<DailyLog[]>(["/api/logs"], (old = []) => {
        const idx = old.findIndex((l) => l.date === today);
        if (idx === -1) {
          return [
            ...old,
            {
              id: -1,
              date: today,
              fastingHours: null,
              weight: null,
              sleepScore: null,
              steps: null,
              water: 0,
              vitamins: 0,
              morningDrink: 0,
              noAlcohol: 0,
              noEnergyDrinks: 0,
              workout: 0,
              lowCarb: 0,
              cheatDay: nextValue,
            } as DailyLog,
          ];
        }
        const copy = [...old];
        copy[idx] = { ...copy[idx], cheatDay: nextValue };
        return copy;
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/logs"], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-8">
        <PageHeader title="Challenge" subtitle="Loading…" />
      </div>
    );
  }

  if (!challenge || !rollup) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-8">
        <PageHeader title="Challenge" subtitle="No active challenge" />
        <NoChallenge existing={allChallenges} />
      </div>
    );
  }

  const dailyKeys = requiredDailyHabits(challenge);
  const weeklyReq = requiredWeeklyHabits(challenge);
  const optional = optionalHabits(challenge);
  const cheatsRemaining = Math.max(
    0,
    rollup.thisWeek.cheatsAllowed - rollup.thisWeek.cheatsUsed,
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-6 md:py-8">
      <PageHeader
        title={challenge.name}
        subtitle={`${challenge.startDate} → ${challenge.endDate}`}
        actions={
          <div className="text-right">
            <div className="microlabel">Day</div>
            <div className="num-display text-3xl text-foreground">
              {rollup.currentDay || 0}
              <span className="text-base text-muted-foreground"> / {rollup.totalDays}</span>
            </div>
          </div>
        }
      />

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI
          label="Perfect Days"
          value={String(rollup.perfectDays)}
          sub={`of ${rollup.daysElapsed || rollup.totalDays} elapsed`}
        />
        <KPI
          label="Current Streak"
          value={String(rollup.currentPerfectStreak)}
          sub="consecutive perfect days"
        />
        <KPI
          label="Cheat Days"
          value={`${cheatsRemaining}`}
          sub={`of ${rollup.thisWeek.cheatsAllowed} left this week`}
        />
        <KPI
          label="Days Remaining"
          value={String(rollup.daysRemaining)}
          sub={rollup.status === "complete" ? "complete" : "days to go"}
        />
      </div>

      {/* Grid of days */}
      <section className="card-lux p-6 mb-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            <div className="serif text-base">The 30 Days</div>
            <div className="text-xs text-muted-foreground mt-1">
              Green = perfect. Amber = partial. Red = missed. Blue = cheat. Grey = future.
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <LegendDot cls="bg-emerald-400" label="Perfect" />
            <LegendDot cls="bg-amber-400/70" label="Partial" />
            <LegendDot cls="bg-red-500/60" label="Miss" />
            <LegendDot cls="bg-sky-400/70" label="Cheat" />
            <LegendDot cls="bg-muted-foreground/15" label="Future" />
          </div>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-10 gap-2">
          {Array.from({ length: challenge.durationDays }, (_, i) => {
            const dateStr = addDays(challenge.startDate, i);
            const log = logs.find((l) => l.date === dateStr);
            const dayNum = i + 1;
            const isFuture = dayNum > rollup.currentDay;
            const isToday = dateStr === today;
            const isCheat = log?.cheatDay === 1;
            let state: "perfect" | "partial" | "miss" | "future" | "cheat" = "future";
            if (!isFuture) {
              if (isCheat) state = "cheat";
              else {
                const score = dayScoreForChallenge(log, challenge);
                state = score === 1 ? "perfect" : score > 0 ? "partial" : "miss";
              }
            }
            const bg =
              state === "perfect" ? "bg-emerald-500/25 border-emerald-400/40"
              : state === "cheat" ? "bg-sky-500/20 border-sky-400/40"
              : state === "partial" ? "bg-amber-500/20 border-amber-400/40"
              : state === "miss" ? "bg-red-500/15 border-red-500/40"
              : "bg-secondary/40 border-border";
            return (
              <div
                key={i}
                className={`relative aspect-square rounded-md border ${bg} p-2 flex flex-col justify-between transition-colors ${isToday ? "ring-2 ring-foreground/60" : ""}`}
                data-testid={`grid-day-${dayNum}`}
                title={`${dateStr} · Day ${dayNum}${isCheat ? " · Cheat Day" : ""}`}
              >
                <div className="microlabel">D{dayNum}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {dateStr.slice(5)}
                </div>
                {state === "perfect" && (
                  <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} />
                )}
                {state === "cheat" && (
                  <Sparkles className="absolute top-1 right-1 w-3.5 h-3.5 text-sky-300" strokeWidth={2} />
                )}
                {state === "miss" && (
                  <X className="absolute top-1 right-1 w-3.5 h-3.5 text-red-400/70" strokeWidth={2.5} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Required-daily habits */}
      <section className="card-plain p-6 mb-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="serif text-base">Required Every Day</div>
            <div className="text-xs text-muted-foreground mt-1">
              All {dailyKeys.length} must be hit for a perfect day (or use a cheat).
            </div>
          </div>
          {rollup.status === "active" && (
            <Button
              variant={rollup.todayIsCheat ? "default" : "outline"}
              size="sm"
              disabled={
                cheatMutation.isPending ||
                (!rollup.todayIsCheat && cheatsRemaining <= 0)
              }
              onClick={() =>
                cheatMutation.mutate(rollup.todayIsCheat ? 0 : 1)
              }
              className="gap-2"
              data-testid="button-cheat-day"
            >
              <Sparkles className="w-4 h-4" />
              {rollup.todayIsCheat
                ? "Cancel Cheat Day"
                : cheatsRemaining <= 0
                  ? "No cheats left this week"
                  : "Use Cheat Day"}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {dailyKeys.map((k) => {
            const h = HABITS.find((x) => x.key === k)!;
            const hitToday = habitHit(todayLog, h);
            return (
              <div
                key={k}
                className={`p-3 rounded-md border ${
                  hitToday
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : rollup.todayIsCheat
                      ? "border-sky-500/40 bg-sky-500/5"
                      : "border-border bg-secondary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{h.emoji}</span>
                  <div className="text-xs text-foreground truncate">{h.label}</div>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {hitToday ? "hit today" : rollup.todayIsCheat ? "cheat" : "pending"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Weekly required (lifts) */}
      {Object.keys(weeklyReq).length > 0 && (
        <section className="card-plain p-6 mb-6">
          <div className="mb-4">
            <div className="serif text-base">Required Weekly</div>
            <div className="text-xs text-muted-foreground mt-1">
              Progress this Mon–Sun. Doesn't affect daily perfect status, but you owe the week.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(weeklyReq).map(([k, needed]) => {
              const h = HABITS.find((x) => x.key === k)!;
              const count = rollup.thisWeek.habitCounts[k as any] ?? { hit: 0, required: needed };
              const done = count.hit >= count.required;
              return (
                <div
                  key={k}
                  className={`p-4 rounded-md border ${done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-secondary/30"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{h.emoji}</span>
                      <div className="text-sm text-foreground">{h.label}</div>
                    </div>
                    <div className="num-display text-lg">
                      {count.hit}
                      <span className="text-xs text-muted-foreground"> / {count.required}</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full ${done ? "bg-emerald-400" : "bg-amber-400/70"}`}
                      style={{ width: `${Math.min(100, (count.hit / count.required) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Optional (tracked, not required) */}
      {optional.length > 0 && (
        <section className="card-plain p-6 mb-6">
          <div className="mb-4">
            <div className="serif text-base">Also Tracked</div>
            <div className="text-xs text-muted-foreground mt-1">
              Nice to have. Not required for a perfect day.
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {optional.map((k) => {
              const h = HABITS.find((x) => x.key === k);
              if (!h) return null;
              const hitToday = habitHit(todayLog, h);
              return (
                <div
                  key={k}
                  className={`p-3 rounded-md border ${hitToday ? "border-foreground/30 bg-foreground/5" : "border-border/40 bg-secondary/20"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{h.emoji}</span>
                    <div className="text-xs text-muted-foreground truncate">{h.label}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {hitToday ? "hit" : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/habits">
          <Button variant="outline" size="sm">Log today's habits →</Button>
        </Link>
        <div className="text-xs text-muted-foreground text-right">
          {rollup.status === "active"
            ? rollup.todayIsCheat
              ? "Cheat day active. Rest, enjoy — the streak holds."
              : isPerfectDay(todayLog, challenge)
                ? "Today is perfect. Well done."
                : rollup.currentPerfectStreak > 0
                  ? `${rollup.currentPerfectStreak}-day streak alive. Close today out clean.`
                  : "Get the required 5 hit. Everything else is a bonus."
            : rollup.status === "upcoming"
              ? "Challenge starts on the start date."
              : "Challenge is complete."}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="microlabel">{label}</div>
      <div className="mt-3 num-display text-4xl leading-none text-foreground">{value}</div>
      {sub && <div className="mt-3 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function LegendDot({ cls, label }: { cls: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-sm ${cls}`} />
      <span>{label}</span>
    </div>
  );
}

/**
 * Default challenge shape when starting from scratch:
 *  - Required daily: lowCarb, fastingHours, vitamins, water, steps
 *  - Required weekly: workout 4x
 *  - Optional: morningDrink, sleepScore, weight, noAlcohol, noEnergyDrinks
 *  - Cheat days: 1 per week
 */
export const DEFAULT_CHALLENGE = {
  name: "30-Day Discipline",
  durationDays: 30,
  requiredDaily: ["lowCarb", "fastingHours", "vitamins", "water", "steps"] as const,
  requiredWeekly: { workout: 4 } as const,
  optionalHabits: ["morningDrink", "sleepScore", "weight", "noAlcohol", "noEnergyDrinks"] as const,
  cheatDaysPerWeek: 1,
};

function NoChallenge({ existing }: { existing: ChallengeT[] }) {
  const today = useToday();
  const [starting, setStarting] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const startDate = addDays(today, 1); // tomorrow
      const endDate = addDays(startDate, DEFAULT_CHALLENGE.durationDays - 1);
      return apiRequest("POST", "/api/challenges", {
        name: DEFAULT_CHALLENGE.name,
        startDate,
        endDate,
        durationDays: DEFAULT_CHALLENGE.durationDays,
        requiredDaily: JSON.stringify(DEFAULT_CHALLENGE.requiredDaily),
        requiredWeekly: JSON.stringify(DEFAULT_CHALLENGE.requiredWeekly),
        optionalHabits: JSON.stringify(DEFAULT_CHALLENGE.optionalHabits),
        cheatDaysPerWeek: DEFAULT_CHALLENGE.cheatDaysPerWeek,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/challenges/active"] });
      setStarting(false);
    },
  });

  return (
    <div className="card-lux p-8 md:p-10 text-center">
      <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, hsl(38 60% 40% / 0.35), hsl(38 40% 25% / 0.2))",
          border: "1px solid hsl(38 70% 50% / 0.4)",
        }}
      >
        <Trophy className="w-7 h-7 text-amber-300" strokeWidth={1.5} />
      </div>
      <div className="serif text-xl mb-2">No Active Challenge</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
        A challenge is a fixed window with a clear standard. Low carb, fasting, vitamins,
        water, and steps every day. Lift 4× a week. One cheat day a week if you need it.
      </p>
      <Button
        onClick={() => { setStarting(true); create.mutate(); }}
        disabled={starting || create.isPending}
        className="gap-2"
        data-testid="button-start-challenge"
      >
        <Plus className="w-4 h-4" />
        Start 30-Day Discipline (tomorrow)
      </Button>
      {existing.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border/40">
          <div className="microlabel mb-3">Past challenges</div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {existing.map((c) => (
              <div key={c.id}>{c.name} — {c.startDate} → {c.endDate}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
