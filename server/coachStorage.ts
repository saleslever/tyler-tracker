/**
 * Coach storage — CRUD for fitness_coach_os tables.
 *
 * IMPORTANT: workoutLogs is IMMUTABLE. No updateWorkoutLog or deleteWorkoutLog
 * method is exported. Once a set is logged, it cannot be changed or deleted.
 * That is the whole point of the audit trail.
 *
 * All timestamps are ISO8601 strings so we don't require pg date coercion.
 */
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "./storage";
import {
  coachSettings, InsertCoachSettings, CoachSettings,
  coachMemory, InsertCoachMemory, CoachMemory,
  coachChecklist, InsertCoachChecklist, CoachChecklistItem,
  fitnessGoals, InsertFitnessGoal, FitnessGoal,
  bodyScans, InsertBodyScan, BodyScan,
  nutritionTargets, InsertNutritionTarget, NutritionTarget,
  macroLogs, InsertMacroLog, MacroLog,
  workoutPlans, InsertWorkoutPlan, WorkoutPlan,
  workoutLogs, InsertWorkoutLog, WorkoutLog,
  recoveryLogs, InsertRecoveryLog, RecoveryLog,
  uploadsPendingReview, InsertUpload, Upload,
  coachConversations, InsertCoachConvo, CoachConvo,
  DIRECT_BODY_PARTS,
} from "@shared/schema";

const now = () => new Date().toISOString();
const today = () => {
  // Return YYYY-MM-DD in America/Denver (user's timezone)
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const y = parts.find(p => p.type === "year")!.value;
  const m = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
};

// ─── Settings ────────────────────────────────────────────────
export async function getCoachSettings(): Promise<CoachSettings> {
  const rows = await db.select().from(coachSettings).limit(1);
  if (rows.length) return rows[0];
  // Should never happen (seeded) but fall back gracefully
  const [row] = await db.insert(coachSettings).values({
    weeklySetsPerBodyPart: 24,
    trainingDaysPerWeek: 4,
    archetype: "dangerous_ripped_basketball_player",
    weighInReminderTime: "10:00",
    macroReminderTime: "20:00",
    workoutReminderTime: "16:00",
    pushNotificationsEnabled: 1,
    inAppBadgesEnabled: 1,
    coachModel: "claude_sonnet_4_6",
    updatedAt: now(),
  } as any).returning();
  return row;
}
export async function updateCoachSettings(patch: Partial<InsertCoachSettings>): Promise<CoachSettings> {
  const current = await getCoachSettings();
  const [row] = await db.update(coachSettings)
    .set({ ...patch, updatedAt: now() } as any)
    .where(eq(coachSettings.id, current.id))
    .returning();
  return row;
}

// ─── Memory ──────────────────────────────────────────────────
export async function listCoachMemory(activeOnly = true): Promise<CoachMemory[]> {
  if (activeOnly) {
    return db.select().from(coachMemory).where(eq(coachMemory.active, 1)).orderBy(desc(coachMemory.id));
  }
  return db.select().from(coachMemory).orderBy(desc(coachMemory.id));
}
export async function addCoachMemory(fact: InsertCoachMemory): Promise<CoachMemory> {
  const [row] = await db.insert(coachMemory).values({ ...fact, createdAt: now() } as any).returning();
  return row;
}
export async function supersedeMemory(oldId: number, newFact: InsertCoachMemory): Promise<CoachMemory> {
  // Insert new fact first, then link old → new
  const [newRow] = await db.insert(coachMemory).values({ ...newFact, createdAt: now() } as any).returning();
  await db.update(coachMemory)
    .set({ supersededBy: newRow.id, active: 0 } as any)
    .where(eq(coachMemory.id, oldId));
  return newRow;
}
export async function deactivateMemory(id: number): Promise<void> {
  await db.update(coachMemory).set({ active: 0 } as any).where(eq(coachMemory.id, id));
}

