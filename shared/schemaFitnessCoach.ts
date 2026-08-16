/**
 * Fitness Coach OS — Data Center schema.
 *
 * Additive. Does NOT modify existing tables. Preserves all history in
 * daily_logs, tasks, journal, records, mood_logs, fasts, habits_def,
 * habit_values, and rituals.
 *
 * Legacy gamification tables (quests, quest_completions, challenges,
 * boss_seals) remain untouched here — they are removed in M4 only after
 * explicit user approval.
 *
 * See docs/HANDOFF.md for the full requirements.
 */
import { pgTable, serial, text, integer, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// User settings — configurable coach dials (weekly set target, etc.)
// One row, id=1, upserted.
// ─────────────────────────────────────────────────────────────
export const coachSettings = pgTable("coach_settings", {
  id: serial("id").primaryKey(),
  weeklySetsPerBodyPart: integer("weekly_sets_per_body_part").notNull().default(24),
  trainingDaysPerWeek: integer("training_days_per_week").notNull().default(4),
  archetype: text("archetype").notNull().default("dangerous_ripped_basketball_player"),
  weighInReminderTime: text("weigh_in_reminder_time").notNull().default("10:00"),  // HH:MM local
  macroReminderTime: text("macro_reminder_time").notNull().default("20:00"),
  workoutReminderTime: text("workout_reminder_time").notNull().default("16:00"),
  pushNotificationsEnabled: integer("push_notifications_enabled").notNull().default(1),
  inAppBadgesEnabled: integer("in_app_badges_enabled").notNull().default(1),
  coachModel: text("coach_model").notNull().default("claude_sonnet_4_6"),
  updatedAt: text("updated_at").notNull(),
});
export const insertCoachSettingsSchema = createInsertSchema(coachSettings).omit({ id: true, updatedAt: true });
export type InsertCoachSettings = z.infer<typeof insertCoachSettingsSchema>;
export type CoachSettings = typeof coachSettings.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Coach memory — distilled durable facts the coach must remember
// forever across sessions. NOT chat history — facts.
// ─────────────────────────────────────────────────────────────
export const coachMemory = pgTable("coach_memory", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),                               // preference | injury | substitution | schedule | history | rule
  fact: text("fact").notNull(),                               // e.g. 'Prefers Smith machine shoulder press over DB'
  source: text("source"),                                     // conversation date, upload id, or 'user'
  confidence: text("confidence").notNull().default("high"),   // high | medium | low
  supersededBy: integer("superseded_by"),                     // if a newer fact replaces this
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull(),
});
export const insertCoachMemorySchema = createInsertSchema(coachMemory).omit({
  id: true, createdAt: true, supersededBy: true, active: true,
});
export type InsertCoachMemory = z.infer<typeof insertCoachMemorySchema>;
export type CoachMemory = typeof coachMemory.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Coach checklist — the coach's daily to-do list ABOUT the user.
// This is what makes accountability real: the coach has a job
// every day and the app tracks whether the coach did it.
// ─────────────────────────────────────────────────────────────
export const coachChecklist = pgTable("coach_checklist", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                              // YYYY-MM-DD
  task: text("task").notNull(),                               // e.g. 'Ask Tyler for weigh-in'
  dueTime: text("due_time"),                                  // HH:MM
  status: text("status").notNull().default("pending"),        // pending | done | user_missed | coach_skipped
  completedAt: text("completed_at"),
  relatedTable: text("related_table"),                        // e.g. 'body_scans' | 'macro_logs' | 'workout_logs'
  relatedRecordId: integer("related_record_id"),
  createdAt: text("created_at").notNull(),
});
export const insertCoachChecklistSchema = createInsertSchema(coachChecklist).omit({
  id: true, createdAt: true, status: true, completedAt: true, relatedTable: true, relatedRecordId: true,
});
export type InsertCoachChecklist = z.infer<typeof insertCoachChecklistSchema>;
export type CoachChecklistItem = typeof coachChecklist.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Fitness goals — active goal is where isActive=1
// ─────────────────────────────────────────────────────────────
export const fitnessGoals = pgTable("fitness_goals", {
  id: serial("id").primaryKey(),
  targetWeight: doublePrecision("target_weight"),            // lbs
  targetBodyFatPct: doublePrecision("target_body_fat_pct"),  // e.g. 15.0
  targetDate: text("target_date"),                            // YYYY-MM-DD
  notes: text("notes"),
  isActive: integer("is_active").notNull().default(1),        // one active at a time
  supersededBy: integer("superseded_by"),                     // id of the goal that replaced this
  createdAt: text("created_at").notNull(),
});
export const insertFitnessGoalSchema = createInsertSchema(fitnessGoals).omit({
  id: true, createdAt: true, supersededBy: true,
});
export type InsertFitnessGoal = z.infer<typeof insertFitnessGoalSchema>;
export type FitnessGoal = typeof fitnessGoals.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Body scans — Renpho/InBody/DEXA/pinch etc.
// ─────────────────────────────────────────────────────────────
export const bodyScans = pgTable("body_scans", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                              // YYYY-MM-DD
  weight: doublePrecision("weight"),                          // lbs
  bodyFatPct: doublePrecision("body_fat_pct"),
  leanMassLbs: doublePrecision("lean_mass_lbs"),
  fatMassLbs: doublePrecision("fat_mass_lbs"),
  visceralFat: doublePrecision("visceral_fat"),
  source: text("source"),                                     // renpho | inbody | dexa | pinch | wyze | other
  imageUrl: text("image_url"),                                // uploaded screenshot path
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertBodyScanSchema = createInsertSchema(bodyScans).omit({ id: true, createdAt: true });
export type InsertBodyScan = z.infer<typeof insertBodyScanSchema>;
export type BodyScan = typeof bodyScans.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Nutrition targets — history preserved. Latest by effectiveDate wins.
// Calorie value can be missing until recovered from scan.
// ─────────────────────────────────────────────────────────────
export const nutritionTargets = pgTable("nutrition_targets", {
  id: serial("id").primaryKey(),
  effectiveDate: text("effective_date").notNull(),           // YYYY-MM-DD
  calories: integer("calories"),                              // NULL = not yet recovered
  proteinGramsMin: integer("protein_grams_min"),              // e.g. 180
  proteinGramsMax: integer("protein_grams_max"),              // e.g. 220
  fastingHoursMin: doublePrecision("fasting_hours_min"),      // 16
  fastingHoursMax: doublePrecision("fasting_hours_max"),      // 18
  source: text("source"),                                     // scan | manual | recovered
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertNutritionTargetSchema = createInsertSchema(nutritionTargets).omit({ id: true, createdAt: true });
export type InsertNutritionTarget = z.infer<typeof insertNutritionTargetSchema>;
export type NutritionTarget = typeof nutritionTargets.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Macro logs — daily food totals from MacroFactor or manual
// ─────────────────────────────────────────────────────────────
export const macroLogs = pgTable("macro_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                              // YYYY-MM-DD
  calories: integer("calories"),
  proteinG: doublePrecision("protein_g"),
  carbsG: doublePrecision("carbs_g"),
  fatG: doublePrecision("fat_g"),
  fiberG: doublePrecision("fiber_g"),
  source: text("source"),                                     // macrofactor | manual | apple_health
  verifiedByUser: integer("verified_by_user").notNull().default(0),
  imageUrl: text("image_url"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertMacroLogSchema = createInsertSchema(macroLogs).omit({ id: true, createdAt: true });
export type InsertMacroLog = z.infer<typeof insertMacroLogSchema>;
export type MacroLog = typeof macroLogs.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Workout plans — what the coach prescribed
// exercises is a JSON array of { name, targetBodyPart, sets, repsMin, repsMax, notes }
// ─────────────────────────────────────────────────────────────
export const workoutPlans = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),                     // one plan per day
  dayType: text("day_type").notNull(),                        // strength | basketball | cardio | rest
  exercises: jsonb("exercises").notNull(),                    // Exercise[]
  targetSetsByBodyPart: jsonb("target_sets_by_body_part"),    // { chest: 6, back: 6, ... }
  notes: text("notes"),
  generatedBy: text("generated_by").notNull().default("coach"), // coach | user | manual
  createdAt: text("created_at").notNull(),
});
export const insertWorkoutPlanSchema = createInsertSchema(workoutPlans).omit({ id: true, createdAt: true });
export type InsertWorkoutPlan = z.infer<typeof insertWorkoutPlanSchema>;
export type WorkoutPlan = typeof workoutPlans.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Workout LOGS — IMMUTABLE. INSERT only. Never UPDATE. Never DELETE.
// One row per actual set performed. Direct-target-only credit.
// ─────────────────────────────────────────────────────────────
export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                              // YYYY-MM-DD
  exercise: text("exercise").notNull(),
  targetBodyPart: text("target_body_part").notNull(),         // chest | back | front_delts | ... | none
  setNumber: integer("set_number").notNull(),                 // 1, 2, 3, ...
  reps: integer("reps"),
  loadLbs: doublePrecision("load_lbs"),
  rpe: doublePrecision("rpe"),
  isSubstitution: integer("is_substitution").notNull().default(0),
  substitutedFor: text("substituted_for"),                    // original exercise name
  notes: text("notes"),
  loggedAt: text("logged_at").notNull(),                      // ISO timestamp — never changes
});
export const insertWorkoutLogSchema = createInsertSchema(workoutLogs).omit({ id: true, loggedAt: true });
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type WorkoutLog = typeof workoutLogs.$inferSelect;

