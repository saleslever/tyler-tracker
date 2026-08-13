-- ═══════════════════════════════════════════════════════════════
-- Fitness Coach OS — M1 Data Center
-- Safe migration: CREATE TABLE IF NOT EXISTS for all 13 new tables.
-- Zero touches to existing tables (daily_logs, tasks, journal, etc.).
-- Reversible via DROP TABLE statements at the bottom (commented out).
--
-- All tables run inside one transaction. If any step fails, the whole
-- migration rolls back and production is untouched.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. coach_settings — configurable coach dials. Single row.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "coach_settings" (
  "id" SERIAL PRIMARY KEY,
  "weekly_sets_per_body_part" INTEGER NOT NULL DEFAULT 24,
  "training_days_per_week" INTEGER NOT NULL DEFAULT 4,
  "archetype" TEXT NOT NULL DEFAULT 'dangerous_ripped_basketball_player',
  "weigh_in_reminder_time" TEXT NOT NULL DEFAULT '10:00',
  "macro_reminder_time" TEXT NOT NULL DEFAULT '20:00',
  "workout_reminder_time" TEXT NOT NULL DEFAULT '16:00',
  "push_notifications_enabled" INTEGER NOT NULL DEFAULT 1,
  "in_app_badges_enabled" INTEGER NOT NULL DEFAULT 1,
  "coach_model" TEXT NOT NULL DEFAULT 'claude_sonnet_4_6',
  "updated_at" TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 2. coach_memory — durable facts the coach must never forget
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "coach_memory" (
  "id" SERIAL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "fact" TEXT NOT NULL,
  "source" TEXT,
  "confidence" TEXT NOT NULL DEFAULT 'high',
  "superseded_by" INTEGER,
  "active" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_coach_memory_active" ON "coach_memory" ("active", "kind");

-- ─────────────────────────────────────────────────────────────
-- 3. coach_checklist — coach's daily to-do list about the user
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "coach_checklist" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "task" TEXT NOT NULL,
  "due_time" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "completed_at" TEXT,
  "related_table" TEXT,
  "related_record_id" INTEGER,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_coach_checklist_date" ON "coach_checklist" ("date", "status");

-- ─────────────────────────────────────────────────────────────
-- 4. fitness_goals — body-comp targets. Active = isActive=1.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "fitness_goals" (
  "id" SERIAL PRIMARY KEY,
  "target_weight" DOUBLE PRECISION,
  "target_body_fat_pct" DOUBLE PRECISION,
  "target_date" TEXT,
  "notes" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "superseded_by" INTEGER,
  "created_at" TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 5. body_scans — Renpho / InBody / DEXA / Wyze
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "body_scans" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "weight" DOUBLE PRECISION,
  "body_fat_pct" DOUBLE PRECISION,
  "lean_mass_lbs" DOUBLE PRECISION,
  "fat_mass_lbs" DOUBLE PRECISION,
  "visceral_fat" DOUBLE PRECISION,
  "source" TEXT,
  "image_url" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_body_scans_date" ON "body_scans" ("date" DESC);

-- ─────────────────────────────────────────────────────────────
-- 6. nutrition_targets — history preserved by effective_date
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "nutrition_targets" (
  "id" SERIAL PRIMARY KEY,
  "effective_date" TEXT NOT NULL,
  "calories" INTEGER,
  "protein_grams_min" INTEGER,
  "protein_grams_max" INTEGER,
  "fasting_hours_min" DOUBLE PRECISION,
  "fasting_hours_max" DOUBLE PRECISION,
  "source" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_nutrition_targets_date" ON "nutrition_targets" ("effective_date" DESC);

-- ─────────────────────────────────────────────────────────────
-- 7. macro_logs — daily food totals
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "macro_logs" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "calories" INTEGER,
  "protein_g" DOUBLE PRECISION,
  "carbs_g" DOUBLE PRECISION,
  "fat_g" DOUBLE PRECISION,
  "fiber_g" DOUBLE PRECISION,
  "source" TEXT,
  "verified_by_user" INTEGER NOT NULL DEFAULT 0,
  "image_url" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_macro_logs_date" ON "macro_logs" ("date" DESC);

-- ─────────────────────────────────────────────────────────────
-- 8. workout_plans — coach's prescription. Unique per date.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workout_plans" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL UNIQUE,
  "day_type" TEXT NOT NULL,
  "exercises" JSONB NOT NULL,
  "target_sets_by_body_part" JSONB,
  "notes" TEXT,
  "generated_by" TEXT NOT NULL DEFAULT 'coach',
  "created_at" TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 9. workout_logs — IMMUTABLE. INSERT-only.
--    Enforced at the app layer (no UPDATE method in storage.ts).
--    One row per actual set. Direct-target-only credit.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "workout_logs" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "exercise" TEXT NOT NULL,
  "target_body_part" TEXT NOT NULL,
  "set_number" INTEGER NOT NULL,
  "reps" INTEGER,
  "load_lbs" DOUBLE PRECISION,
  "rpe" DOUBLE PRECISION,
  "is_substitution" INTEGER NOT NULL DEFAULT 0,
  "substituted_for" TEXT,
  "notes" TEXT,
  "logged_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_workout_logs_date_bodypart" ON "workout_logs" ("date" DESC, "target_body_part");

-- ─────────────────────────────────────────────────────────────
-- 10. recovery_logs — Whoop + manual. Unique per date.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "recovery_logs" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL UNIQUE,
  "sleep_hours" DOUBLE PRECISION,
  "whoop_recovery_pct" INTEGER,
  "hrv_ms" DOUBLE PRECISION,
  "resting_hr_bpm" INTEGER,
  "soreness_summary" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- 11. uploads_pending_review — screenshots awaiting confirmation
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "uploads_pending_review" (
  "id" SERIAL PRIMARY KEY,
  "image_url" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "ai_extracted" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "confirmed_record_id" INTEGER,
  "confirmed_record_table" TEXT,
  "notes" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_uploads_status" ON "uploads_pending_review" ("status", "created_at" DESC);

-- ─────────────────────────────────────────────────────────────
-- 12. coach_conversations — full chat audit trail
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "coach_conversations" (
  "id" SERIAL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "context_snapshot" JSONB,
  "decisions" JSONB,
  "model" TEXT,
  "created_at" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_coach_conversations_date" ON "coach_conversations" ("date" DESC);

-- ─────────────────────────────────────────────────────────────
-- Verification: all 12 new tables must exist.
-- (coach_settings, coach_memory, coach_checklist, fitness_goals,
--  body_scans, nutrition_targets, macro_logs, workout_plans,
--  workout_logs, recovery_logs, uploads_pending_review,
--  coach_conversations)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  expected TEXT[] := ARRAY[
    'coach_settings', 'coach_memory', 'coach_checklist',
    'fitness_goals', 'body_scans', 'nutrition_targets',
    'macro_logs', 'workout_plans', 'workout_logs',
    'recovery_logs', 'uploads_pending_review', 'coach_conversations'
  ];
  missing TEXT[] := ARRAY[]::TEXT[];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Missing tables after migration: %', missing;
  END IF;
  RAISE NOTICE 'All 12 fitness coach tables verified present.';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- ROLLBACK (do not uncomment unless you want to undo this migration)
-- ─────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS "coach_conversations" CASCADE;
-- DROP TABLE IF EXISTS "uploads_pending_review" CASCADE;
-- DROP TABLE IF EXISTS "recovery_logs" CASCADE;
-- DROP TABLE IF EXISTS "workout_logs" CASCADE;
-- DROP TABLE IF EXISTS "workout_plans" CASCADE;
-- DROP TABLE IF EXISTS "macro_logs" CASCADE;
-- DROP TABLE IF EXISTS "nutrition_targets" CASCADE;
-- DROP TABLE IF EXISTS "body_scans" CASCADE;
-- DROP TABLE IF EXISTS "fitness_goals" CASCADE;
-- DROP TABLE IF EXISTS "coach_checklist" CASCADE;
-- DROP TABLE IF EXISTS "coach_memory" CASCADE;
-- DROP TABLE IF EXISTS "coach_settings" CASCADE;
-- COMMIT;
