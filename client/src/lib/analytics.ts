import type { DailyLog } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

// Legacy string-union kept only for backwards compatibility. Any string
// (custom habit keys start with `custom_`) is now valid at runtime.
export type BoolHabitKey = string;
export type NumHabitKey = string;

export interface HabitDef {
  id?: number;
  key: string;
  label: string;
  kind: "bool" | "num";
  goal?: number | null;
  goalDirection?: "gte" | "lte" | null;
  unit?: string | null;
  hint?: string | null;
  emoji?: string | null;
  position?: number;
  active?: number;
  builtin?: number;
}

/**
 * Live habit list from the server. Falls back to the built-in HABITS array
 * during first paint so nothing flickers to "empty".
 */
export function useHabits(): HabitDef[] {
  const { data } = useQuery<HabitDef[]>({ queryKey: ["/api/habits"] });
  const rows = data && data.length > 0 ? data : HABITS;
  // Only show active habits in the UI — soft-deleted (active=0) still exist for history.
  return rows.filter((h) => h.active !== 0);
}

// Order matters — default fallback list used before the server hook returns.
// Also used by non-React helper modules (xp.ts, challenge.ts) as a safety net.
export const HABITS: HabitDef[] = [
  { key: "lowCarb", label: "Low Carb", kind: "bool", hint: "< 50g net", emoji: "🥩" },
  { key: "fastingHours", label: "Fasting", kind: "num", goal: 16, goalDirection: "gte", unit: "hrs", emoji: "⏱" },
  { key: "vitamins", label: "Vitamins & Creatine", kind: "bool", emoji: "💊" },
  { key: "water", label: "1 Gallon Water", kind: "bool", emoji: "💧" },
  { key: "steps", label: "Steps", kind: "num", goal: 10000, goalDirection: "gte", unit: "", emoji: "👟" },
  { key: "workout", label: "Lift Weights", kind: "bool", hint: "4x / week", emoji: "🏋" },
  { key: "morningDrink", label: "Morning Drink", kind: "bool", emoji: "🥤" },
  { key: "sleepHours", label: "Sleep Hours", kind: "num", goal: 7, goalDirection: "gte", unit: "hrs", emoji: "🛌" },
  { key: "sleepScore", label: "Sleep Score", kind: "num", goal: 90, goalDirection: "gte", unit: "", emoji: "🌙" },
  { key: "restingHeartRate", label: "Resting HR", kind: "num", goal: 60, goalDirection: "lte", unit: "bpm", emoji: "❤️" },
  { key: "weight", label: "Weight", kind: "num", goal: 200, goalDirection: "lte", unit: "lb", emoji: "⚖" },
  { key: "noAlcohol", label: "No Alcohol", kind: "bool", emoji: "🚫🍺" },
  { key: "noEnergyDrinks", label: "No Energy Drinks", kind: "bool", emoji: "🚫⚡" },
];

/** Local YYYY-MM-DD (not UTC — avoids timezone drift for daily logs). */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayStr(dt);
}

/** Was the habit "hit" on the given log? */
export function habitHit(log: DailyLog | undefined, h: HabitDef): boolean {
  if (!log) return false;
  const v = (log as any)[h.key];
  if (h.kind === "bool") return v === 1;
  if (v == null) return false;
  if (h.goalDirection === "gte") return Number(v) >= (h.goal ?? 0);
  if (h.goalDirection === "lte") return Number(v) <= (h.goal ?? Infinity);
  return false;
}

/** Overall completion for a day = fraction of habits hit. Pass explicit list to avoid the static default. */
export function dayScore(log: DailyLog | undefined, habits: HabitDef[] = HABITS): number {
  if (habits.length === 0) return 0;
  const hits = habits.filter((h) => habitHit(log, h)).length;
  return hits / habits.length;
}

/** Current streak = consecutive days ending today where habit was hit. */
export function currentStreak(logs: DailyLog[], h: HabitDef, today: string): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let streak = 0;
  let cursor = today;
  // If today's log doesn't exist yet or isn't hit, start counting from yesterday.
  if (!habitHit(byDate.get(cursor), h)) {
    cursor = addDays(cursor, -1);
  }
  while (habitHit(byDate.get(cursor), h)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Overall streak: consecutive days ending today with ≥ 70% completion. */
export function overallStreak(logs: DailyLog[], today: string, threshold = 0.7, habits: HabitDef[] = HABITS): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let streak = 0;
  let cursor = today;
  if (dayScore(byDate.get(cursor), habits) < threshold) {
    cursor = addDays(cursor, -1);
  }
  while (dayScore(byDate.get(cursor), habits) >= threshold) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Rolling completion % over last N days. */
export function completionRate(logs: DailyLog[], today: string, days: number, habits: HabitDef[] = HABITS): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let total = 0;
  for (let i = 0; i < days; i++) {
    total += dayScore(byDate.get(addDays(today, -i)), habits);
  }
  return total / days;
}

/** Per-habit % hit rate over last N days. */
export function habitRate(logs: DailyLog[], h: HabitDef, today: string, days: number): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let hits = 0;
  for (let i = 0; i < days; i++) {
    if (habitHit(byDate.get(addDays(today, -i)), h)) hits++;
  }
  return hits / days;
}

/** Compound series — cumulative habits hit over the last N days. */
export function compoundSeries(
  logs: DailyLog[],
  today: string,
  days: number,
  habits: HabitDef[] = HABITS,
): { date: string; cumulative: number; daily: number }[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const out: { date: string; cumulative: number; daily: number }[] = [];
  let cumulative = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const log = byDate.get(d);
    const daily = habits.filter((h) => habitHit(log, h)).length;
    cumulative += daily;
    out.push({ date: d, cumulative, daily });
  }
  return out;
}

/** Short-format date label for charts: "Jul 12" */
export function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
