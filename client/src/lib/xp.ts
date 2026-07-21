import type { DailyLog, Quest, BossSeal } from "@shared/schema";
import { HABITS, habitHit, addDays } from "./analytics";

/**
 * XP + Rank system.
 *
 * All XP is deterministic — computed from the persisted state (dailyLogs, quests, bossSeals).
 * We never store an "xp" column; recomputing from source of truth prevents drift.
 *
 * Base rules (tune here to change the economy):
 *   - Every boolean-habit hit           = +10 XP
 *   - Every numeric-habit goal hit       = +15 XP
 *   - Boss seal (all 5 required daily)   = +50 XP bonus (on top of the habits themselves)
 *   - Full gratitude ritual (all 3)      = +25 XP
 *   - Cheat day used                     = 0 XP (neither bonus nor penalty)
 *   - Perfect-streak day (2+ in a row)   = +5 XP per day currently on streak (compound)
 *   - Quest completion (claimed)         = quest.xpReward
 */
export const XP = {
  BOOL_HIT: 10,
  NUM_HIT: 15,
  BOSS_SEAL: 50,
  GRATITUDE_FULL: 25,
  STREAK_BONUS_PER_DAY: 5,
} as const;

/** How much XP a single log grants. Pure. */
export function xpFromLog(log: DailyLog | undefined): number {
  if (!log) return 0;
  let xp = 0;
  for (const h of HABITS) {
    if (!habitHit(log, h)) continue;
    xp += h.kind === "bool" ? XP.BOOL_HIT : XP.NUM_HIT;
  }
  // Gratitude bonus — all three answered
  const g1 = (log.gratitude1 ?? "").trim();
  const g3 = (log.gratitude3 ?? "").trim();
  const gp = (log.gratitudePossession ?? "").trim();
  if (g1 && g3 && gp) xp += XP.GRATITUDE_FULL;
  return xp;
}

/** XP within a date range (inclusive). */
export function xpBetween(logs: DailyLog[], from: string, to: string): number {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  let cur = from;
  let total = 0;
  let safety = 0;
  while (cur <= to && safety++ < 5000) {
    total += xpFromLog(byDate.get(cur));
    cur = addDays(cur, 1);
  }
  return total;
}

/**
 * Total lifetime XP.
 * Includes: per-log XP, boss seal bonuses, streak-compound bonuses, and claimed quests.
 */
export function totalXP(
  logs: DailyLog[],
  bossSeals: BossSeal[],
  quests: Quest[],
): number {
  let xp = 0;
  for (const l of logs) xp += xpFromLog(l);
  for (const s of bossSeals) xp += XP.BOSS_SEAL;
  for (const q of quests) if (q.claimedAt) xp += q.xpReward;
  // Compound streak bonus: for every day where the previous day was also perfect,
  // grant +5 XP per day currently on the streak (as of that day).
  // Order logs by date for the walk.
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const sealSet = new Set(bossSeals.map((s) => s.date));
  const dates = Array.from(new Set(logs.map((l) => l.date))).sort();
  let streak = 0;
  for (const d of dates) {
    const perfect = sealSet.has(d) || (byDate.get(d)?.cheatDay === 1);
    if (perfect) {
      streak += 1;
      if (streak >= 2) xp += XP.STREAK_BONUS_PER_DAY * streak;
    } else {
      streak = 0;
    }
  }
  return xp;
}

/** Today's XP (just from today's log — no lifetime bonuses). Handy for the daily meter. */
export function xpToday(logs: DailyLog[], today: string): number {
  const log = logs.find((l) => l.date === today);
  return xpFromLog(log);
}

/** ==== RANK LADDER =====================================================
 *
 * 8 tiers, each with a thematic name, Roman numeral, and XP threshold.
 * Threshold values are lifetime XP required to REACH that tier.
 *
 *   Squire     I     0      —  a green fighter
 *   Warden     II    600    —  the wall
 *   Knight     III   1800   —  sworn to the code
 *   Vanguard   IV    4000   —  leads the charge
 *   Baron      V     7500   —  holds land
 *   Duke       VI    12500  —  commands lords
 *   King       VII   20000  —  wears the crown
 *   Sovereign  VIII  32000  —  above kings
 */
export interface Rank {
  tier: number;
  key: string;
  name: string;
  numeral: string;
  minXP: number;
  color: string;      // hex accent
  bgColor: string;    // hex background
  motto: string;
}

export const RANKS: Rank[] = [
  { tier: 1, key: "squire",    name: "Squire",    numeral: "I",    minXP: 0,     color: "#a3a3a3", bgColor: "#1a1a1a", motto: "The path begins." },
  { tier: 2, key: "warden",    name: "Warden",    numeral: "II",   minXP: 600,   color: "#c9b98a", bgColor: "#22201a", motto: "Hold the wall." },
  { tier: 3, key: "knight",    name: "Knight",    numeral: "III",  minXP: 1800,  color: "#d4a35a", bgColor: "#2a231a", motto: "Sworn to the code." },
  { tier: 4, key: "vanguard",  name: "Vanguard",  numeral: "IV",   minXP: 4000,  color: "#e0a83a", bgColor: "#2e2416", motto: "Lead the charge." },
  { tier: 5, key: "baron",     name: "Baron",     numeral: "V",    minXP: 7500,  color: "#eab13e", bgColor: "#302516", motto: "The land is yours." },
  { tier: 6, key: "duke",      name: "Duke",      numeral: "VI",   minXP: 12500, color: "#f2b93e", bgColor: "#332714", motto: "Lords bend the knee." },
  { tier: 7, key: "king",      name: "King",      numeral: "VII",  minXP: 20000, color: "#f8c33e", bgColor: "#362912", motto: "Wear the crown." },
  { tier: 8, key: "sovereign", name: "Sovereign", numeral: "VIII", minXP: 32000, color: "#ffdd66", bgColor: "#3b2c10", motto: "Above kings." },
];

/** Get the rank an XP value corresponds to. */
export function rankForXP(xp: number): Rank {
  let r = RANKS[0];
  for (const cand of RANKS) {
    if (xp >= cand.minXP) r = cand;
    else break;
  }
  return r;
}

/** Get the next rank up (or the same rank if already at the top). */
export function nextRank(rank: Rank): Rank {
  const idx = RANKS.findIndex((r) => r.key === rank.key);
  return RANKS[Math.min(idx + 1, RANKS.length - 1)];
}

/** Progress 0..1 within the current rank band. Returns 1 for Sovereign. */
export function rankProgress(xp: number): { rank: Rank; next: Rank; pct: number; xpIntoRank: number; xpNeededForNext: number } {
  const rank = rankForXP(xp);
  const next = nextRank(rank);
  if (rank.key === next.key) {
    return { rank, next, pct: 1, xpIntoRank: xp - rank.minXP, xpNeededForNext: 0 };
  }
  const span = next.minXP - rank.minXP;
  const xpIntoRank = xp - rank.minXP;
  return { rank, next, pct: Math.min(1, xpIntoRank / span), xpIntoRank, xpNeededForNext: next.minXP - xp };
}
