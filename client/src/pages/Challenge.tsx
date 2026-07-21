import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DailyLog, Challenge as ChallengeT } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useToday } from "@/hooks/useToday";
import { rollupChallenge, requiredHabits, dayScoreForChallenge, isPerfectDay } from "@/lib/challenge";
import { HABITS, addDays } from "@/lib/analytics";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Trophy, Plus, Check, X } from "lucide-react";

export default function ChallengePage() {
  const today = useToday();
  const { data: activeChallenge, isLoading } = useQuery<ChallengeT | null>({
    queryKey: ["/api/challenges/active"],
  });
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });
  const { data: allChallenges = [] } = useQuery<ChallengeT[]>({
    queryKey: ["/api/challenges"],
  });

  // If no active challenge, show the next upcoming one (starts within the next 14 days).
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
        <KPI label="Perfect Days" value={String(rollup.perfectDays)} sub={`of ${rollup.daysElapsed || rollup.totalDays} elapsed`} />
        <KPI label="Current Streak" value={String(rollup.currentPerfectStreak)} sub="consecutive perfect days" />
        <KPI label="Best Streak" value={String(rollup.bestPerfectStreak)} sub="all-time best inside challenge" />
        <KPI label="Days Remaining" value={String(rollup.daysRemaining)} sub={rollup.status === "complete" ? "complete" : "days to go"} />
      </div>

      {/* Grid of days */}
      <section className="card-lux p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="serif text-base">The 30 Days</div>
            <div className="text-xs text-muted-foreground mt-1">
              Green = perfect. Amber = partial. Red = missed everything. Grey = not yet.
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <LegendDot cls="bg-emerald-400" label="Perfect" />
            <LegendDot cls="bg-amber-400/70" label="Partial" />
            <LegendDot cls="bg-red-500/60" label="Miss" />
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
            let state: "perfect" | "partial" | "miss" | "future" = "future";
            if (!isFuture) {
              const score = dayScoreForChallenge(log, challenge);
              state = score === 1 ? "perfect" : score > 0 ? "partial" : "miss";
            }
            const bg =
              state === "perfect" ? "bg-emerald-500/25 border-emerald-400/40"
              : state === "partial" ? "bg-amber-500/20 border-amber-400/40"
              : state === "miss" ? "bg-red-500/15 border-red-500/40"
              : "bg-secondary/40 border-border";
            return (
              <div
                key={i}
                className={`relative aspect-square rounded-md border ${bg} p-2 flex flex-col justify-between transition-colors ${isToday ? "ring-2 ring-foreground/60" : ""}`}
                data-testid={`grid-day-${dayNum}`}
                title={`${dateStr} · Day ${dayNum}`}
              >
                <div className="microlabel">D{dayNum}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {dateStr.slice(5)}
                </div>
                {state === "perfect" && (
                  <Check className="absolute top-1 right-1 w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} />
                )}
                {state === "miss" && (
                  <X className="absolute top-1 right-1 w-3.5 h-3.5 text-red-400/70" strokeWidth={2.5} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Required habits */}
      <section className="card-plain p-6 mb-6">
        <div className="mb-4">
          <div className="serif text-base">Required Habits</div>
          <div className="text-xs text-muted-foreground mt-1">
            All {requiredHabits(challenge).length} must be hit for a perfect day.
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {requiredHabits(challenge).map((k) => {
            const h = HABITS.find((x) => x.key === k)!;
            const todayLog = logs.find((l) => l.date === today);
            const hitToday = todayLog
              ? h.kind === "bool"
                ? (todayLog as any)[k] === 1
                : (() => {
                    const v = (todayLog as any)[k];
                    return v != null && (h.compare === "gte" ? v >= h.target : v <= h.target);
                  })()
              : false;
            return (
              <div
                key={k}
                className={`p-3 rounded-md border ${hitToday ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-secondary/30"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{h.emoji}</span>
                  <div className="text-xs text-foreground truncate">{h.label}</div>
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  {hitToday ? "hit today" : "pending"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Link href="/habits">
          <Button variant="outline" size="sm">Log today's habits →</Button>
        </Link>
        <div className="text-xs text-muted-foreground">
          {rollup.status === "active"
            ? isPerfectDay(logs.find((l) => l.date === today), challenge)
              ? "Today is perfect. Well done."
              : "Today is not yet perfect. Close it out clean."
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

function NoChallenge({ existing }: { existing: ChallengeT[] }) {
  const today = useToday();
  const [starting, setStarting] = useState(false);
  const boolKeys = HABITS.map((h) => h.key);

  const create = useMutation({
    mutationFn: async () => {
      const startDate = addDays(today, 1); // tomorrow
      const endDate = addDays(startDate, 29); // inclusive → 30 days total
      return apiRequest("POST", "/api/challenges", {
        name: "30-Day Discipline",
        startDate,
        endDate,
        durationDays: 30,
        habitKeys: JSON.stringify(boolKeys),
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
        A challenge is a fixed window with a clear standard. Every habit, every day, for 30 days.
        Start yours and the app will track the streak.
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
