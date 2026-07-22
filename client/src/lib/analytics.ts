import type { DailyLog } from "@shared/schema";

export type BoolHabitKey =
  | "water"
  | "vitamins"
  | "morningDrink"
  | "noAlcohol"
  | "noEnergyDrinks"
  | "workout"
  | "lowCarb";

export type NumHabitKey = "fastingHours" | "weight" | "sleepScore" | "steps";

export interface HabitDef {
  key: BoolHabitKey | NumHabitKey;
  label: string;
  kind: "bool" | "num";
  goal?: number; // for numeric; a log "hits" its goal when value ≥/≤ target
  goalDirection?: "gte" | "lte"; // steps=gte, weight=lte
  unit?: string;
  hint?: string;
  emoji?: string;
}

// Order matters — this is the display order in the UI.
// Challenge-required-daily habits are listed first.
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

/** Overall completion for a day = fraction of habits hit. */
export function dayScore(log: DailyLog | undefined): number {
  const hits = HABITS.filter((h) => habitHit(log, h)).length;
  return hits / HABITS.length;
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
export function overallStreak(logs: DailyLog[], today: string, threshold = 0.7): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let streak = 0;
  let cursor = today;
  if (dayScore(byDate.get(cursor)) < threshold) {
    cursor = addDays(cursor, -1);
  }
  while (dayScore(byDate.get(cursor)) >= threshold) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Rolling completion % over last N days. */
export function completionRate(logs: DailyLog[], today: string, days: number): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let total = 0;
  for (let i = 0; i < days; i++) {
    total += dayScore(byDate.get(addDays(today, -i)));
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
  days: number
): { date: string; cumulative: number; daily: number }[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const out: { date: string; cumulative: number; daily: number }[] = [];
  let cumulative = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const log = byDate.get(d);
    const daily = HABITS.filter((h) => habitHit(log, h)).length;
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
