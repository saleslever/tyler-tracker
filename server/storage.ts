import { dailyLogs, tasks, journal, goals, challenges } from "@shared/schema";
import type {
  DailyLog, InsertDailyLog, Task, InsertTask,
  Journal, InsertJournal, Goal, InsertGoal,
  Challenge, InsertChallenge,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, sql } from "drizzle-orm";

/**
 * Postgres connection. Uses DATABASE_URL from the env — Railway provides
 * this automatically when a Postgres addon is attached. Locally, docker-compose
 * spins up postgres:15 on port 5432 with the same URL in .env.
 */
const connectionString =
  process.env.DATABASE_URL ||
  "postgres://tyler:tyler@localhost:5432/tyler_tracker";

// SSL is required for most managed Postgres providers (Railway, Neon, Supabase).
// Locally the postgres:15 image doesn't offer SSL, so we only enable it when
// the URL points at something remote.
const isRemote = /(railway|neon|supabase|render|amazonaws|azure)/i.test(connectionString) ||
  process.env.DATABASE_SSL === "true";

export const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);

/**
 * Bootstrap schema on startup. Uses CREATE TABLE IF NOT EXISTS so it's safe
 * to run every boot. For a proper migration system later we can move to
 * drizzle-kit, but this keeps deploy simple.
 */
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      fasting_hours DOUBLE PRECISION,
      weight DOUBLE PRECISION,
      sleep_score INTEGER,
      steps INTEGER,
      water INTEGER NOT NULL DEFAULT 0,
      vitamins INTEGER NOT NULL DEFAULT 0,
      morning_drink INTEGER NOT NULL DEFAULT 0,
      no_alcohol INTEGER NOT NULL DEFAULT 0,
      no_energy_drinks INTEGER NOT NULL DEFAULT 0,
      workout INTEGER NOT NULL DEFAULT 0,
      low_carb INTEGER NOT NULL DEFAULT 0,
      cheat_day INTEGER NOT NULL DEFAULT 0
    );
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS low_carb INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS cheat_day INTEGER NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      list TEXT NOT NULL DEFAULT 'today',
      priority TEXT NOT NULL DEFAULT 'med',
      completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      wins TEXT,
      lessons TEXT,
      tomorrow TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      detail TEXT,
      category TEXT NOT NULL DEFAULT 'business',
      target_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      duration_days INTEGER NOT NULL,
      required_daily TEXT NOT NULL DEFAULT '[]',
      required_weekly TEXT NOT NULL DEFAULT '{}',
      optional_habits TEXT NOT NULL DEFAULT '[]',
      cheat_days_per_week INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    ALTER TABLE challenges ADD COLUMN IF NOT EXISTS required_daily TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE challenges ADD COLUMN IF NOT EXISTS required_weekly TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE challenges ADD COLUMN IF NOT EXISTS optional_habits TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE challenges ADD COLUMN IF NOT EXISTS cheat_days_per_week INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE challenges DROP COLUMN IF EXISTS habit_keys;
  `);
}

export interface IStorage {
  // Logs
  getLog(date: string): Promise<DailyLog | undefined>;
  upsertLog(date: string, patch: Partial<InsertDailyLog>): Promise<DailyLog>;
  getAllLogs(): Promise<DailyLog[]>;
  deleteLog(date: string): Promise<void>;
  // Tasks
  getTasks(): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, patch: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  // Journal
  getJournal(date: string): Promise<Journal | undefined>;
  upsertJournal(date: string, patch: Partial<InsertJournal>): Promise<Journal>;
  getAllJournal(): Promise<Journal[]>;
  // Goals
  getGoals(): Promise<Goal[]>;
  createGoal(g: InsertGoal): Promise<Goal>;
  updateGoal(id: number, patch: Partial<Goal>): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<void>;
  // Challenges
  getChallenges(): Promise<Challenge[]>;
  getActiveChallenge(today: string): Promise<Challenge | undefined>;
  createChallenge(c: InsertChallenge): Promise<Challenge>;
  deleteChallenge(id: number): Promise<void>;
  // Reset
  resetAll(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getLog(date: string) {
    const rows = await db.select().from(dailyLogs).where(eq(dailyLogs.date, date));
    return rows[0];
  }
  async upsertLog(date: string, patch: Partial<InsertDailyLog>) {
    const existing = await this.getLog(date);
    if (existing) {
      const rows = await db.update(dailyLogs).set(patch).where(eq(dailyLogs.date, date)).returning();
      return rows[0];
    }
    const rows = await db.insert(dailyLogs).values({ date, ...patch }).returning();
    return rows[0];
  }
  async getAllLogs() {
    return db.select().from(dailyLogs);
  }
  async deleteLog(date: string) {
    await db.delete(dailyLogs).where(eq(dailyLogs.date, date));
  }

  async getTasks() {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }
  async createTask(t: InsertTask) {
    const rows = await db.insert(tasks).values({ ...t, createdAt: new Date().toISOString() }).returning();
    return rows[0];
  }
  async updateTask(id: number, patch: Partial<Task>) {
    const rows = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
    return rows[0];
  }
  async deleteTask(id: number) {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getJournal(date: string) {
    const rows = await db.select().from(journal).where(eq(journal.date, date));
    return rows[0];
  }
  async upsertJournal(date: string, patch: Partial<InsertJournal>) {
    const existing = await this.getJournal(date);
    if (existing) {
      const rows = await db.update(journal).set(patch).where(eq(journal.date, date)).returning();
      return rows[0];
    }
    const rows = await db.insert(journal).values({ date, ...patch }).returning();
    return rows[0];
  }
  async getAllJournal() {
    return db.select().from(journal).orderBy(desc(journal.date));
  }

  async getGoals() {
    return db.select().from(goals).orderBy(desc(goals.createdAt));
  }
  async createGoal(g: InsertGoal) {
    const rows = await db.insert(goals).values({ ...g, createdAt: new Date().toISOString() }).returning();
    return rows[0];
  }
  async updateGoal(id: number, patch: Partial<Goal>) {
    const rows = await db.update(goals).set(patch).where(eq(goals.id, id)).returning();
    return rows[0];
  }
  async deleteGoal(id: number) {
    await db.delete(goals).where(eq(goals.id, id));
  }

  async getChallenges() {
    return db.select().from(challenges).orderBy(desc(challenges.startDate));
  }
  async getActiveChallenge(today: string) {
    // Active = today is between startDate and endDate inclusive.
    const rows = await db
      .select()
      .from(challenges)
      .where(sql`${challenges.startDate} <= ${today} AND ${challenges.endDate} >= ${today}`)
      .orderBy(desc(challenges.startDate));
    return rows[0];
  }
  async createChallenge(c: InsertChallenge) {
    const rows = await db.insert(challenges).values({ ...c, createdAt: new Date().toISOString() }).returning();
    return rows[0];
  }
  async deleteChallenge(id: number) {
    await db.delete(challenges).where(eq(challenges.id, id));
  }

  async resetAll() {
    await db.delete(dailyLogs);
    await db.delete(tasks);
    await db.delete(journal);
    await db.delete(goals);
    await db.delete(challenges);
  }
}

export const storage = new DatabaseStorage();
