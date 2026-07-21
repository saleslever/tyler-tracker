import { dailyLogs, tasks, journal, goals, challenges, rituals, quests, records, bossSeals } from "@shared/schema";
import type {
  DailyLog, InsertDailyLog, Task, InsertTask,
  Journal, InsertJournal, Goal, InsertGoal,
  Challenge, InsertChallenge,
  Ritual, InsertRitual,
  Quest, InsertQuest,
  Record_, InsertRecord,
  BossSeal, InsertBossSeal,
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
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS gratitude_1 TEXT;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS gratitude_3 TEXT;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS gratitude_possession TEXT;

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
      horizon TEXT NOT NULL DEFAULT 'twelve_month',
      target_date TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );
    ALTER TABLE goals ADD COLUMN IF NOT EXISTS horizon TEXT NOT NULL DEFAULT 'twelve_month';

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

    CREATE TABLE IF NOT EXISTS rituals (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quests (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT,
      motto TEXT,
      icon TEXT,
      tone TEXT NOT NULL DEFAULT 'iron',
      metric TEXT NOT NULL,
      goal INTEGER NOT NULL,
      xp_reward INTEGER NOT NULL DEFAULT 100,
      progress INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      claimed_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      unit TEXT,
      value INTEGER NOT NULL DEFAULT 0,
      set_on_date TEXT,
      seen_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boss_seals (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      sealed_at TEXT NOT NULL,
      xp_awarded INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed default rituals on first boot (only if the table is empty)
  const existing = await pool.query(`SELECT COUNT(*)::int AS n FROM rituals`);
  if (existing.rows[0].n === 0) {
    await pool.query(
      `INSERT INTO rituals (key, title, subtitle, items, updated_at) VALUES
        ('why', $1, $2, $3, $10),
        ('questions', $4, $5, $6, $10),
        ('code', $7, $8, $9, $10)`,
      [
        "My Why",
        "Health & weight loss reasons that don't move",
        JSON.stringify([
          "Become an example for my son to look up to and admire while having me around for 40 years (80 Years+)",
          "Being able to fit in my clothes without feeling my love handles and stomach",
          "Being able to look in the mirror and be proud of what I am looking at, not disgusted",
          "Not feeling insecure and confident when I am around people at events & family functions",
          "No more alcohol to save my liver, add years back to my life and stop borrowing from tomorrow's happiness",
        ]),
        "5 Major Questions to Start My Morning",
        "Answer these silently. Every day.",
        JSON.stringify([
          "What do I need to do every day to achieve my weight loss goals?",
          "What must be true of me to reach the success of a 1% man?",
          "How do I need to transform as a man to have a loving and long-term healthy relationship with Kalyn?",
          "What needs to happen to give my family freedom and create future experiences?",
          "How will I feel one year from now if I don't take any of these questions seriously?",
        ]),
        "My Code as a Man",
        "Read these out loud before your feet hit the floor.",
        JSON.stringify([
          "I believe with extreme conviction that I am THE MAN and can achieve absolutely anything I want to. This is my world, and other people just live in it.",
          "My word is made of IRON and cannot be broken. Everything I say must be done. Words will never be just words again.",
          "I am the kind of man who doesn't drink alcohol because it puts my future, relationships, health, and life completely at risk. Stop borrowing tomorrow's happiness.",
          "I am a man who doesn't get emotional or allow myself to come off-center. I am a rock in the ocean full of hurricanes and will never be moved.",
        ]),
        new Date().toISOString(),
      ],
    );
  }

  // Seed default quests on first boot (only if the table is empty).
  const q = await pool.query(`SELECT COUNT(*)::int AS n FROM quests`);
  if (q.rows[0].n === 0) {
    const now = new Date().toISOString();
    // 6 seeded quests — designed to always have something in progress.
    const seed = [
      { key: "iron_week",   title: "IRON WEEK",        subtitle: "Seven consecutive perfect days.",  motto: "Consistency is a weapon.", icon: "🛡", tone: "iron",  metric: "perfect_streak", goal: 7,   xp: 500 },
      { key: "the_forge",   title: "THE FORGE",         subtitle: "Four lifts inside seven days.",     motto: "Steel is not born; it is hammered.", icon: "🔨", tone: "forge",  metric: "workouts_week", goal: 4,   xp: 250 },
      { key: "clarity",     title: "CLARITY",           subtitle: "Thirty consecutive sober days.",     motto: "A clear mind is a sharp blade.", icon: "🌙", tone: "sober",  metric: "sober_streak",  goal: 30,  xp: 1000 },
      { key: "purity",      title: "PURITY",            subtitle: "Fourteen days without a cheat.",     motto: "Discipline is freedom.", icon: "🤍", tone: "gold",   metric: "no_cheat_streak", goal: 14,  xp: 400 },
      { key: "ledger_kept", title: "LEDGER KEPT",       subtitle: "Log every habit for ten days.",      motto: "What is measured is mastered.", icon: "📜", tone: "iron",   metric: "logged_days",    goal: 10,  xp: 200 },
      { key: "iron_word",   title: "IRON WORD",         subtitle: "Answer the morning gratitude ritual for seven days.", motto: "My word is iron.", icon: "⚜", tone: "gold", metric: "gratitude_streak", goal: 7, xp: 300 },
    ];
    for (const s of seed) {
      await pool.query(
        `INSERT INTO quests (key, title, subtitle, motto, icon, tone, metric, goal, xp_reward, progress, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10)`,
        [s.key, s.title, s.subtitle, s.motto, s.icon, s.tone, s.metric, s.goal, s.xp, now],
      );
    }
  }

  // Seed default records on first boot.
  const rec = await pool.query(`SELECT COUNT(*)::int AS n FROM records`);
  if (rec.rows[0].n === 0) {
    const now = new Date().toISOString();
    const seed = [
      { key: "best_perfect_streak", label: "Longest Perfect Streak", unit: "days" },
      { key: "best_week_perfect",   label: "Most Perfect Days in a Week", unit: "days" },
      { key: "longest_sober",       label: "Longest Sober Streak", unit: "days" },
      { key: "best_week_xp",        label: "Best Week (XP)", unit: "XP" },
      { key: "most_lifts_week",     label: "Most Workouts in a Week", unit: "lifts" },
      { key: "most_habits_day",     label: "Most Habits Hit in a Day", unit: "habits" },
    ];
    for (const s of seed) {
      await pool.query(
        `INSERT INTO records (key, label, unit, value, updated_at) VALUES ($1,$2,$3,0,$4)`,
        [s.key, s.label, s.unit, now],
      );
    }
  }
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
  // Rituals
  getRituals(): Promise<Ritual[]>;
  getRitual(key: string): Promise<Ritual | undefined>;
  upsertRitual(key: string, patch: Partial<InsertRitual>): Promise<Ritual>;
  // Quests
  getQuests(): Promise<Quest[]>;
  updateQuest(key: string, patch: Partial<Quest>): Promise<Quest | undefined>;
  // Records
  getRecords(): Promise<Record_[]>;
  updateRecord(key: string, patch: Partial<Record_>): Promise<Record_ | undefined>;
  // Boss seals
  getBossSeals(): Promise<BossSeal[]>;
  createBossSeal(seal: InsertBossSeal): Promise<BossSeal>;
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

  async getRituals() {
    return db.select().from(rituals).orderBy(rituals.id);
  }
  async getRitual(key: string) {
    const rows = await db.select().from(rituals).where(eq(rituals.key, key));
    return rows[0];
  }
  async upsertRitual(key: string, patch: Partial<InsertRitual>) {
    const existing = await this.getRitual(key);
    const now = new Date().toISOString();
    if (existing) {
      const rows = await db
        .update(rituals)
        .set({ ...patch, updatedAt: now })
        .where(eq(rituals.key, key))
        .returning();
      return rows[0];
    }
    const rows = await db
      .insert(rituals)
      .values({
        key,
        title: patch.title ?? key,
        subtitle: patch.subtitle ?? null,
        items: patch.items ?? "[]",
        updatedAt: now,
      })
      .returning();
    return rows[0];
  }

  async getQuests() {
    return db.select().from(quests).orderBy(quests.id);
  }
  async updateQuest(key: string, patch: Partial<Quest>) {
    const now = new Date().toISOString();
    const rows = await db
      .update(quests)
      .set({ ...patch, updatedAt: now })
      .where(eq(quests.key, key))
      .returning();
    return rows[0];
  }

  async getRecords() {
    return db.select().from(records).orderBy(records.id);
  }
  async updateRecord(key: string, patch: Partial<Record_>) {
    const now = new Date().toISOString();
    const rows = await db
      .update(records)
      .set({ ...patch, updatedAt: now })
      .where(eq(records.key, key))
      .returning();
    return rows[0];
  }

  async getBossSeals() {
    return db.select().from(bossSeals).orderBy(desc(bossSeals.date));
  }
  async createBossSeal(seal: InsertBossSeal) {
    // Upsert-ish: skip if already sealed for this date.
    const existing = await db.select().from(bossSeals).where(eq(bossSeals.date, seal.date));
    if (existing[0]) return existing[0];
    const rows = await db
      .insert(bossSeals)
      .values({ ...seal })
      .returning();
    return rows[0];
  }

  async resetAll() {
    await db.delete(dailyLogs);
    await db.delete(tasks);
    await db.delete(journal);
    await db.delete(goals);
    await db.delete(challenges);
    await db.delete(bossSeals);
    // Reset quest progress but keep the definitions
    await db.update(quests).set({ progress: 0, completedAt: null, claimedAt: null, updatedAt: new Date().toISOString() });
    // Reset record values but keep the definitions
    await db.update(records).set({ value: 0, setOnDate: null, seenAt: null, updatedAt: new Date().toISOString() });
    // Keep rituals — they're the user's identity, not their data
  }
}

export const storage = new DatabaseStorage();
