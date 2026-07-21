import type { DailyLog, BossSeal, Challenge, Quest } from "@shared/schema";
import { HABITS, habitHit, addDays } from "./analytics";

/**
 * Compute the current numeric progress for a given quest metric.
 * All metrics measured against Tyler's local history.
 *
 * Metrics:
 *   perfect_streak      → current consecutive boss seals ending at today
 *   workouts_week       → workouts logged in the trailing 7 days (window ending today)
 *   sober_streak        → current consecutive days with noAlcohol === 1
 *   no_cheat_streak     → current consecutive days without cheatDay
 *   logged_days         → days with ANY habit hit in the last 30 days
 *   gratitude_streak    → current consecutive days with all 3 gratitude entries filled
 */
export function computeQuestProgress(
  metric: string,
  logs: DailyLog[],
  seals: BossSeal[],
  _challenge?: Challenge | null,
): number {
  if (!logs.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const sealDates = new Set(seals.map((s) => s.date));

  switch (metric) {
    case "perfect_streak": {
      let cur = today;
      let n = 0;
      let safety = 0;
      while (safety++ < 400 && sealDates.has(cur)) {
        n++;
        cur = addDays(cur, -1);
      }
      return n;
    }
    case "workouts_week": {
      let n = 0;
      let cur = addDays(today, -6);
      let safety = 0;
      while (cur <= today && safety++ < 10) {
        if ((byDate.get(cur)?.workout ?? 0) === 1) n++;
        cur = addDays(cur, 1);
      }
      return n;
    }
    case "sober_streak": {
      let cur = today;
      let n = 0;
      let safety = 0;
      while (safety++ < 400) {
        const log = byDate.get(cur);
        if (!log) break;
        if ((log.noAlcohol ?? 0) === 1) {
          n++;
          cur = addDays(cur, -1);
        } else break;
      }
      return n;
    }
    case "no_cheat_streak": {
      let cur = today;
      let n = 0;
      let safety = 0;
      while (safety++ < 400) {
        const log = byDate.get(cur);
        if (!log) break;
        if ((log.cheatDay ?? 0) === 0) {
          n++;
          cur = addDays(cur, -1);
        } else break;
      }
      return n;
    }
    case "logged_days": {
      let n = 0;
      let cur = addDays(today, -29);
      let safety = 0;
      while (cur <= today && safety++ < 40) {
        const log = byDate.get(cur);
        if (log && HABITS.some((h) => habitHit(log, h))) n++;
        cur = addDays(cur, 1);
      }
      return n;
    }
    case "gratitude_streak": {
      let cur = today;
      let n = 0;
      let safety = 0;
      while (safety++ < 400) {
        const log = byDate.get(cur);
        if (!log) break;
        const g1 = (log.gratitude1 ?? "").trim();
        const g3 = (log.gratitude3 ?? "").trim();
        const gp = (log.gratitudePossession ?? "").trim();
        if (g1 && g3 && gp) {
          n++;
          cur = addDays(cur, -1);
        } else break;
      }
      return n;
    }
    default:
      return 0;
  }
}

export function isQuestComplete(q: Quest): boolean {
  return q.progress >= q.goal;
}
