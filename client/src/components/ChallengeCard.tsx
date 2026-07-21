import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { DailyLog, Challenge } from "@shared/schema";
import { useToday } from "@/hooks/useToday";
import { rollupChallenge, requiredHabits } from "@/lib/challenge";
import { HABITS, addDays } from "@/lib/analytics";
import { Trophy, ArrowRight, Flame } from "lucide-react";

/**
 * ChallengeCard — Overview hero for the active 30-day challenge.
 *
 * Shows Day N / total, perfect days count, current perfect streak, and
 * a mini strip of the last 14 days colored by perfect/imperfect status.
 */
export function ChallengeCard() {
  const today = useToday();
  const { data: activeChallenge } = useQuery<Challenge | null>({
    queryKey: ["/api/challenges/active"],
  });
  const { data: allChallenges = [] } = useQuery<Challenge[]>({
    queryKey: ["/api/challenges"],
  });
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });

  // Fall back to the next upcoming challenge if none active
  const challenge = useMemo(() => {
    if (activeChallenge) return activeChallenge;
    return (
      allChallenges
        .filter((c) => c.startDate > today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] || null
    );
  }, [activeChallenge, allChallenges, today]);

  const rollup = useMemo(
    () => (challenge ? rollupChallenge(challenge, logs, today) : null),
    [challenge, logs, today],
  );

  // Small strip of the trailing 14 challenge days for at-a-glance progress
  const strip = useMemo(() => {
    if (!challenge || !rollup) return [];
    const logsByDate = new Map(logs.map((l) => [l.date, l] as const));
    const keys = requiredHabits(challenge);
    const total = challenge.durationDays;
    const start = Math.max(0, rollup.daysElapsed - 14);
    const end = Math.min(total, start + 14);
    const cells: { date: string; day: number; state: "perfect" | "partial" | "miss" | "future" }[] = [];
    for (let i = start; i < end; i++) {
      const d = addDays(challenge.startDate, i);
      const log = logsByDate.get(d);
      let state: "perfect" | "partial" | "miss" | "future" = "future";
      if (i < rollup.daysElapsed - (rollup.status === "active" ? 1 : 0)) {
        // Past day, fully in the record
        const hits = keys.filter((k) => {
          const h = HABITS.find((x) => x.key === k)!;
          if (!log) return false;
          if (h.kind === "bool") return (log as any)[k] === 1;
          const v = (log as any)[k];
          return v != null && (h.compare === "gte" ? v >= h.target : v <= h.target);
        }).length;
        if (hits === keys.length) state = "perfect";
        else if (hits > 0) state = "partial";
        else state = "miss";
      } else if (i === rollup.daysElapsed - 1) {
        // Today
        state = rollup.todayPerfect ? "perfect" : (log ? "partial" : "future");
      }
      cells.push({ date: d, day: i + 1, state });
    }
    return cells;
  }, [challenge, rollup, logs]);

  if (!challenge || !rollup) return null;

  const { currentDay, totalDays, perfectDays, currentPerfectStreak, status, daysRemaining, pct } = rollup;

  // Status-tuned framing
  const headline =
    status === "upcoming" ? `Starts ${challenge.startDate}`
    : status === "complete" ? "Challenge complete"
    : `Day ${currentDay} of ${totalDays}`;

  const message =
    status === "upcoming"
      ? "The countdown is on. Get to bed on time tonight — Day 1 starts tomorrow."
    : status === "complete"
      ? perfectDays === totalDays
        ? "You went 30 for 30. Legendary run. Set the next one."
        : `You hit ${perfectDays} perfect days out of ${totalDays}. Now go again — harder this time.`
    : perfectDays === currentDay - 1 && currentDay > 1
      ? "You are perfect so far. Do not break the chain today."
    : currentPerfectStreak >= 5
      ? `${currentPerfectStreak} perfect days in a row. This is who you are now.`
    : currentDay === 1
      ? "Day one. Every rep counts. Log everything before you sleep."
    : `${daysRemaining} days left. Head down.`;

  return (
    <section className="card-lux relative overflow-hidden p-6 md:p-8 mb-6" data-testid="card-challenge">
      {/* Amber wash for "trial by fire" energy */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.09]"
        style={{
          background:
            "radial-gradient(ellipse at 85% 0%, hsl(38 85% 55%) 0%, transparent 55%)",
        }}
      />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(38 60% 40% / 0.35), hsl(38 40% 25% / 0.2))",
                border: "1px solid hsl(38 70% 50% / 0.4)",
              }}
            >
              <Trophy className="w-5 h-5 text-amber-300" strokeWidth={1.5} />
            </div>
            <div>
              <div className="microlabel">Active Challenge</div>
              <div className="serif text-base mt-0.5 text-foreground">{challenge.name}</div>
            </div>
          </div>
          <Link href="/challenge" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 whitespace-nowrap">
            Full view <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Big number row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-5">
          <div>
            <div className="microlabel">{status === "active" ? "TODAY IS" : ""}</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="num-display text-6xl md:text-7xl leading-none text-foreground" data-testid="text-challenge-day">
                {currentDay || "—"}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-widest">
                {status === "upcoming" ? "not started" : `of ${totalDays}`}
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">{headline}</div>
          </div>

          <div className="flex gap-6 md:gap-8">
            <div>
              <div className="microlabel">Perfect Days</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <div className="num-display text-3xl text-foreground" data-testid="text-perfect-days">{perfectDays}</div>
                <div className="text-xs text-muted-foreground">/ {rollup.daysElapsed || totalDays}</div>
              </div>
            </div>
            <div>
              <div className="microlabel">Streak</div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <div className="num-display text-3xl text-foreground" data-testid="text-perfect-streak">{currentPerfectStreak}</div>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 rounded-full bg-secondary overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${pct * 100}%`,
              background:
                "linear-gradient(90deg, hsl(38 75% 55%), hsl(38 60% 70%))",
              boxShadow: "0 0 12px hsl(38 80% 55% / 0.4)",
            }}
          />
        </div>

        {/* Mini strip — trailing days */}
        {strip.length > 0 && (
          <div className="flex items-center gap-1 mb-4">
            {strip.map((c) => {
              const bg =
                c.state === "perfect" ? "bg-emerald-400"
                : c.state === "partial" ? "bg-amber-400/70"
                : c.state === "miss" ? "bg-red-500/60"
                : "bg-muted-foreground/15";
              return (
                <div
                  key={c.date}
                  title={`Day ${c.day} · ${c.date} · ${c.state}`}
                  className={`flex-1 h-6 rounded-sm ${bg}`}
                  data-testid={`strip-day-${c.day}`}
                />
              );
            })}
          </div>
        )}

        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-challenge-message">
          {message}
        </p>
      </div>
    </section>
  );
}
