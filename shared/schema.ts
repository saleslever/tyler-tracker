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

/** Goals — longer-term with target date and progress %. */
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail"),
  category: text("category").notNull().default("business"), // business | health | personal | wealth
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