// ─── Checklist ───────────────────────────────────────────────
export async function getChecklist(date: string): Promise<CoachChecklistItem[]> {
  return db.select().from(coachChecklist).where(eq(coachChecklist.date, date));
}
export async function addChecklistItem(item: InsertCoachChecklist): Promise<CoachChecklistItem> {
  const [row] = await db.insert(coachChecklist).values({ ...item, createdAt: now() } as any).returning();
  return row;
}
export async function markChecklistDone(id: number, relatedTable?: string, relatedRecordId?: number): Promise<void> {
  await db.update(coachChecklist).set({
    status: "done",
    completedAt: now(),
    ...(relatedTable ? { relatedTable, relatedRecordId } : {}),
  } as any).where(eq(coachChecklist.id, id));
}
export async function markChecklistMissed(id: number): Promise<void> {
  await db.update(coachChecklist).set({ status: "user_missed" } as any).where(eq(coachChecklist.id, id));
}

// ─── Goals ───────────────────────────────────────────────────
export async function getActiveGoal(): Promise<FitnessGoal | undefined> {
  const rows = await db.select().from(fitnessGoals).where(eq(fitnessGoals.isActive, 1)).limit(1);
  return rows[0];
}
export async function createGoal(g: InsertFitnessGoal): Promise<FitnessGoal> {
  // Deactivate previous active goal
  const prev = await getActiveGoal();
  if (prev) {
    await db.update(fitnessGoals).set({ isActive: 0 } as any).where(eq(fitnessGoals.id, prev.id));
  }
  const [row] = await db.insert(fitnessGoals).values({ ...g, isActive: 1, createdAt: now() } as any).returning();
  if (prev) {
    await db.update(fitnessGoals).set({ supersededBy: row.id } as any).where(eq(fitnessGoals.id, prev.id));
  }
  return row;
}
export async function listGoalHistory(): Promise<FitnessGoal[]> {
  return db.select().from(fitnessGoals).orderBy(desc(fitnessGoals.createdAt));
}

// ─── Body scans ──────────────────────────────────────────────
export async function createBodyScan(scan: InsertBodyScan): Promise<BodyScan> {
  const [row] = await db.insert(bodyScans).values({ ...scan, createdAt: now() } as any).returning();
  return row;
}
export async function listBodyScans(limit = 50): Promise<BodyScan[]> {
  return db.select().from(bodyScans).orderBy(desc(bodyScans.date)).limit(limit);
}
export async function latestBodyScan(): Promise<BodyScan | undefined> {
  const rows = await db.select().from(bodyScans).orderBy(desc(bodyScans.date)).limit(1);
  return rows[0];
}
export async function deleteBodyScan(id: number): Promise<void> {
  await db.delete(bodyScans).where(eq(bodyScans.id, id));
}

// ─── Nutrition targets ───────────────────────────────────────
export async function currentNutritionTarget(): Promise<NutritionTarget | undefined> {
  const rows = await db.select().from(nutritionTargets)
    .orderBy(desc(nutritionTargets.effectiveDate))
    .limit(1);
  return rows[0];
}
export async function createNutritionTarget(t: InsertNutritionTarget): Promise<NutritionTarget> {
  const [row] = await db.insert(nutritionTargets).values({ ...t, createdAt: now() } as any).returning();
  return row;
}

// ─── Macro logs ──────────────────────────────────────────────
export async function upsertMacroLog(log: InsertMacroLog): Promise<MacroLog> {
  const existing = await db.select().from(macroLogs).where(eq(macroLogs.date, log.date)).limit(1);
  if (existing.length) {
    const [row] = await db.update(macroLogs)
      .set({ ...log, createdAt: existing[0].createdAt } as any)
      .where(eq(macroLogs.id, existing[0].id))
      .returning();
    return row;
  }
  const [row] = await db.insert(macroLogs).values({ ...log, createdAt: now() } as any).returning();
  return row;
}
export async function getMacroLog(date: string): Promise<MacroLog | undefined> {
  const rows = await db.select().from(macroLogs).where(eq(macroLogs.date, date)).limit(1);
  return rows[0];
}
export async function listMacroLogsRange(start: string, end: string): Promise<MacroLog[]> {
  return db.select().from(macroLogs)
    .where(and(gte(macroLogs.date, start), lte(macroLogs.date, end)))
    .orderBy(desc(macroLogs.date));
}
export async function deleteMacroLog(id: number): Promise<void> {
  await db.delete(macroLogs).where(eq(macroLogs.id, id));
}

