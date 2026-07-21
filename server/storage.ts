import { dailyLogs, tasks, journal, goals, challenges, rituals, quests, questCompletions, records, bossSeals, moodLogs } from "@shared/schema";
import type {
  DailyLog, InsertDailyLog, Task, InsertTask,
  Journal, InsertJournal, Goal, InsertGoal,
  Challenge, InsertChallenge,
  Ritual, InsertRitual,
  Quest, InsertQuest, QuestCompletion,
  Record_, InsertRecord,
  BossSeal, InsertBossSeal,
  MoodLog, InsertMoodLog,
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

/* ============ Smart quest generator config ============ */

type ScaleRule = { goalStep: (g: number) => number; xpMult: number };

const SCALING: Record<string, ScaleRule> = {
  perfect_streak:   { goalStep: (g) => g + 7,  xpMult: 1.25 },
  workouts_week:    { goalStep: (g) => Math.min(g + 1, 7), xpMult: 1.5 },
  sober_streak:     { goalStep: (g) => (g < 60 ? 60 : g < 90 ? 90 : g < 180 ? 180 : g < 365 ? 365 : g + 365), xpMult: 1.5 },
  no_cheat_streak:  { goalStep: (g) => g + 7,  xpMult: 1.4 },
  logged_days:      { goalStep: (g) => (g < 20 ? 20 : g < 30 ? 30 : g < 50 ? 50 : g < 90 ? 90 : g + 90), xpMult: 1.3 },
  gratitude_streak: { goalStep: (g) => g + 7,  xpMult: 1.4 },
};

/** Roman-numeral suffix for a quest title, e.g. "IRON WEEK" → "IRON WEEK II". */
function titleForTier(baseTitle: string, tier: number): string {
  // Strip any prior Roman-numeral suffix (" II", " III", ...)
  const stripped = baseTitle.replace(/\s+[IVX]+$/i, "").trim();
  const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const suffix = numerals[tier - 1] ?? String(tier);
  return `${stripped} ${suffix}`;
}

/** Rewrite the subtitle number to match the new goal. */
function subtitleForGoal(baseSubtitle: string, goal: number, family: string): string {
  if (!baseSubtitle) return baseSubtitle;
  const unitByFamily: Record<string, string> = {
    perfect_streak: "consecutive perfect days",
    workouts_week: "lifts inside seven days",
    sober_streak: "consecutive sober days",
    no_cheat_streak: "days without a cheat",
    logged_days: "days with every habit logged",
    gratitude_streak: "days of the morning gratitude ritual",
  };
  const unit = unitByFamily[family];
  if (!unit) {
    // Fallback — replace any number in the subtitle with the new goal.
    return baseSubtitle.replace(/\b\d+\b/, String(goal));
  }
  return `${goal} ${unit}.`;
}

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
      tier INTEGER NOT NULL DEFAULT 1,
      family TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      completed_at TEXT,
      claimed_at TEXT,
      updated_at TEXT NOT NULL
    );
    -- Additive migrations for old databases
    ALTER TABLE quests ADD COLUMN IF NOT EXISTS tier INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE quests ADD COLUMN IF NOT EXISTS family TEXT;
    ALTER TABLE quests ADD COLUMN IF NOT EXISTS active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS sleep_hours DOUBLE PRECISION;
    ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS resting_heart_rate INTEGER;

    CREATE TABLE IF NOT EXISTS mood_logs (
      id SERIAL PRIMARY KEY,
      value INTEGER NOT NULL,
      note TEXT,
      logged_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mood_logs_logged_at ON mood_logs(logged_at);

    CREATE TABLE IF NOT EXISTS quest_completions (
      id SERIAL PRIMARY KEY,
      quest_key TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      motto TEXT,
      icon TEXT,
      tone TEXT NOT NULL,
      tier INTEGER NOT NULL DEFAULT 1,
      goal INTEGER NOT NULL,
      xp_awarded INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL
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
      { key: "iron_week_1",   family: "perfect_streak",    tier: 1, title: "IRON WEEK",        subtitle: "Seven consecutive perfect days.",  motto: "Consistency is a weapon.", icon: "🛡", tone: "iron",  metric: "perfect_streak",   goal: 7,   xp: 500 },
      { key: "the_forge_1",   family: "workouts_week",     tier: 1, title: "THE FORGE",        subtitle: "Four lifts inside seven days.",     motto: "Steel is not born; it is hammered.", icon: "🔨", tone: "forge", metric: "workouts_week",    goal: 4,   xp: 250 },
      { key: "clarity_1",     family: "sober_streak",      tier: 1, title: "CLARITY",          subtitle: "Thirty consecutive sober days.",     motto: "A clear mind is a sharp blade.", icon: "🌙", tone: "sober", metric: "sober_streak",     goal: 30,  xp: 1000 },
      { key: "purity_1",      family: "no_cheat_streak",   tier: 1, title: "PURITY",           subtitle: "Fourteen days without a cheat.",     motto: "Discipline is freedom.", icon: "🤍", tone: "gold",  metric: "no_cheat_streak",  goal: 14,  xp: 400 },
      { key: "ledger_kept_1", family: "logged_days",       tier: 1, title: "LEDGER KEPT",      subtitle: "Log every habit for ten days.",      motto: "What is measured is mastered.", icon: "📜", tone: "iron",  metric: "logged_days",      goal: 10,  xp: 200 },
      { key: "iron_word_1",   family: "gratitude_streak",  tier: 1, title: "IRON WORD",        subtitle: "Answer the morning gratitude ritual for seven days.", motto: "My word is iron.", icon: "⚜", tone: "gold", metric: "gratitude_streak", goal: 7,   xp: 300 },
    ];
    for (const s of seed) {
      await pool.query(
        `INSERT INTO quests (key, title, subtitle, motto, icon, tone, metric, goal, xp_reward, progress, tier, family, active, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,1,$12)`,
        [s.key, s.title, s.subtitle, s.motto, s.icon, s.tone, s.metric, s.goal, s.xp, s.tier, s.family, now],
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
  claimQuest(key: string): Promise<{ claimed: Quest; nextQuest: Quest | null }>;
  getQuestCompletions(): Promise<QuestCompletion[]>;
  // Records
  getRecords(): Promise<Record_[]>;
  updateRecord(key: string, patch: Partial<Record_>): Promise<Record_ | undefined>;
  // Boss seals
  getBossSeals(): Promise<BossSeal[]>;
  createBossSeal(seal: InsertBossSeal): Promise<BossSeal>;
  // Mood logs
  getMoods(): Promise<MoodLog[]>;
  createMood(m: InsertMoodLog): Promise<MoodLog>;
  deleteMood(id: number): Promise<void>;
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
    return db.select().from(quests).where(eq(quests.active, 1)).orderBy(quests.id);
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

  async getQuestCompletions() {
    return db.select().from(questCompletions).orderBy(desc(questCompletions.id));
  }

  /**
   * Claim a quest — mark it done, archive it into questCompletions,
   * and spawn a new harder quest in the same family.
   *
   * Scaling rules per family:
   *   perfect_streak   : +7 goal, +1.25x XP  (7 → 14 → 21 → 30 → 45 → 60 …)
   *   workouts_week    : +1 goal, +1.5x XP    (4 → 5 → 6 → 7 lifts/wk)
   *   sober_streak     : +30 goal, +1.5x XP   (30 → 60 → 90 → 180 → 365)
   *   no_cheat_streak  : +7 goal, +1.4x XP    (14 → 21 → 30 → 45)
   *   logged_days      : +10 goal, +1.3x XP   (10 → 20 → 30 → 50 → 90)
   *   gratitude_streak : +7 goal, +1.4x XP    (7 → 14 → 21 → 30)
   */
  async claimQuest(key: string): Promise<{ claimed: Quest; nextQuest: Quest | null }> {
    const now = new Date().toISOString();
    const rows = await db.select().from(quests).where(eq(quests.key, key));
    const q = rows[0];
    if (!q) throw new Error(`Quest not found: ${key}`);

    // 1. Mark this quest as claimed + inactive
    const updated = await db
      .update(quests)
      .set({ claimedAt: now, active: 0, updatedAt: now })
      .where(eq(quests.key, key))
      .returning();

    // 2. Log the completion for the Trophy Hall
    await db.insert(questCompletions).values({
      questKey: q.key,
      title: q.title,
      subtitle: q.subtitle,
      motto: q.motto,
      icon: q.icon,
      tone: q.tone,
      tier: q.tier,
      goal: q.goal,
      xpAwarded: q.xpReward,
      completedAt: now,
    });

    // 3. Spawn the next tier in the same family (harder version)
    const nextTier = (q.tier ?? 1) + 1;
    const family = q.family ?? q.metric;
    const scale = SCALING[family] ?? { goalStep: (g: number) => g + 5, xpMult: 1.4 };
    const nextGoal = scale.goalStep(q.goal);
    const nextXP = Math.round(q.xpReward * scale.xpMult);
    const nextKey = `${family}_${nextTier}`;

    // Only spawn if the key doesn't already exist (idempotent).
    const existingRows = await db.select().from(quests).where(eq(quests.key, nextKey));
    let nextQuest: Quest | null = null;
    if (existingRows.length === 0) {
      const titleUp = titleForTier(q.title, nextTier);
      const subtitleUp = subtitleForGoal(q.subtitle ?? "", nextGoal, family);
      const inserted = await db
        .insert(quests)
        .values({
          key: nextKey,
          title: titleUp,
          subtitle: subtitleUp,
          motto: q.motto,
          icon: q.icon,
          tone: q.tone,
          metric: q.metric,
          goal: nextGoal,
          xpReward: nextXP,
          progress: 0,
          tier: nextTier,
          family,
          active: 1,
          updatedAt: now,
        })
        .returning();
      nextQuest = inserted[0];
    } else {
      // Re-activate the existing next-tier quest if it's dormant
      const existing = existingRows[0];
      if (existing.active === 0) {
        const rows2 = await db
          .update(quests)
          .set({ active: 1, progress: 0, claimedAt: null, completedAt: null, updatedAt: now })
          .where(eq(quests.key, nextKey))
          .returning();
        nextQuest = rows2[0];
      } else {
        nextQuest = existing;
      }
    }
    return { claimed: updated[0], nextQuest };
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

  // -------- Mood logs --------
  async getMoods() {
    return db.select().from(moodLogs).orderBy(desc(moodLogs.loggedAt));
  }
  async createMood(m: InsertMoodLog) {
    const rows = await db.insert(moodLogs).values({ ...m }).returning();
    return rows[0];
  }
  async deleteMood(id: number) {
    await db.delete(moodLogs).where(eq(moodLogs.id, id));
  }

  async resetAll() {
    const now = new Date().toISOString();
    await db.delete(dailyLogs);
    await db.delete(tasks);
    await db.delete(journal);
    await db.delete(goals);
    await db.delete(challenges);
    await db.delete(bossSeals);
    await db.delete(moodLogs);
    // Nuke quest history so the Trophy Hall is clean
    await db.delete(questCompletions);
    // Drop every quest, then reseed the tier-1 originals so the app never
    // shows a phantom tier-2 quest without its tier-1 completion.
    await db.delete(quests);
    const seed = [
      { key: "iron_week_1",   family: "perfect_streak",    title: "IRON WEEK",    subtitle: "Seven consecutive perfect days.",           motto: "Consistency is a weapon.", icon: "🛡", tone: "iron",  metric: "perfect_streak",   goal: 7,   xp: 500 },
      { key: "the_forge_1",   family: "workouts_week",     title: "THE FORGE",    subtitle: "Four lifts inside seven days.",             motto: "Steel is not born; it is hammered.", icon: "🔨", tone: "forge", metric: "workouts_week",    goal: 4,   xp: 250 },
      { key: "clarity_1",     family: "sober_streak",      title: "CLARITY",      subtitle: "Thirty consecutive sober days.",             motto: "A clear mind is a sharp blade.", icon: "🌙", tone: "sober", metric: "sober_streak",     goal: 30,  xp: 1000 },
      { key: "purity_1",      family: "no_cheat_streak",   title: "PURITY",       subtitle: "Fourteen days without a cheat.",             motto: "Discipline is freedom.", icon: "🤍", tone: "gold",  metric: "no_cheat_streak",  goal: 14,  xp: 400 },
      { key: "ledger_kept_1", family: "logged_days",       title: "LEDGER KEPT",  subtitle: "Log every habit for ten days.",              motto: "What is measured is mastered.", icon: "📜", tone: "iron",  metric: "logged_days",      goal: 10,  xp: 200 },
      { key: "iron_word_1",   family: "gratitude_streak",  title: "IRON WORD",    subtitle: "Answer the morning gratitude ritual for seven days.", motto: "My word is iron.", icon: "⚜", tone: "gold", metric: "gratitude_streak", goal: 7, xp: 300 },
    ];
    for (const s of seed) {
      await db.insert(quests).values({
        key: s.key, title: s.title, subtitle: s.subtitle, motto: s.motto, icon: s.icon, tone: s.tone,
        metric: s.metric, goal: s.goal, xpReward: s.xp, progress: 0, tier: 1, family: s.family, active: 1, updatedAt: now,
      });
    }
    // Reset record values but keep the definitions
    await db.update(records).set({ value: 0, setOnDate: null, seenAt: null, updatedAt: now });
    // Keep rituals — they're the user's identity, not their data
  }
}

export const storage = new DatabaseStorage();
