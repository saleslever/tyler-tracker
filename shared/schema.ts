import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Daily habit + metric log — one row per calendar day (YYYY-MM-DD).
 * Booleans are stored as integer (0/1). Numerics use real.
 */
export const dailyLogs = sqliteTable("daily_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(), // YYYY-MM-DD

  // Numeric metrics
  fastingHours: real("fasting_hours"), // hrs
  weight: real("weight"), // lbs
  sleepScore: integer("sleep_score"), // 0-100
  steps: integer("steps"),

  // Check-off habits
  water: integer("water").notNull().default(0), // 1 gal daily
  vitamins: integer("vitamins").notNull().default(0),
  morningDrink: integer("morning_drink").notNull().default(0),
  noAlcohol: integer("no_alcohol").notNull().default(0),
  noEnergyDrinks: integer("no_energy_drinks").notNull().default(0),
  workout: integer("workout").notNull().default(0),
});

export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({ id: true });
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type DailyLog = typeof dailyLogs.$inferSelect;

/**
 * Tasks — "today" list + backlog. list = 'today' | 'backlog'.
 * completed_at is set when a task is checked off.
 */
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  list: text("list").notNull().default("today"), // 'today' | 'backlog'
  priority: text("priority").notNull().default("med"), // 'high' | 'med' | 'low'
  completed: integer("completed").notNull().default(0),
  completedAt: text("completed_at"),
  createdAt: text("created_at").notNull(),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  completed: true,
  completedAt: true,
  createdAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
