import { pgTable, serial, text, integer, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Daily habit + metric log — one row per calendar day (YYYY-MM-DD).
 *
 * Boolean habits are stored as int (0/1) to keep the API contract identical
 * to the old SQLite build — the frontend already checks `=== 1` everywhere.
 */
export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  fastingHours: doublePrecision("fasting_hours"),
  weight: doublePrecision("weight"),
  sleepScore: integer("sleep_score"),
  steps: integer("steps"),
  water: integer("water").notNull().default(0),
  vitamins: integer("vitamins").notNull().default(0),
  morningDrink: integer("morning_drink").notNull().default(0),
  noAlcohol: integer("no_alcohol").notNull().default(0),
  noEnergyDrinks: integer("no_energy_drinks").notNull().default(0),
  workout: integer("workout").notNull().default(0),
  lowCarb: integer("low_carb").notNull().default(0),
  cheatDay: integer("cheat_day").notNull().default(0),
  // Morning gratitude ritual — three prompts from the Notion doc
  gratitude1: text("gratitude_1"),        // #1 thing you're grateful for
  gratitude3: text("gratitude_3"),        // 3 things
  gratitudePossession: text("gratitude_possession"), // possession you take for granted
});
export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({ id: true });
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

/** Tasks — Today / Backlog with priority. */
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  list: text("list").notNull().default("today"),
  priority: text("priority").notNull().default("med"),
  completed: integer("completed").notNull().default(0),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true, completed: true, completedAt: true, createdAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

/** Journal — one entry per day (upsert by date). */
export const journal = pgTable("journal", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  wins: text("wins"),
  lessons: text("lessons"),
  tomorrow: text("tomorrow"),
  notes: text("notes"),
});
export const insertJournalSchema = createInsertSchema(journal).omit({ id: true });
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journal.$inferSelect;

/**
 * Goals — longer-term with target date and progress %.
 *
 * horizon:
 *   twelve_month — annual ("12-month goal")
 *   ninety_day   — 90-day milestone
 *   long_term    — >1yr, aspirational
 */
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail"),
  category: text("category").notNull().default("business"), // business | health | wealth | personal | relationship
  horizon: text("horizon").notNull().default("twelve_month"), // twelve_month | ninety_day | long_term
  targetDate: text("target_date"),
  progress: integer("progress").notNull().default(0), // 0-100
  status: text("status").notNull().default("active"), // active | done | paused
  createdAt: text("created_at").notNull(),
});
export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true, createdAt: true,
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goals.$inferSelect;

/**
 * Challenge — a named block of days with a required set of habits.
 *
 * Rules (encoded in JSON columns):
 *   requiredDaily: habits that must be hit every day (no cheat allowed)
 *   requiredWeekly: { habitKey: N } — habit must be hit N days per calendar week
 *   optionalHabits: shown on the checklist but do not affect perfect-day math
 *   cheatDaysPerWeek: how many missed days per week don't break the streak
 */
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(),     // YYYY-MM-DD (inclusive)
  durationDays: integer("duration_days").notNull(),
  requiredDaily: text("required_daily").notNull(),   // JSON string array of habit keys
  requiredWeekly: text("required_weekly").notNull(), // JSON string { habitKey: count }
  optionalHabits: text("optional_habits").notNull().default("[]"), // JSON string array
  cheatDaysPerWeek: integer("cheat_days_per_week").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true, createdAt: true,
});
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;

/**
 * Rituals — the fixed morning-alignment text sections from the Notion doc.
 *
 *   key: unique slug for the section (why | questions | code | milestones)
 *   title: display title
 *   subtitle: optional subtitle/description
 *   items: JSON string array of bullet strings
 *   updatedAt: ISO timestamp
 */
export const rituals = pgTable("rituals", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  items: text("items").notNull().default("[]"), // JSON string array
  updatedAt: text("updated_at").notNull(),
});
export const insertRitualSchema = createInsertSchema(rituals).omit({
  id: true, updatedAt: true,
});
export type InsertRitual = z.infer<typeof insertRitualSchema>;
export type Ritual = typeof rituals.$inferSelect;

/**
 * Quests — concurrent side objectives that give the game brain bite-sized targets.
 *
 * Each quest has:
 *   key: stable identifier ("iron_week", "the_forge", ...)
 *   title, subtitle, motto, icon (emoji or lucide name), tone ("iron"|"gold"|"blood"|"sober"|"forge")
 *   goal: numeric target (e.g. 7 perfect days)
 *   metric: which value to track ("perfect_streak", "workouts_week", "sober_days", "no_cheat_days", "habits_hit_week")
 *   xpReward: XP granted on completion
 *   claimedAt: null while active, ISO timestamp once claimed
 *   completedAt: null until goal reached (auto-set by the client-side sync)
 *   updatedAt: ISO timestamp of last mutation
 *
 * Quests are re-claimable — after claimedAt is set, the client resets progress and starts fresh cycle.
 */
export const quests = pgTable("quests", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  motto: text("motto"),
  icon: text("icon"),
  tone: text("tone").notNull().default("iron"),
  metric: text("metric").notNull(),
  goal: integer("goal").notNull(),
  xpReward: integer("xp_reward").notNull().default(100),
  progress: integer("progress").notNull().default(0),
  completedAt: text("completed_at"),
  claimedAt: text("claimed_at"),
  updatedAt: text("updated_at").notNull(),
});
export const insertQuestSchema = createInsertSchema(quests).omit({
  id: true, updatedAt: true,
});
export type InsertQuest = z.infer<typeof insertQuestSchema>;
export type Quest = typeof quests.$inferSelect;

/**
 * Personal Records — lifetime bests, auto-updated by the client after every log change.
 *
 * key: stable identifier ("best_perfect_streak", "longest_sober", "best_week_xp", ...)
 * value: numeric record value
 * label: human display label
 * unit: "days" | "XP" | "hrs" | etc.
 * setOnDate: date this record was set (YYYY-MM-DD)
 * seenAt: null if a NEW record hasn't been acknowledged yet; ISO timestamp once user has seen it
 */
export const records = pgTable("records", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  unit: text("unit"),
  value: integer("value").notNull().default(0),
  setOnDate: text("set_on_date"),
  seenAt: text("seen_at"),
  updatedAt: text("updated_at").notNull(),
});
export const insertRecordSchema = createInsertSchema(records).omit({
  id: true, updatedAt: true,
});
export type InsertRecord = z.infer<typeof insertRecordSchema>;
export type Record_ = typeof records.$inferSelect;

/**
 * Boss seals — one row per calendar day where Tyler completed all required-daily habits.
 * Used to prevent re-firing the Daily Boss victory ceremony (once per day).
 * Also renders as a wax-seal on the challenge grid.
 */
export const bossSeals = pgTable("boss_seals", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  sealedAt: text("sealed_at").notNull(),
  xpAwarded: integer("xp_awarded").notNull().default(0),
});
export const insertBossSealSchema = createInsertSchema(bossSeals).omit({
  id: true,
});
export type InsertBossSeal = z.infer<typeof insertBossSealSchema>;
export type BossSeal = typeof bossSeals.$inferSelect;
