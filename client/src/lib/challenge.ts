import type { DailyLog, Challenge } from "@shared/schema";
import { HABITS, habitHit, addDays, type BoolHabitKey, type NumHabitKey } from "./analytics";

export type HabitKey = BoolHabitKey | NumHabitKey;

/**
 * Challenge helpers — pure functions, no side effects.
 *
 * Rules:
 *   requiredDaily: habits that MUST be hit every single day
 *   requiredWeekly: { habitKey: N } — habit must be hit N days out of 7 (Mon–Sun)
 *   optionalHabits: shown on checklist, do not affect perfect-day math
 *   cheatDaysPerWeek: allowed "unperfect" days per Mon–Sun week (manually tapped)
 *
 * A "perfect day" = every requiredDaily habit is hit (or you tapped Cheat Day
 * and haven't used up your cheat allowance for this week).
 * A week is "on track" if every requiredWeekly count is met by Sunday.
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

export function requiredDailyHabits(challenge: Challenge): HabitKey[] {
  try {
    const keys = JSON.parse(challenge.requiredDaily) as HabitKey[];
    return keys.filter((k) => HABITS.some((h) => h.key === k));
  } catch {
    return [];
  }
}

export function requiredWeeklyHabits(challenge: Challenge): Record<HabitKey, number> {
  try {
    const obj = JSON.parse(challenge.requiredWeekly) as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (HABITS.some((h) => h.key === k)) out[k] = v;
    }
    return out as Record<HabitKey, number>;
  } catch {
    return {} as Record<HabitKey, number>;
  }
}

export function optionalHabits(challenge: Challenge): HabitKey[] {
  try {
    const keys = JSON.parse(challenge.optionalHabits) as HabitKey[];
    return keys.filter((k) => HABITS.some((h) => h.key === k));
  } catch {
    return [];
  }
}

/** Was every required-daily habit hit? */
export function hitAllDailyRequired(
  log: DailyLog | undefined,
  challenge: Challenge,
): boolean {
  const keys = requiredDailyHabits(challenge);
  if (!keys.length) return false;
  return keys.every((k) => {
    const h = HABITS.find((x) => x.key === k)!;
    return habitHit(log, h);
  });
}

/**
 * A day counts as "perfect" if:
 *   - every requiredDaily habit was hit, OR
 *   - the day was tapped as a Cheat Day (log.cheatDay === 1)
 */
export function isPerfectDay(
  log: DailyLog | undefined,
  challenge: Challenge,
): boolean {
  if (!log) return false;
  if (log.cheatDay === 1) return true;
  return hitAllDailyRequired(log, challenge);
}

/** Fraction 0..1 of daily-required habits hit on a day. Cheat day counts as 1.0 */
export function dayScoreForChallenge(
  log: DailyLog | undefined,
  challenge: Challenge,
): number {
  if (!log) return 0;
  if (log.cheatDay === 1) return 1;
  const keys = requiredDailyHabits(challenge);
  if (!keys.length) return 0;
  const hits = keys.filter((k) => {
    const h = HABITS.find((x) => x.key === k)!;
    return habitHit(log, h);
  }).length;
  return hits / keys.length;
}

// ---- Week utilities (Mon = start) --------------------------------------

/** Returns YYYY-MM-DD of the Monday that starts the ISO week containing dateStr. */
export function weekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  const offset = day === 0 ? -6 : 1 - day; // shift back to Monday
  dt.setDate(dt.getDate() + offset);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** All challenge days that fall in the same Mon–Sun week as `dateStr`. */
export function weekDaysInChallenge(challenge: Challenge, dateStr: string): string[] {
  const start = weekStart(dateStr);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (isDayInChallenge(challenge, d)) out.push(d);
  }
  return out;
}

// ---- Rollup ------------------------------------------------------------

export interface WeeklyProgress {
  weekStart: string;
  habitCounts: Record<HabitKey, { hit: number; required: number }>;
  cheatsUsed: number;
  cheatsAllowed: number;
}

export interface ChallengeRollup {
  today: string;
  currentDay: number;
  totalDays: number;
  daysElapsed: number;
  daysRemaining: number;
  perfectDays: number;
  currentPerfectStreak: number;
  bestPerfectStreak: number;
  pct: number;
  perfectPct: number;
  status: "upcoming" | "active" | "complete";
  todayLog?: DailyLog;
  todayPerfect: boolean;
  todayIsCheat: boolean;
  todayAllDailyHit: boolean;
  thisWeek: WeeklyProgress;
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

  // Current streak: if today isn't perfect yet, fall back to yesterday.
  let currentPerfectStreak = curStreak;
  if (
    status === "active" &&
    perfectByDate.length > 0 &&
    !perfectByDate[perfectByDate.length - 1]
  ) {
    let s = 0;
    for (let i = perfectByDate.length - 2; i >= 0; i--) {
      if (perfectByDate[i]) s++;
      else break;
    }
    currentPerfectStreak = s;
  }

  const todayLog = logsByDate.get(today);
  const todayIsCheat = todayLog?.cheatDay === 1;
  const todayAllDailyHit = hitAllDailyRequired(todayLog, challenge);
  const todayPerfect =
    status === "active" && (todayIsCheat || todayAllDailyHit);

  // Weekly rollup for the current week (clamped to challenge range).
  const weekly = requiredWeeklyHabits(challenge);
  const weekDays = weekDaysInChallenge(challenge, today);
  const habitCounts: Record<string, { hit: number; required: number }> = {};
  for (const [key, required] of Object.entries(weekly)) {
    const h = HABITS.find((x) => x.key === key);
    if (!h) continue;
    let hit = 0;
    for (const d of weekDays) {
      if (habitHit(logsByDate.get(d), h)) hit++;
    }
    habitCounts[key] = { hit, required };
  }
  let cheatsUsed = 0;
  for (const d of weekDays) {
    if (logsByDate.get(d)?.cheatDay === 1) cheatsUsed++;
  }

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
    todayIsCheat,
    todayAllDailyHit,
    thisWeek: {
      weekStart: weekStart(today),
      habitCounts: habitCounts as Record<HabitKey, { hit: number; required: number }>,
      cheatsUsed,
      cheatsAllowed: challenge.cheatDaysPerWeek,
    },
  };
}
