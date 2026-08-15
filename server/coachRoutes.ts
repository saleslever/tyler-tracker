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
  createBodyScan, listBodyScans, latestBodyScan, deleteBodyScan,
  currentNutritionTarget, createNutritionTarget,
  upsertMacroLog, getMacroLog, listMacroLogsRange, deleteMacroLog,
  upsertWorkoutPlan, getWorkoutPlan,
  logWorkoutSet, logWorkoutSets, listWorkoutLogsRange, getWorkoutLogsForDate, computeWeeklyLedger,
  upsertRecoveryLog, getRecoveryLog, latestRecoveryLog, deleteRecoveryLog,
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

  // ─── Undo (mutable log types only) ──────────────────────────
  app.post("/api/coach/undo/body_scan", async (req, res) => {
    try {
      const id = Number(req.body?.id);
      if (!Number.isFinite(id)) throw new Error("id required");
      await deleteBodyScan(id);
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });
  app.post("/api/coach/undo/macro", async (req, res) => {
    try {
      const id = Number(req.body?.id);
      if (!Number.isFinite(id)) throw new Error("id required");
      await deleteMacroLog(id);
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });
  app.post("/api/coach/undo/recovery", async (req, res) => {
    try {
      const id = Number(req.body?.id);
      if (!Number.isFinite(id)) throw new Error("id required");
      await deleteRecoveryLog(id);
      res.json({ ok: true });
    } catch (e) { err(res, e); }
  });

  // ─── Chat ─────────────────────────────────────────────────────
  app.post("/api/coach/chat", async (req, res) => {
    try {
      // Message required unless one or more images are attached (then a default prompt is used)
      const rawMessage = typeof req.body?.message === "string" ? req.body.message : "";
      // Accept new array field OR legacy single-image field for backward compat
      const rawUrls: string[] = Array.isArray(req.body?.imageDataUrls)
        ? req.body.imageDataUrls.filter((u: any) => typeof u === "string")
        : typeof req.body?.imageDataUrl === "string"
          ? [req.body.imageDataUrl]
          : [];
      const imageDataUrls = rawUrls.filter(u => u.startsWith("data:image/"));
      if (!rawMessage.trim() && imageDataUrls.length === 0) {
        return res.status(400).json({ error: "message or imageDataUrls required" });
      }
      const message = z.string().max(4000).parse(rawMessage);
      const ctx = await buildCoachContext();
      const response = await askCoach(ctx, message, imageDataUrls);
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
      // Client can pass an explicit cap list; otherwise compute from the ledger.
      const explicitCap: string[] | undefined = Array.isArray(req.body?.cappedBodyParts)
        ? req.body.cappedBodyParts
        : undefined;
      const ctx = await buildCoachContext();
      const weeklyTarget = ctx.settings.weeklySetsPerBodyPart;
      const derivedCap = Object.entries(ctx.weeklyLedger || {})
        .filter(([, count]) => (count as number) >= weeklyTarget)
        .map(([part]) => part);
      const cappedBodyParts = explicitCap ?? derivedCap;
      const plan = await generateWorkout(ctx, date, dayType, cappedBodyParts);
      // Server-side filter: no matter what Coach says, never propose exercises
      // whose targetBodyPart is already at cap.
      if (plan && Array.isArray(plan.exercises)) {
        const before = plan.exercises.length;
        plan.exercises = plan.exercises.filter((ex: any) => !cappedBodyParts.includes(ex.targetBodyPart));
        if (before !== plan.exercises.length) {
          plan.notes = (plan.notes ?? "") + ` [server dropped ${before - plan.exercises.length} exercises targeting capped parts]`;
        }
      }
      res.json({ proposal: plan, context: {
        ledger: ctx.weeklyLedger,
        weeklyTarget,
        cappedBodyParts,
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

  // ─── Strength score / overview endpoint ────────────────────────
  // Composes an Overview-page payload from real data. No mocks.
  app.get("/api/fitness/overview", async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

      // Pull all sources we can derive score signals from
      const [scan, target, goal, recovery, macros7, weeklyLedger, workoutLogs30] = await Promise.all([
        latestBodyScan(),
        currentNutritionTarget(),
        getActiveGoal(),
        latestRecoveryLog(),
        listMacroLogsRange(new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), today),
        computeWeeklyLedger(today),
        listWorkoutLogsRange(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), today),
      ]);

      const scans = await listBodyScans(60);
      const macros30 = await listMacroLogsRange(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10), today);

      // ── Score pillars (0-10 each) ──
      // Training Load: % of weekly ledger cap hit
      const setCap = 24;
      const totalSetsThisWeek = Object.values(weeklyLedger).reduce((a, b) => a + b, 0);
      const trainingLoad = Math.min(10, (totalSetsThisWeek / setCap) * 10);

      // Nutrition: protein-hit rate over last 7 days
      const proteinTarget = target?.proteinG ?? 216;
      const proteinHits = macros7.filter(m => (m.proteinG ?? 0) >= proteinTarget * 0.9).length;
      const nutrition = macros7.length > 0 ? Math.min(10, (proteinHits / 7) * 10) : 0;

      // Recovery: recovery % from latest Whoop scaled 0-10
      const recoveryPillar = recovery?.whoopRecoveryPct != null
        ? Math.min(10, (recovery.whoopRecoveryPct as number) / 10)
        : 0;

      // Consistency: workout-days over last 7
      const uniqueDays = new Set(workoutLogs30.filter(w => w.date >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)).map(w => w.date));
      const consistency = Math.min(10, (uniqueDays.size / 5) * 10);

      // Composite score (weighted, 0-300 range so it reads big)
      const compositeToday = Math.round(
        (trainingLoad * 8) + (nutrition * 8) + (recoveryPillar * 7) + (consistency * 7)
      );

      // Compute yesterday's composite (same pillars against yesterday cutoff)
      const yesterdayLedger = await computeWeeklyLedger(yesterday);
      const ySets = Object.values(yesterdayLedger).reduce((a, b) => a + b, 0);
      const yTrainingLoad = Math.min(10, (ySets / setCap) * 10);
      const yMacros7 = await listMacroLogsRange(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10), yesterday);
      const yProteinHits = yMacros7.filter(m => (m.proteinG ?? 0) >= proteinTarget * 0.9).length;
      const yNutrition = yMacros7.length > 0 ? Math.min(10, (yProteinHits / 7) * 10) : 0;
      const compositeYesterday = Math.round(
        (yTrainingLoad * 8) + (yNutrition * 8) + (recoveryPillar * 7) + (consistency * 7)
      );
      const delta = compositeToday - compositeYesterday;

      // 7-day trend series — score for each of last 7 days
      const sevenDayTrend: { date: string; label: string; score: number }[] = [];
      const dayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5);
        const dstr = d.toISOString().slice(0, 10);
        const dl = await computeWeeklyLedger(dstr);
        const ds = Object.values(dl).reduce((a, b) => a + b, 0);
        const dTrainingLoad = Math.min(10, (ds / setCap) * 10);
        const dMacros = await listMacroLogsRange(new Date(d.getTime() - 6 * 864e5).toISOString().slice(0, 10), dstr);
        const dPhits = dMacros.filter(m => (m.proteinG ?? 0) >= proteinTarget * 0.9).length;
        const dNutrition = dMacros.length > 0 ? Math.min(10, (dPhits / 7) * 10) : 0;
        const dScore = Math.round((dTrainingLoad * 8) + (dNutrition * 8) + (recoveryPillar * 7) + (consistency * 7));
        sevenDayTrend.push({ date: dstr, label: dayLabels[d.getDay()], score: dScore });
      }

      const weeklyAverage = Math.round(sevenDayTrend.reduce((s, x) => s + x.score, 0) / sevenDayTrend.length);

      // Weekly average vs last week
      const twoWeekAvgs: number[] = [];
      for (let w = 0; w < 2; w++) {
        let sum = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(Date.now() - (i + w * 7) * 864e5);
          const dstr = d.toISOString().slice(0, 10);
          const dl = await computeWeeklyLedger(dstr);
          const ds = Object.values(dl).reduce((a, b) => a + b, 0);
          sum += Math.round(Math.min(10, (ds / setCap) * 10) * 8);
        }
        twoWeekAvgs.push(Math.round(sum / 7));
      }
      const vsLastWeek = twoWeekAvgs[0] - twoWeekAvgs[1];

      // ── Training Summary — top 5 exercises by total volume ──
      const exerciseAgg: Record<string, { volume: number; sets: number; topWeight: number; reps: number }> = {};
      for (const w of workoutLogs30) {
        const key = w.exerciseName || "UNKNOWN";
        if (!exerciseAgg[key]) exerciseAgg[key] = { volume: 0, sets: 0, topWeight: 0, reps: 0 };
        const wt = w.weight ?? 0;
        const rp = w.reps ?? 0;
        exerciseAgg[key].volume += wt * rp;
        exerciseAgg[key].sets += 1;
        exerciseAgg[key].reps += rp;
        if (wt > exerciseAgg[key].topWeight) exerciseAgg[key].topWeight = wt;
      }
      const trainingSummary = Object.entries(exerciseAgg)
        .sort(([, a], [, b]) => b.volume - a.volume)
        .slice(0, 5)
        .map(([name, s]) => ({
          name: name.toUpperCase(),
          volume: Math.round(s.volume),
          sets: s.sets,
          intensity: Math.min(5, Math.round((s.sets / 6) * 5)),
          personalRecord: s.topWeight,
        }));

      // ── Body Composition — from latest scan ──
      const bodyComp = {
        weight: scan?.weight ?? null,
        bodyFatPct: scan?.bodyFatPct ?? null,
        leanMassPct: scan?.bodyFatPct != null ? Math.round((100 - scan.bodyFatPct) * 10) / 10 : null,
        waterPct: null as number | null,
        scanDate: scan?.date ?? null,
      };

      // ── Weekly Goals — derived progress ──
      const trainingSessionGoal = 5;
      const actualSessions = uniqueDays.size;
      const overloadGoal = 4;
      // Progressive overload: exercises where topWeight this week > topWeight last week
      const lastWeekLogs = workoutLogs30.filter(w => {
        const d = new Date(w.date);
        const cutoff = new Date(Date.now() - 7 * 864e5);
        const start = new Date(Date.now() - 14 * 864e5);
        return d >= start && d < cutoff;
      });
      const thisWeekTop: Record<string, number> = {};
      const lastWeekTop: Record<string, number> = {};
      const thisWeekStart = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
      for (const w of workoutLogs30) {
        const key = w.exerciseName || "";
        const wt = w.weight ?? 0;
        if (w.date >= thisWeekStart) {
          thisWeekTop[key] = Math.max(thisWeekTop[key] ?? 0, wt);
        }
      }
      for (const w of lastWeekLogs) {
        const key = w.exerciseName || "";
        const wt = w.weight ?? 0;
        lastWeekTop[key] = Math.max(lastWeekTop[key] ?? 0, wt);
      }
      const overloadHits = Object.keys(thisWeekTop).filter(k => thisWeekTop[k] > (lastWeekTop[k] ?? 0)).length;

      const proteinDaysGoal = 7;
      const sleepGoal = 7;
      // Simple: count days recovery > 60% as "good sleep"
      const recovery7 = await Promise.all(
        Array.from({ length: 7 }).map((_, i) => getRecoveryLog(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)))
      );
      const sleepHits = recovery7.filter(r => (r?.whoopRecoveryPct ?? 0) >= 60).length;

      const weeklyGoals = [
        { label: "TRAINING SESSIONS", current: actualSessions, target: trainingSessionGoal, icon: "helmet" },
        { label: "PROGRESSIVE OVERLOAD", current: overloadHits, target: overloadGoal, icon: "wreath" },
        { label: "NUTRITION ADHERENCE", current: proteinHits, target: proteinDaysGoal, icon: "bowl" },
        { label: "SLEEP CONSISTENCY", current: sleepHits, target: sleepGoal, icon: "moon" },
      ];

      // ── Achievements — derived from actual events ──
      const achievements: { title: string; sub: string; date: string; kind: string }[] = [];
      if (totalSetsThisWeek >= setCap) {
        achievements.push({ title: "IRON DISCIPLINE", sub: `Hit weekly set cap (${setCap} sets)`, date: today, kind: "discipline" });
      }
      // New PR: highest-weight set in last 7 days that beats any prior 30-day max
      const recentLogs = workoutLogs30.filter(w => w.date >= thisWeekStart);
      const priorLogs = workoutLogs30.filter(w => w.date < thisWeekStart);
      const priorMax: Record<string, number> = {};
      for (const w of priorLogs) {
        const k = w.exerciseName || "";
        priorMax[k] = Math.max(priorMax[k] ?? 0, w.weight ?? 0);
      }
      const prs = recentLogs.filter(w => (w.weight ?? 0) > (priorMax[w.exerciseName || ""] ?? 0));
      if (prs.length > 0) {
        const best = prs.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
        achievements.push({
          title: "NEW PERSONAL BEST",
          sub: `${(best.exerciseName || "").toUpperCase()}: ${best.weight} lb`,
          date: best.date,
          kind: "pr",
        });
      }
      if (uniqueDays.size >= 3) {
        achievements.push({ title: "CONSISTENCY KING", sub: `${uniqueDays.size} workouts this week`, date: today, kind: "consistency" });
      }

      // ── Calendar strip — last 7 days with icons ──
      const calendar: { date: string; day: number; label: string; kind: string; isToday: boolean }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5);
        const dstr = d.toISOString().slice(0, 10);
        const dayLogs = workoutLogs30.filter(w => w.date === dstr);
        const dayMacro = macros30.find(m => m.date === dstr);
        let kind = "rest";
        if (dayLogs.length > 0) kind = "training";
        else if (dayMacro && (dayMacro.proteinG ?? 0) >= proteinTarget * 0.9) kind = "nutrition";
        calendar.push({
          date: dstr,
          day: d.getDate(),
          label: dayLabels[d.getDay()],
          kind,
          isToday: dstr === today,
        });
      }

      // ── Lifetime stats ──
      const allLogs = await listWorkoutLogsRange("2020-01-01", today);
      const totalWorkouts = new Set(allLogs.map(l => l.date)).size;
      const totalVolume = allLogs.reduce((s, l) => s + ((l.weight ?? 0) * (l.reps ?? 0)), 0);
      // Longest streak: consecutive days with workouts
      const workoutDates = [...new Set(allLogs.map(l => l.date))].sort();
      let longestStreak = 0;
      let currentStreak = 0;
      let prevDate: Date | null = null;
      for (const dstr of workoutDates) {
        const d = new Date(dstr);
        if (prevDate && (d.getTime() - prevDate.getTime()) === 864e5) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
        longestStreak = Math.max(longestStreak, currentStreak);
        prevDate = d;
      }
      const allScores: number[] = sevenDayTrend.map(t => t.score);
      const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length) : 0;

      res.json({
        today,
        strengthScore: {
          composite: compositeToday,
          delta,
          pillars: {
            trainingLoad: Math.round(trainingLoad * 10) / 10,
            nutrition: Math.round(nutrition * 10) / 10,
            recovery: Math.round(recoveryPillar * 10) / 10,
            consistency: Math.round(consistency * 10) / 10,
          },
        },
        trend: {
          series: sevenDayTrend,
          weeklyAverage,
          vsLastWeek,
        },
        trainingSummary,
        bodyComp,
        weeklyGoals,
        achievements: achievements.slice(0, 3),
        calendar,
        lifetimeStats: {
          workouts: totalWorkouts,
          totalVolumeKg: Math.round(totalVolume / 2.2046),
          longestStreakWeeks: Math.round(longestStreak / 7),
          avgScore,
        },
        target,
        goal,
        weeklyLedger,
      });
    } catch (e) { err(res, e); }
  });

  // ─── Personalized dashboard endpoint (Tyler-tailored) ──────────
  // Composes all metrics needed for the new Analytics page.
  app.get("/api/fitness/dashboard", async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const daysBack = 84; // ~12 weeks of history
      const startDate = new Date(Date.now() - daysBack * 864e5).toISOString().slice(0, 10);

      const [scans, macros, workoutLogs, weeklyLedger, goal, dailyLogsAll, fastsAll] = await Promise.all([
        listBodyScans(120),
        listMacroLogsRange(startDate, today),
        listWorkoutLogsRange(startDate, today),
        computeWeeklyLedger(today),
        getActiveGoal(),
        (await import("./storage")).storage.getAllLogs(),
        (await import("./storage")).storage.getFasts(),
      ]);

      // ── Weight trajectory ── (from body_scans, most recent first sorted asc)
      const scansAsc = [...scans].filter(s => s.weight != null).sort((a, b) => a.date.localeCompare(b.date));
      const weightSeries = scansAsc.map(s => ({ date: s.date, weight: Number(s.weight) }));

      // Also merge dailyLogs.weight when present
      const dailyWeightPoints = (dailyLogsAll || [])
        .filter((d: any) => d.weight != null && d.weight > 0)
        .map((d: any) => ({ date: d.date, weight: Number(d.weight) }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));

      // Merge by date, prefer body_scans when both
      const dateMap = new Map<string, number>();
      for (const p of dailyWeightPoints) dateMap.set(p.date, p.weight);
      for (const p of weightSeries) dateMap.set(p.date, p.weight);
      const mergedWeights = Array.from(dateMap.entries())
        .map(([date, weight]) => ({ date, weight }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Starting weight = earliest recorded; current = latest
      const startWeight = mergedWeights[0]?.weight ?? 252.2;
      const currentWeight = mergedWeights[mergedWeights.length - 1]?.weight ?? startWeight;
      const totalLost = Number((startWeight - currentWeight).toFixed(1));

      // Weekly deltas — group weight points by ISO week, take last of each week
      function weekKey(dateStr: string): string {
        const d = new Date(dateStr);
        const start = new Date(d);
        start.setDate(d.getDate() - d.getDay()); // Sunday
        return start.toISOString().slice(0, 10);
      }
      const byWeek = new Map<string, { date: string; weight: number }[]>();
      for (const p of mergedWeights) {
        const k = weekKey(p.date);
        if (!byWeek.has(k)) byWeek.set(k, []);
        byWeek.get(k)!.push(p);
      }
      const weeklyWeights = Array.from(byWeek.entries())
        .map(([week, points]) => ({ week, weight: points[points.length - 1].weight }))
        .sort((a, b) => a.week.localeCompare(b.week));
      const weeklyDeltas = weeklyWeights.map((w, i) => {
        const prev = weeklyWeights[i - 1];
        return {
          week: w.week,
          weight: w.weight,
          delta: prev ? Number((w.weight - prev.weight).toFixed(1)) : 0,
        };
      });

      // Projection to 195 by March 6 2027
      const targetWeight = goal?.targetWeight ?? 195;
      const targetDate = goal?.targetDate ?? "2027-03-06";
      const daysToTarget = Math.max(1, Math.ceil((new Date(targetDate).getTime() - Date.now()) / 864e5));
      const remaining = Number((currentWeight - targetWeight).toFixed(1));
      const requiredPerWeek = Number(((remaining / daysToTarget) * 7).toFixed(2));
      // Actual rate over last 28 days
      const recent = mergedWeights.filter(w => w.date >= new Date(Date.now() - 28 * 864e5).toISOString().slice(0, 10));
      let actualPerWeek = 0;
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const dayDiff = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 864e5);
        actualPerWeek = Number((((first.weight - last.weight) / dayDiff) * 7).toFixed(2));
      }
      const projectedDate = actualPerWeek > 0
        ? new Date(Date.now() + (remaining / actualPerWeek) * 7 * 864e5).toISOString().slice(0, 10)
        : null;
      const onTrack = actualPerWeek > 0 && actualPerWeek >= requiredPerWeek * 0.9;

      // ── Body-part sets this week (for silhouette) ──
      // weeklyLedger already keyed by direct body part
      const bodyPartSets = {
        chest: weeklyLedger.chest ?? 0,
        back: weeklyLedger.back ?? 0,
        shoulders: (weeklyLedger.front_delts ?? 0) + (weeklyLedger.side_delts ?? 0) + (weeklyLedger.rear_delts ?? 0),
        biceps: weeklyLedger.biceps ?? 0,
        triceps: weeklyLedger.triceps ?? 0,
        legs: (weeklyLedger.quads ?? 0) + (weeklyLedger.hamstrings ?? 0) + (weeklyLedger.glutes ?? 0),
        abs: weeklyLedger.core ?? 0,
      };
      const bodyPartTargets = { chest: 18, back: 18, shoulders: 18, biceps: 18, triceps: 18, legs: 18, abs: 9 };

      // ── Fasting stats ──
      const closedFasts = fastsAll.filter((f: any) => f.endedAt);
      const activeFast = fastsAll.find((f: any) => !f.endedAt);
      const durations = closedFasts.map((f: any) => {
        const ms = new Date(f.endedAt).getTime() - new Date(f.startedAt).getTime();
        return ms / (1000 * 60 * 60);
      });
      const currentFastHours = activeFast
        ? (Date.now() - new Date(activeFast.startedAt).getTime()) / (1000 * 60 * 60)
        : null;
      const longestFast = durations.length ? Math.max(...durations) : 0;
      const avgFast = durations.length ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length : 0;

      // ── Days sober (no alcohol streak) ──
      // Count consecutive days from today backwards where noAlcohol=1
      const logsByDate = new Map<string, any>();
      for (const l of dailyLogsAll || []) logsByDate.set(l.date, l);
      let soberStreak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        const l = logsByDate.get(d);
        if (l && l.noAlcohol === 1) soberStreak++;
        else if (i === 0) continue; // today may not be logged yet; keep going
        else break;
      }
      // Fallback: manual anchor — last drink July 30 2026
      const anchoredSober = Math.floor((Date.now() - new Date("2026-07-31T00:00:00").getTime()) / 864e5) + 1;
      const daysSober = Math.max(soberStreak, anchoredSober);

      // ── Weekly calorie totals + daily average ──
      const macrosByWeek = new Map<string, { total: number; count: number }>();
      for (const m of macros) {
        if (m.calories == null) continue;
        const k = weekKey(m.date);
        if (!macrosByWeek.has(k)) macrosByWeek.set(k, { total: 0, count: 0 });
        const entry = macrosByWeek.get(k)!;
        entry.total += m.calories;
        entry.count++;
      }
      const weeklyCalories = Array.from(macrosByWeek.entries())
        .map(([week, { total, count }]) => ({ week, total, dailyAvg: Math.round(total / Math.max(1, count)) }))
        .sort((a, b) => a.week.localeCompare(b.week))
        .slice(-8);

      // ── Step counts (last 14 days from daily_logs.steps) ──
      const stepSeries: { date: string; steps: number; hit10k: boolean }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        const l = logsByDate.get(d);
        const steps = l?.steps ?? 0;
        stepSeries.push({ date: d, steps, hit10k: steps >= 10000 });
      }
      const avgSteps = Math.round(stepSeries.reduce((a, b) => a + b.steps, 0) / stepSeries.length);

      // ── Protein daily hits (200g target) ──
      const proteinHits14 = macros
        .filter(m => m.date >= new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10))
        .map(m => ({ date: m.date, hit: (m.proteinG ?? 0) >= 200 }));

      // ── Workouts this week count ──
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const workoutsThisWeek = new Set(workoutLogs.filter(w => w.date >= weekStartStr).map(w => w.date)).size;

      res.json({
        today,
        goal: { startWeight, currentWeight, targetWeight, targetDate, totalLost, remaining, daysToTarget },
        projection: { requiredPerWeek, actualPerWeek, projectedDate, onTrack },
        weeklyDeltas,
        mergedWeights: mergedWeights.slice(-90), // last ~90 pts
        bodyPartSets,
        bodyPartTargets,
        fasting: {
          current: currentFastHours ? Number(currentFastHours.toFixed(1)) : null,
          longest: Number(longestFast.toFixed(1)),
          average: Number(avgFast.toFixed(1)),
          totalCount: closedFasts.length,
        },
        daysSober,
        weeklyCalories,
        stepSeries,
        avgSteps,
        proteinHits14,
        workoutsThisWeek,
      });
    } catch (e) { err(res, e); }
  });
}