// ─── Workout plans ───────────────────────────────────────────
export async function upsertWorkoutPlan(plan: InsertWorkoutPlan): Promise<WorkoutPlan> {
  const existing = await db.select().from(workoutPlans).where(eq(workoutPlans.date, plan.date)).limit(1);
  if (existing.length) {
    const [row] = await db.update(workoutPlans)
      .set({ ...plan, createdAt: existing[0].createdAt } as any)
      .where(eq(workoutPlans.id, existing[0].id))
      .returning();
    return row;
  }
  const [row] = await db.insert(workoutPlans).values({ ...plan, createdAt: now() } as any).returning();
  return row;
}
export async function getWorkoutPlan(date: string): Promise<WorkoutPlan | undefined> {
  const rows = await db.select().from(workoutPlans).where(eq(workoutPlans.date, date)).limit(1);
  return rows[0];
}

// ─── Workout logs (IMMUTABLE — INSERT ONLY) ──────────────────
export async function logWorkoutSet(set: InsertWorkoutLog): Promise<WorkoutLog> {
  // Validate target body part is one of the direct-credit list
  if (!DIRECT_BODY_PARTS.includes(set.targetBodyPart as any)) {
    throw new Error(`Invalid targetBodyPart: ${set.targetBodyPart}. Must be one of: ${DIRECT_BODY_PARTS.join(", ")}`);
  }
  const [row] = await db.insert(workoutLogs).values({ ...set, loggedAt: now() } as any).returning();
  return row;
}
export async function logWorkoutSets(sets: InsertWorkoutLog[]): Promise<WorkoutLog[]> {
  const invalid = sets.filter(s => !DIRECT_BODY_PARTS.includes(s.targetBodyPart as any));
  if (invalid.length) {
    throw new Error(`Invalid targetBodyPart(s): ${invalid.map(s => s.targetBodyPart).join(", ")}`);
  }
  const rows = await db.insert(workoutLogs)
    .values(sets.map(s => ({ ...s, loggedAt: now() })) as any)
    .returning();
  return rows;
}
export async function listWorkoutLogsRange(start: string, end: string): Promise<WorkoutLog[]> {
  return db.select().from(workoutLogs)
    .where(and(gte(workoutLogs.date, start), lte(workoutLogs.date, end)))
    .orderBy(desc(workoutLogs.date));
}
export async function getWorkoutLogsForDate(date: string): Promise<WorkoutLog[]> {
  return db.select().from(workoutLogs).where(eq(workoutLogs.date, date));
}

/**
 * Compute the 7-day sets-per-body-part ledger up to and including endDate.
 * Returns { chest: 8, back: 12, ... } counting only direct-credit sets.
 */
export async function computeWeeklyLedger(endDate: string): Promise<Record<string, number>> {
  // Monday-anchored week (Mon = fresh start per user rule)
  const end = new Date(endDate + "T23:59:59");
  const dow = end.getDay(); // Sun=0, Mon=1..Sat=6
  const offsetToMonday = dow === 0 ? 6 : dow - 1;
  const start = new Date(end);
  start.setDate(end.getDate() - offsetToMonday);
  const startStr = start.toISOString().slice(0, 10);

  const rows = await listWorkoutLogsRange(startStr, endDate);
  const ledger: Record<string, number> = {};
  for (const part of DIRECT_BODY_PARTS) ledger[part] = 0;
  for (const r of rows) {
    if (ledger[r.targetBodyPart] !== undefined) ledger[r.targetBodyPart] += 1;
  }
  return ledger;
}