// Enforce direct-set target body parts on the app side (in addition to any DB check)
export const DIRECT_BODY_PARTS = [
  "chest", "back",
  "front_delts", "side_delts", "rear_delts",
  "biceps", "triceps",
  "quads", "hamstrings", "glutes",
  "calves", "core",
  "cardio", "basketball", "none",
] as const;
export type DirectBodyPart = typeof DIRECT_BODY_PARTS[number];

// ─────────────────────────────────────────────────────────────
// Recovery logs — sleep, HRV, RHR, soreness (Whoop or manual)
// ─────────────────────────────────────────────────────────────
export const recoveryLogs = pgTable("recovery_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(),
  sleepHours: doublePrecision("sleep_hours"),
  whoopRecoveryPct: integer("whoop_recovery_pct"),            // 0-100
  hrvMs: doublePrecision("hrv_ms"),
  restingHrBpm: integer("resting_hr_bpm"),
  sorenessSummary: text("soreness_summary"),
  source: text("source"),                                     // whoop | manual | apple_health
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertRecoveryLogSchema = createInsertSchema(recoveryLogs).omit({ id: true, createdAt: true });
export type InsertRecoveryLog = z.infer<typeof insertRecoveryLogSchema>;
export type RecoveryLog = typeof recoveryLogs.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Uploads pending review — screenshots that need user confirmation
// ─────────────────────────────────────────────────────────────
export const uploadsPendingReview = pgTable("uploads_pending_review", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  kind: text("kind").notNull(),                               // scan | macros | whoop | workout | weight
  aiExtracted: jsonb("ai_extracted"),                         // AI's best-guess structured data
  status: text("status").notNull().default("pending"),        // pending | confirmed | discarded
  confirmedRecordId: integer("confirmed_record_id"),          // fk into the target table once saved
  confirmedRecordTable: text("confirmed_record_table"),       // e.g. 'body_scans'
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});
export const insertUploadSchema = createInsertSchema(uploadsPendingReview).omit({
  id: true, createdAt: true, status: true, confirmedRecordId: true, confirmedRecordTable: true,
});
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type Upload = typeof uploadsPendingReview.$inferSelect;

// ─────────────────────────────────────────────────────────────
// Coach conversations — full audit trail
// ─────────────────────────────────────────────────────────────
export const coachConversations = pgTable("coach_conversations", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),                              // YYYY-MM-DD
  role: text("role").notNull(),                               // user | coach | system
  content: text("content").notNull(),
  contextSnapshot: jsonb("context_snapshot"),                 // ledger + targets + recent workouts at the moment of response
  decisions: jsonb("decisions"),                              // structured plan changes if any
  imageUrls: jsonb("image_urls"),                             // array of image data URLs or paths (for user turns with attached photos)
  model: text("model"),                                       // e.g. 'claude_sonnet_4_6'
  createdAt: text("created_at").notNull(),
});
export const insertCoachConvoSchema = createInsertSchema(coachConversations).omit({ id: true, createdAt: true });
export type InsertCoachConvo = z.infer<typeof insertCoachConvoSchema>;
export type CoachConvo = typeof coachConversations.$inferSelect;
