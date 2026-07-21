import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DailyLog } from "@shared/schema";
import { HABITS, currentStreak } from "@/lib/analytics";
import { useToday } from "@/hooks/useToday";
import { Shield } from "lucide-react";

/**
 * SobrietyCard
 *
 * Shows days sober (derived from the "noAlcohol" habit streak) with a
 * milestone ladder: 30 / 90 / 365 / then rolling ×2 goals thereafter.
 *
 * Copy is intentionally direct and encouraging — no cutesy language, no
 * lecturing. It celebrates every single day.
 */

const NO_ALCOHOL = HABITS.find((h) => h.key === "noAlcohol")!;

// Milestones in ascending order. After 365, we roll to 500 / 730 / 1000.
const MILESTONES = [7, 14, 30, 60, 90, 180, 365, 500, 730, 1000, 1825];

function pickMilestone(days: number): { current: number; next: number } {
  // Find the next unreached milestone.
  for (let i = 0; i < MILESTONES.length; i++) {
    if (days < MILESTONES[i]) {
      const prev = i === 0 ? 0 : MILESTONES[i - 1];
      return { current: prev, next: MILESTONES[i] };
    }
  }
  // Past the top milestone — keep doubling from the last one.
  const last = MILESTONES[MILESTONES.length - 1];
  return { current: last, next: last * 2 };
}

function messageFor(days: number, todayLogged: boolean): string {
  if (days === 0 && !todayLogged) {
    return "Today is the day. Check in when you finish it clean.";
  }
  if (days === 0 && todayLogged) {
    return "Day one is on the board. The hardest part is behind you already.";
  }
  if (days === 1) return "Twenty-four hours. That's a real thing. Do it again.";
  if (days < 7) return "You're stacking days. Keep the pattern.";
  if (days === 7) return "One full week. Your body is already thanking you.";
  if (days < 14) return "The urge is a wave — it always passes. You've proven that now.";
  if (days === 14) return "Two weeks. Sleep, mood, money — it all compounds from here.";
  if (days < 30) return "You're inside the hardest stretch. Head down. Stay boring.";
  if (days === 30) return "Thirty days. This is a milestone that matters. You did that.";
  if (days < 90) return "Past the first month. The people around you are noticing.";
  if (days === 90) return "Ninety days. This is the point where it starts to feel normal.";
  if (days < 180) return "Sobriety is your default now. Protect it like anything else that matters.";
  if (days < 365) return "The version of you that started this would be proud.";
  if (days === 365) return "One year clean. Legendary.";
  if (days < 730) return "Second year — you're teaching yourself who you actually are without it.";
  return "Long game. This is legacy behavior now.";
}

function badgeFor(days: number): string | null {
  if (days >= 1825) return "5 YEAR CLUB";
  if (days >= 1000) return "1,000+ DAYS";
  if (days >= 730) return "2 YEAR CLUB";
  if (days >= 365) return "1 YEAR CLUB";
  if (days >= 180) return "6 MONTH CLUB";
  if (days >= 90) return "90 DAY CLUB";
  if (days >= 30) return "30 DAY CLUB";
  if (days >= 7) return "1 WEEK IN";
  return null;
}

export function SobrietyCard() {
  const today = useToday();
  const { data: logs = [] } = useQuery<DailyLog[]>({ queryKey: ["/api/logs"] });

  const todayLog = useMemo(() => logs.find((l) => l.date === today), [logs, today]);
  const todayClean = todayLog?.noAlcohol === 1;

  const days = useMemo(() => currentStreak(logs, NO_ALCOHOL, today), [logs, today]);

  const { current, next } = pickMilestone(days);
  const spanTotal = next - current;
  const spanProgress = Math.max(0, days - current);
  const pct = spanTotal > 0 ? Math.min(1, spanProgress / spanTotal) : 0;
  const daysToNext = Math.max(0, next - days);

  const message = messageFor(days, todayClean);
  const badge = badgeFor(days);

  // Milestone tick marks along the bar
  const barMilestones = [30, 90, 365].filter((m) => m > current && m <= next);

  return (
    <section
      className="card-lux relative overflow-hidden p-6 md:p-8 mb-6"
      data-testid="card-sobriety"
    >
      {/* Subtle backdrop gradient — emerald wash for "clean" energy */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, hsl(150 60% 45%) 0%, transparent 55%)",
        }}
      />

      <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        {/* Left: big count */}
        <div className="flex items-center gap-5">
          <div
            className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, hsl(150 40% 30% / 0.35), hsl(150 30% 20% / 0.2))",
              border: "1px solid hsl(150 40% 45% / 0.35)",
            }}
          >
            <Shield className="w-6 h-6 md:w-7 md:h-7 text-emerald-300" strokeWidth={1.5} />
          </div>
          <div>
            <div className="microlabel">Sobriety</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div
                className="num-display text-6xl md:text-7xl leading-none text-foreground"
                data-testid="text-sobriety-days"
              >
                {days}
              </div>
              <div className="text-sm text-muted-foreground uppercase tracking-widest">
                {days === 1 ? "day" : "days"}
              </div>
            </div>
            {badge && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-emerald-500/30 bg-emerald-500/5">
                <div className="w-1 h-1 rounded-full bg-emerald-400" />
                <span className="text-[10px] tracking-widest text-emerald-300 font-medium">
                  {badge}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: milestone progress + message */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-2">
            <div className="microlabel">
              Next milestone · <span className="text-foreground">{next} days</span>
            </div>
            <div className="text-xs text-muted-foreground num-display" data-testid="text-days-to-next">
              {daysToNext === 0 ? "reached" : `${daysToNext} to go`}
            </div>
          </div>

          {/* Progress bar with milestone ticks */}
          <div className="relative h-2 rounded-full bg-secondary overflow-visible mb-4">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${pct * 100}%`,
                background:
                  "linear-gradient(90deg, hsl(150 55% 55%), hsl(150 45% 70%))",
                boxShadow: "0 0 12px hsl(150 60% 50% / 0.4)",
              }}
            />
            {barMilestones.map((m) => {
              const mPct = ((m - current) / spanTotal) * 100;
              return (
                <div
                  key={m}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${mPct}%` }}
                  title={`${m} days`}
                >
                  <div className="w-0.5 h-3 bg-foreground/40" />
                </div>
              );
            })}
          </div>

          {/* Milestone ladder labels */}
          <div className="flex items-center gap-3 md:gap-4 flex-wrap mb-3 text-[10px] uppercase tracking-widest">
            {[30, 90, 365].map((m) => {
              const reached = days >= m;
              return (
                <div
                  key={m}
                  className={`flex items-center gap-1.5 ${
                    reached ? "text-emerald-300" : "text-muted-foreground/60"
                  }`}
                  data-testid={`milestone-${m}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      reached ? "bg-emerald-400" : "bg-muted-foreground/30"
                    }`}
                  />
                  {m === 30 ? "30 Days" : m === 90 ? "90 Days" : "1 Year"}
                </div>
              );
            })}
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-sobriety-message">
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}
