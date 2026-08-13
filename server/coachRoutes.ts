/**
 * Coach REST routes — M3.
 *
 * All routes namespaced under /api/coach or /api/fitness.
 */
import type { Express } from "express";
import { z } from "zod";
import {
  buildCoachContext,
  getCoachSettings, updateCoachSettings,
  listCoachMemory, addCoachMemory, supersedeMemory, deactivateMemory,
  getChecklist, addChecklistItem, markChecklistDone, markChecklistMissed,
  getActiveGoal, createGoal, listGoalHistory,
  createBodyScan, listBodyScans, latestBodyScan,
  currentNutritionTarget, createNutritionTarget,
  upsertMacroLog, getMacroLog, listMacroLogsRange,
  upsertWorkoutPlan, getWorkoutPlan,
  logWorkoutSet, logWorkoutSets, listWorkoutLogsRange, getWorkoutLogsForDate, computeWeeklyLedger,
  upsertRecoveryLog, getRecoveryLog, latestRecoveryLog,
  createUpload, listPendingUploads, confirmUpload, discardUpload,
  recentConversation,
} from "./coachStorage";
import { askCoach, generateWorkout, extractFromImage } from "./coachEngine";
import {
  insertCoachSettingsSchema, insertCoachMemorySchema, insertCoachChecklistSchema,
  insertFitnessGoalSchema, insertBodyScanSchema, insertNutritionTargetSchema,
  insertMacroLogSchema, insertWorkoutPlanSchema, insertWorkoutLogSchema,
  insertRecoveryLogSchema, insertUploadSchema,
} from "@shared/schema";

function err(res: any, e: unknown, status = 400) {
  res.status(status).json({ error: e instanceof Error ? e.message : String(e) });
}

