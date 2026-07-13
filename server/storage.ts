import { dailyLogs, tasks } from "@shared/schema";
import type { DailyLog, InsertDailyLog, Task, InsertTask } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, gte } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Create tables if they don't exist (simple bootstrap; no migrations for personal single-user app)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    fasting_hours REAL,
    weight REAL,
    sleep_score INTEGER,
    steps INTEGER,
    water INTEGER NOT NULL DEFAULT 0,
    vitamins INTEGER NOT NULL DEFAULT 0,
    morning_drink INTEGER NOT NULL DEFAULT 0,
    no_alcohol INTEGER NOT NULL DEFAULT 0,
    no_energy_drinks INTEGER NOT NULL DEFAULT 0,
    workout INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    list TEXT NOT NULL DEFAULT 'today',
    priority TEXT NOT NULL DEFAULT 'med',
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  // Daily logs
  getLog(date: string): Promise<DailyLog | undefined>;
  upsertLog(date: string, patch: Partial<InsertDailyLog>): Promise<DailyLog>;
  getLogsSince(date: string): Promise<DailyLog[]>;
  getAllLogs(): Promise<DailyLog[]>;

  // Tasks
  getTasks(): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, patch: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getLog(date: string): Promise<DailyLog | undefined> {
    return db.select().from(dailyLogs).where(eq(dailyLogs.date, date)).get();
  }

  async upsertLog(date: string, patch: Partial<InsertDailyLog>): Promise<DailyLog> {
    const existing = await this.getLog(date);
    if (existing) {
      return db
        .update(dailyLogs)
        .set(patch)
        .where(eq(dailyLogs.date, date))
        .returning()
        .get();
    }
    return db.insert(dailyLogs).values({ date, ...patch }).returning().get();
  }

  async getLogsSince(date: string): Promise<DailyLog[]> {
    return db
      .select()
      .from(dailyLogs)
      .where(gte(dailyLogs.date, date))
      .all();
  }

  async getAllLogs(): Promise<DailyLog[]> {
    return db.select().from(dailyLogs).all();
  }

  async getTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt)).all();
  }

  async createTask(task: InsertTask): Promise<Task> {
    return db
      .insert(tasks)
      .values({ ...task, createdAt: new Date().toISOString() })
      .returning()
      .get();
  }

  async updateTask(id: number, patch: Partial<Task>): Promise<Task | undefined> {
    return db
      .update(tasks)
      .set(patch)
      .where(eq(tasks.id, id))
      .returning()
      .get();
  }

  async deleteTask(id: number): Promise<void> {
    db.delete(tasks).where(eq(tasks.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
