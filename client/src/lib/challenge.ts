import type { DailyLog, Challenge } from "@shared/schema";
import { HABITS, habitHit, addDays, type BoolHabitKey, type NumHabitKey } from "./analytics";

type HabitKey = BoolHabitKey | NumHabitKey;

/**
 * Challenge helpers — pure functions, no side effects.
 * A challenge is a range of days [startDate, endDate] with a required set
 * of habit keys. A "perfect day" is one where every required habit is hit.
 */

export function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function isDayInChallenge(challenge: Challenge, dateStr: string): boolean {
  return dateStr >= challenge.startDate && dateStr <= challenge.endDate;
}

/**
 * Day number within a challenge (1-indexed).
 * Returns 0 if the date is before the challenge starts,
 * or > durationDays if it's after.
 */
export function dayNumber(challenge: Challenge, dateStr: string): number {
  return daysBetween(challenge.startDate, dateStr) + 1;
}

export function requiredHabits(challenge: Challenge): HabitKey[] {
  try {
    const keys = JSON.parse(challenge.habitKeys) as HabitKey[];
    return keys.filter((k) => HABITS.some((h) => h.key === k));
  } catch {
    return [];
  }
}

export function isPerfectDay(
  log: DailyLog | undefined,
  challenge: Challenge,
): boolean {
  const keys = requiredHabits(challenge);
  if (!keys.length) return false;
  return keys.every((k) => {
    const h = HABITS.find((x) => x.key === k)!;
    return habitHit(log, h);
  });
}

export function dayScoreForChallenge(
  log: DailyLog | undefined,
  challenge: Challenge,
): number {
  const keys = requiredHabits(challenge);
  if (!keys.length) return 0;
  const hits = keys.filter((k) => {
    const h = HABITS.find((x) => x.key === k)!;
    return habitHit(log, h);
  }).length;
  return hits / keys.length;
}

export interface ChallengeRollup {
  today: string;
  currentDay: number;      // 1..durationDays (0 if not started, >duration if finished)
  totalDays: number;       // challenge.durationDays
  daysElapsed: number;     // days including today, capped to totalDays (0 pre-start)
  daysRemaining: number;   // totalDays - daysElapsed, floored at 0
  perfectDays: number;     // count of perfect days so far
  currentPerfectStreak: number; // consecutive perfect days ending today (or yesterday if today unlogged)
  bestPerfectStreak: number;
  pct: number;             // daysElapsed / totalDays
  perfectPct: number;      // perfectDays / daysElapsed (0 if none elapsed)
  status: "upcoming" | "active" | "complete";
  todayLog?: DailyLog;
  todayPerfect: boolean;
}

export function rollupChallenge(
  challenge: Challenge,
  logs: DailyLog[],
  today: string,
): ChallengeRollup {
  const logsByDate = new Map(logs.map((l) => [l.date, l] as const));

  const status: "upcoming" | "active" | "complete" =
    today < challenge.startDate ? "upcoming"
    : today > challenge.endDate ? "complete"
    : "active";

  const totalDays = challenge.durationDays;
  const rawElapsed = daysBetween(challenge.startDate, today) + 1;
  const daysElapsed = Math.max(0, Math.min(totalDays, rawElapsed));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const currentDay = status === "upcoming" ? 0 : Math.min(totalDays, rawElapsed);

  // Walk each challenge day up to today.
  let perfectDays = 0;
  let curStreak = 0;
  let bestStreak = 0;
  const perfectByDate: boolean[] = [];
  for (let i = 0; i < daysElapsed; i++) {
    const dStr = addDays(challenge.startDate, i);
    const log = logsByDate.get(dStr);
    const perfect = isPerfectDay(log, challenge);
    perfectByDate.push(perfect);
    if (perfect) {
      perfectDays++;
      curStreak++;
      bestStreak = Math.max(bestStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }

  // Current streak ending today: if today is unlogged/imperfect, fall back
  // to the streak ending yesterday so you don't "lose" your streak before
  // you've had a chance to check in.
  let currentPerfectStreak = curStreak;
  if (
    status === "active" &&
    perfectByDate.length > 0 &&
    !perfectByDate[perfectByDate.length - 1]
  ) {
    // count back from second-to-last
    let s = 0;
    for (let i = perfectByDate.length - 2; i >= 0; i--) {
      if (perfectByDate[i]) s++;
      else break;
    }
    currentPerfectStreak = s;
  }

  const todayLog = logsByDate.get(today);
  const todayPerfect = status === "active" && isPerfectDay(todayLog, challenge);

  return {
    today,
    currentDay,
    totalDays,
    daysElapsed,
    daysRemaining,
    perfectDays,
    currentPerfectStreak,
    bestPerfectStreak: bestStreak,
    pct: totalDays > 0 ? daysElapsed / totalDays : 0,
    perfectPct: daysElapsed > 0 ? perfectDays / daysElapsed : 0,
    status,
    todayLog,
    todayPerfect,
  };
}