export function registerCoachRoutes(app: Express) {

  // ─── Context snapshot ─────────────────────────────────────────
  app.get("/api/coach/context", async (_req, res) => {
    try { res.json(await buildCoachContext()); } catch (e) { err(res, e); }
  });

  // ─── Chat ─────────────────────────────────────────────────────
  app.post("/api/coach/chat", async (req, res) => {
    try {
      const message = z.string().min(1).max(4000).parse(req.body?.message);
      const ctx = await buildCoachContext();
      const response = await askCoach(ctx, message);
      res.json(response);
    } catch (e) { err(res, e); }
  });

  app.get("/api/coach/conversation", async (_req, res) => {
    try { res.json(await recentConversation(50)); } catch (e) { err(res, e); }
  });

  // ─── Settings ────────────────────────────────────────────────
  app.get("/api/coach/settings", async (_req, res) => {
    try { res.json(await getCoachSettings()); } catch (e) { err(res, e); }
  });

  app.patch("/api/coach/settings", async (req, res) => {
    try {
      const patch = insertCoachSettingsSchema.partial().parse(req.body);
      res.json(await updateCoachSettings(patch));
    } catch (e) { err(res, e); }
  });

  // ─── Memory ──────────────────────────────────────────────────
  app.get("/api/coach/memory", async (req, res) => {
    try {
      const includeInactive = req.query.all === "1";
      res.json(await listCoachMemory(!includeInactive));
    } catch (e) { err(res, e); }
  });

  app.post("/api/coach/memory", async (req, res) => {
    try {
      const fact = insertCoachMemorySchema.parse(req.body);
      res.json(await addCoachMemory(fact));
    } catch (e) { err(res, e); }
  });

  app.post("/api/coach/memory/:id/supersede", async (req, res) => {
    try {
      const oldId = Number(req.params.id);
      const newFact = insertCoachMemorySchema.parse(req.body);
      res.json(await supersedeMemory(oldId, newFact));
    } catch (e) { err(res, e); }
  });

  app.delete("/api/coach/memory/:id", async (req, res) => {
    try {
      await deactivateMemory(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  // ─── Checklist ───────────────────────────────────────────────
  app.get("/api/coach/checklist/:date", async (req, res) => {
    try { res.json(await getChecklist(req.params.date)); } catch (e) { err(res, e); }
  });

  app.post("/api/coach/checklist", async (req, res) => {
    try {
      const item = insertCoachChecklistSchema.parse(req.body);
      res.json(await addChecklistItem(item));
    } catch (e) { err(res, e); }
  });

  app.post("/api/coach/checklist/:id/done", async (req, res) => {
    try {
      const { relatedTable, relatedRecordId } = req.body ?? {};
      await markChecklistDone(Number(req.params.id), relatedTable, relatedRecordId);
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  app.post("/api/coach/checklist/:id/missed", async (req, res) => {
    try {
      await markChecklistMissed(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  // ─── Goals ───────────────────────────────────────────────────
  app.get("/api/fitness/goal", async (_req, res) => {
    try { res.json(await getActiveGoal() ?? null); } catch (e) { err(res, e); }
  });

  app.get("/api/fitness/goals", async (_req, res) => {
    try { res.json(await listGoalHistory()); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/goal", async (req, res) => {
    try {
      const g = insertFitnessGoalSchema.parse(req.body);
      res.json(await createGoal(g));
    } catch (e) { err(res, e); }
  });

  // ─── Body scans ──────────────────────────────────────────────
  app.get("/api/fitness/scans", async (_req, res) => {
    try { res.json(await listBodyScans(100)); } catch (e) { err(res, e); }
  });

  app.get("/api/fitness/scans/latest", async (_req, res) => {
    try { res.json(await latestBodyScan() ?? null); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/scans", async (req, res) => {
    try {
      const scan = insertBodyScanSchema.parse(req.body);
      res.json(await createBodyScan(scan));
    } catch (e) { err(res, e); }
  });

  // ─── Nutrition targets ───────────────────────────────────────
  app.get("/api/fitness/target", async (_req, res) => {
    try { res.json(await currentNutritionTarget() ?? null); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/target", async (req, res) => {
    try {
      const t = insertNutritionTargetSchema.parse(req.body);
      res.json(await createNutritionTarget(t));
    } catch (e) { err(res, e); }
  });

  // ─── Macro logs ──────────────────────────────────────────────
  app.get("/api/fitness/macros/:date", async (req, res) => {
    try { res.json(await getMacroLog(req.params.date) ?? null); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/macros", async (req, res) => {
    try {
      const log = insertMacroLogSchema.parse(req.body);
      res.json(await upsertMacroLog(log));
    } catch (e) { err(res, e); }
  });

  app.get("/api/fitness/macros", async (req, res) => {
    try {
      const start = z.string().parse(req.query.start);
      const end = z.string().parse(req.query.end);
      res.json(await listMacroLogsRange(start, end));
    } catch (e) { err(res, e); }
  });

  // ─── Workout plans ───────────────────────────────────────────
  app.get("/api/fitness/workouts/plan/:date", async (req, res) => {
    try { res.json(await getWorkoutPlan(req.params.date) ?? null); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/workouts/plan", async (req, res) => {
    try {
      const plan = insertWorkoutPlanSchema.parse(req.body);
      res.json(await upsertWorkoutPlan(plan));
    } catch (e) { err(res, e); }
  });

  /**
   * POST /api/fitness/workouts/generate
   * Body: { date: string, dayType?: string }
   * Uses coach engine + context to propose a workout.
   * Does NOT save — returns proposal only.
   */
  app.post("/api/fitness/workouts/generate", async (req, res) => {
    try {
      const date = z.string().parse(req.body?.date);
      const dayType = (req.body?.dayType ?? "strength") as any;
      const ctx = await buildCoachContext();
      const plan = await generateWorkout(ctx, date, dayType);
      res.json({ proposal: plan, context: {
        ledger: ctx.weeklyLedger,
        weeklyTarget: ctx.settings.weeklySetsPerBodyPart,
        recovery: ctx.latestRecovery,
      }});
    } catch (e) { err(res, e); }
  });

  // ─── Workout logs (IMMUTABLE) ────────────────────────────────
  app.get("/api/fitness/workouts/log/:date", async (req, res) => {
    try { res.json(await getWorkoutLogsForDate(req.params.date)); } catch (e) { err(res, e); }
  });

  app.get("/api/fitness/workouts/logs", async (req, res) => {
    try {
      const start = z.string().parse(req.query.start);
      const end = z.string().parse(req.query.end);
      res.json(await listWorkoutLogsRange(start, end));
    } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/workouts/log", async (req, res) => {
    try {
      const body = req.body;
      if (Array.isArray(body)) {
        const sets = body.map(s => insertWorkoutLogSchema.parse(s));
        res.json(await logWorkoutSets(sets));
      } else {
        const set = insertWorkoutLogSchema.parse(body);
        res.json(await logWorkoutSet(set));
      }
    } catch (e) { err(res, e); }
  });

  app.get("/api/fitness/workouts/ledger/:date", async (req, res) => {
    try { res.json(await computeWeeklyLedger(req.params.date)); } catch (e) { err(res, e); }
  });

  // ─── Recovery logs ───────────────────────────────────────────
  app.get("/api/fitness/recovery/:date", async (req, res) => {
    try { res.json(await getRecoveryLog(req.params.date) ?? null); } catch (e) { err(res, e); }
  });

  app.get("/api/fitness/recovery/latest", async (_req, res) => {
    try { res.json(await latestRecoveryLog() ?? null); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/recovery", async (req, res) => {
    try {
      const log = insertRecoveryLogSchema.parse(req.body);
      res.json(await upsertRecoveryLog(log));
    } catch (e) { err(res, e); }
  });

  // ─── Uploads ─────────────────────────────────────────────────
  app.get("/api/fitness/uploads/pending", async (_req, res) => {
    try { res.json(await listPendingUploads()); } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/uploads", async (req, res) => {
    try {
      const upload = insertUploadSchema.parse(req.body);
      res.json(await createUpload(upload));
    } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/uploads/:id/confirm", async (req, res) => {
    try {
      const { relatedTable, relatedRecordId } = req.body ?? {};
      await confirmUpload(Number(req.params.id), relatedTable, Number(relatedRecordId));
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  app.post("/api/fitness/uploads/:id/discard", async (req, res) => {
    try {
      await discardUpload(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  // Run Claude Vision on an upload and store its structured extraction on the upload row.
  // Body: {}
  // Client can then review + confirm before it's committed to the target table.
  app.post("/api/fitness/uploads/:id/extract", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const all = await listPendingUploads();
      const row = all.find(r => r.id === id);
      if (!row) return res.status(404).json({ error: "upload not found" });
      const extracted = await extractFromImage(row.imageUrl, row.kind);
      // persist extraction on the row so we can confirm it later
      const updated = await createUpload({
        imageUrl: row.imageUrl,
        kind: row.kind,
        aiExtracted: extracted,
        notes: row.notes ?? undefined,
      } as any);
      // discard the original stub row so we don't duplicate
      await discardUpload(row.id);
      res.json(updated);
    } catch (e) { err(res, e); }
  });
}