// ─── Recovery logs ───────────────────────────────────────────
export async function upsertRecoveryLog(log: InsertRecoveryLog): Promise<RecoveryLog> {
  const existing = await db.select().from(recoveryLogs).where(eq(recoveryLogs.date, log.date)).limit(1);
  if (existing.length) {
    const [row] = await db.update(recoveryLogs)
      .set({ ...log, createdAt: existing[0].createdAt } as any)
      .where(eq(recoveryLogs.id, existing[0].id))
      .returning();
    return row;
  }
  const [row] = await db.insert(recoveryLogs).values({ ...log, createdAt: now() } as any).returning();
  return row;
}
export async function getRecoveryLog(date: string): Promise<RecoveryLog | undefined> {
  const rows = await db.select().from(recoveryLogs).where(eq(recoveryLogs.date, date)).limit(1);
  return rows[0];
}
export async function latestRecoveryLog(): Promise<RecoveryLog | undefined> {
  const rows = await db.select().from(recoveryLogs).orderBy(desc(recoveryLogs.date)).limit(1);
  return rows[0];
}
export async function deleteRecoveryLog(id: number): Promise<void> {
  await db.delete(recoveryLogs).where(eq(recoveryLogs.id, id));
}

// ─── Uploads ─────────────────────────────────────────────────
export async function createUpload(u: InsertUpload): Promise<Upload> {
  const [row] = await db.insert(uploadsPendingReview).values({ ...u, createdAt: now() } as any).returning();
  return row;
}
export async function listPendingUploads(): Promise<Upload[]> {
  return db.select().from(uploadsPendingReview)
    .where(eq(uploadsPendingReview.status, "pending"))
    .orderBy(desc(uploadsPendingReview.createdAt));
}
export async function confirmUpload(id: number, relatedTable: string, relatedRecordId: number): Promise<void> {
  await db.update(uploadsPendingReview).set({
    status: "confirmed",
    confirmedRecordTable: relatedTable,
    confirmedRecordId: relatedRecordId,
  } as any).where(eq(uploadsPendingReview.id, id));
}
export async function discardUpload(id: number): Promise<void> {
  await db.update(uploadsPendingReview).set({ status: "discarded" } as any)
    .where(eq(uploadsPendingReview.id, id));
}

// ─── Conversations ───────────────────────────────────────────
export async function logConversation(c: InsertCoachConvo): Promise<CoachConvo> {
  const [row] = await db.insert(coachConversations).values({ ...c, createdAt: now() } as any).returning();
  return row;
}
export async function recentConversation(limit = 20): Promise<CoachConvo[]> {
  const rows = await db.select().from(coachConversations)
    .orderBy(desc(coachConversations.id))
    .limit(limit);
  return rows.reverse();  // chronological ascending
}

/**
 * Build the coach context snapshot — everything the coach needs to know
 * BEFORE responding to a user message. This is what makes the coach
 * remember: we hydrate context from the DB on every turn, not from chat.
 */
export interface CoachContext {
  today: string;
  settings: CoachSettings;
  goal: FitnessGoal | undefined;
  target: NutritionTarget | undefined;
  latestScan: BodyScan | undefined;
  latestRecovery: RecoveryLog | undefined;
  todayMacros: MacroLog | undefined;
  todayPlan: WorkoutPlan | undefined;
  weeklyLedger: Record<string, number>;
  memory: CoachMemory[];
  todayChecklist: CoachChecklistItem[];
  recentTurns: CoachConvo[];
}

export async function buildCoachContext(): Promise<CoachContext> {
  const t = today();
  const [settings, goal, target, latestScan, latestRecovery, todayMacros, todayPlan, weeklyLedger, memory, todayChecklist, recentTurns] = await Promise.all([
    getCoachSettings(),
    getActiveGoal(),
    currentNutritionTarget(),
    latestBodyScan(),
    latestRecoveryLog(),
    getMacroLog(t),
    getWorkoutPlan(t),
    computeWeeklyLedger(t),
    listCoachMemory(true),
    getChecklist(t),
    recentConversation(10),
  ]);
  return { today: t, settings, goal, target, latestScan, latestRecovery, todayMacros, todayPlan, weeklyLedger, memory, todayChecklist, recentTurns };
}
