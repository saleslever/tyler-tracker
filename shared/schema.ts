import { pgTable, serial, text, integer, doublePrecision, boolean } from "drizzle-orm/pg-core";
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
 * Multiple challenges can exist; the "current" one is whichever is active
 * on today's date.
 */
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(),     // YYYY-MM-DD (inclusive)
  durationDays: integer("duration_days").notNull(),
  // JSON string array of habit keys required to make a "perfect day"
  habitKeys: text("habit_keys").notNull(),
  createdAt: text("created_at").notNull(),
});
export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true, createdAt: true,
});
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;
