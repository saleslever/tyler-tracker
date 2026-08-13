import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  insertDailyLogSchema,
  insertTaskSchema,
  insertJournalSchema,
  insertGoalSchema,
  insertChallengeSchema,
  insertRitualSchema,
} from "@shared/schema";
import { z } from "zod";
import { registerCoachRoutes } from "./coachRoutes";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Fitness Coach OS routes (M3)
  registerCoachRoutes(app);

  // Reset (nukes everything)
  app.post("/api/reset", async (_req, res) => {
    await storage.resetAll();
    res.json({ ok: true });
  });

  // Full JSON export (backup)
  app.get("/api/export", async (_req, res) => {
    const [logs, tasks, journal, goals, challenges, rituals, quests, records, seals, moods, fasts, habits] = await Promise.all([
      storage.getAllLogs(),
      storage.getTasks(),
      storage.getAllJournal(),
      storage.getGoals(),
      storage.getChallenges(),
      storage.getRituals(),
      storage.getQuests(),
      storage.getRecords(),
      storage.getBossSeals(),
      storage.getMoods(),
      storage.getFasts(),
      storage.getHabits(),
    ]);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="tyler-tracker-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      version: 1,
      logs, tasks, journal, goals, challenges, rituals, quests, records, seals, moods, fasts, habits,
    });
  });

  // Logs
  app.get("/api/logs", async (_req, res) => res.json(await storage.getAllLogs()));
  app.get("/api/logs/:date", async (req, res) => res.json(await storage.getLog(req.params.date) ?? null));

  // Delete a specific day's log (clears that date entirely)
  app.delete("/api/logs/:date", async (req, res) => {
    await storage.deleteLog(req.params.date);
    res.json({ ok: true });
  });

  const patchLog = insertDailyLogSchema.partial().omit({ date: true });
  app.patch("/api/logs/:date", async (req, res) => {
    try {
      const p = patchLog.parse(req.body);
      res.json(await storage.upsertLog(req.params.date, p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Tasks
  app.get("/api/tasks", async (_req, res) => res.json(await storage.getTasks()));
  app.post("/api/tasks", async (req, res) => {
    try {
      const p = insertTaskSchema.parse(req.body);
      res.json(await storage.createTask(p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  const updateTaskS = z.object({
    title: z.string().optional(),
    list: z.enum(["today", "backlog"]).optional(),
    priority: z.enum(["high", "med", "low"]).optional(),
    completed: z.number().optional(),
    completedAt: z.string().nullable().optional(),
  });
  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const p = updateTaskS.parse(req.body);
      res.json(await storage.updateTask(Number(req.params.id), p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  app.delete("/api/tasks/:id", async (req, res) => {
    await storage.deleteTask(Number(req.params.id));
    res.json({ ok: true });
  });

  // Journal
  app.get("/api/journal", async (_req, res) => res.json(await storage.getAllJournal()));
  app.get("/api/journal/:date", async (req, res) => res.json(await storage.getJournal(req.params.date) ?? null));
  const patchJournal = insertJournalSchema.partial().omit({ date: true });
  app.patch("/api/journal/:date", async (req, res) => {
    try {
      const p = patchJournal.parse(req.body);
      res.json(await storage.upsertJournal(req.params.date, p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Goals
  app.get("/api/goals", async (_req, res) => res.json(await storage.getGoals()));
  app.post("/api/goals", async (req, res) => {
    try {
      const p = insertGoalSchema.parse(req.body);
      res.json(await storage.createGoal(p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  const updateGoalS = z.object({
    title: z.string().optional(),
    detail: z.string().nullable().optional(),
    category: z.string().optional(),
    horizon: z.string().optional(),
    targetDate: z.string().nullable().optional(),
    progress: z.number().optional(),
    status: z.string().optional(),
  });
  app.patch("/api/goals/:id", async (req, res) => {
    try {
      const p = updateGoalS.parse(req.body);
      res.json(await storage.updateGoal(Number(req.params.id), p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  app.delete("/api/goals/:id", async (req, res) => {
    await storage.deleteGoal(Number(req.params.id));
    res.json({ ok: true });
  });

  // Challenges
  app.get("/api/challenges", async (_req, res) => res.json(await storage.getChallenges()));
  app.get("/api/challenges/active", async (req, res) => {
    const today = (req.query.today as string) || new Date().toISOString().slice(0, 10);
    const active = await storage.getActiveChallenge(today);
    res.json(active ?? null);
  });
  app.post("/api/challenges", async (req, res) => {
    try {
      const p = insertChallengeSchema.parse(req.body);
      res.json(await storage.createChallenge(p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  app.patch("/api/challenges/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
    const updated = await storage.updateChallenge(id, req.body ?? {});
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/challenges/:id", async (req, res) => {
    await storage.deleteChallenge(Number(req.params.id));
    res.json({ ok: true });
  });

  // Rituals
  app.get("/api/rituals", async (_req, res) => res.json(await storage.getRituals()));
  app.get("/api/rituals/:key", async (req, res) => {
    res.json(await storage.getRitual(req.params.key) ?? null);
  });
  const patchRitual = insertRitualSchema.partial();
  app.patch("/api/rituals/:key", async (req, res) => {
    try {
      const p = patchRitual.parse(req.body);
      res.json(await storage.upsertRitual(req.params.key, p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Quests
  app.get("/api/quests", async (_req, res) => res.json(await storage.getQuests()));
  const patchQuest = z.object({
    progress: z.number().optional(),
    completedAt: z.string().nullable().optional(),
    claimedAt: z.string().nullable().optional(),
  });
  app.patch("/api/quests/:key", async (req, res) => {
    try {
      const p = patchQuest.parse(req.body);
      res.json(await storage.updateQuest(req.params.key, p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Claim a quest — archives it into completions and spawns the next tier.
  app.post("/api/quests/:key/claim", async (req, res) => {
    try {
      res.json(await storage.claimQuest(req.params.key));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Trophy Hall — immutable log of every quest completed
  app.get("/api/quest-completions", async (_req, res) => res.json(await storage.getQuestCompletions()));

  // Records
  app.get("/api/records", async (_req, res) => res.json(await storage.getRecords()));
  const patchRecord = z.object({
    value: z.number().optional(),
    setOnDate: z.string().nullable().optional(),
    seenAt: z.string().nullable().optional(),
  });
  app.patch("/api/records/:key", async (req, res) => {
    try {
      const p = patchRecord.parse(req.body);
      res.json(await storage.updateRecord(req.params.key, p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Boss seals
  app.get("/api/boss-seals", async (_req, res) => res.json(await storage.getBossSeals()));
  const createSealS = z.object({
    date: z.string(),
    sealedAt: z.string(),
    xpAwarded: z.number().default(0),
  });
  app.post("/api/boss-seals", async (req, res) => {
    try {
      const p = createSealS.parse(req.body);
      res.json(await storage.createBossSeal(p));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // -------- Health sync (Apple Health -> daily_logs) --------
  // Each reading is one day's worth of Oura/Apple Health data.
  // Oura wins on conflicts: any provided (non-null) field overwrites existing.
  const healthReadingS = z.object({
    date: z.string(),                             // YYYY-MM-DD
    sleepHours: z.number().optional().nullable(),
    sleepScore: z.number().int().optional().nullable(),
    restingHeartRate: z.number().int().optional().nullable(),
    steps: z.number().int().optional().nullable(),
  });
  const healthSyncS = z.object({
    source: z.string().optional(),                // e.g. "apple_health"
    readings: z.array(healthReadingS),
  });
  app.post("/api/health/sync", async (req, res) => {
    try {
      const body = healthSyncS.parse(req.body);
      const results: { date: string; updated: string[] }[] = [];
      for (const r of body.readings) {
        const patch: any = {};
        const touched: string[] = [];
        if (r.sleepHours != null)       { patch.sleepHours = r.sleepHours;             touched.push("sleepHours"); }
        if (r.sleepScore != null)       { patch.sleepScore = r.sleepScore;             touched.push("sleepScore"); }
        if (r.restingHeartRate != null) { patch.restingHeartRate = r.restingHeartRate; touched.push("restingHeartRate"); }
        if (r.steps != null)            { patch.steps = r.steps;                       touched.push("steps"); }
        if (touched.length === 0) continue;
        await storage.upsertLog(r.date, patch);
        results.push({ date: r.date, updated: touched });
      }
      res.json({
        ok: true,
        source: body.source ?? "apple_health",
        syncedAt: new Date().toISOString(),
        days: results,
      });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // -------- Mood logs --------
  app.get("/api/moods", async (_req, res) => res.json(await storage.getMoods()));
  const createMoodS = z.object({
    value: z.number().int().min(1).max(10),
    note: z.string().optional().nullable(),
    loggedAt: z.string().optional(),
  });
  app.post("/api/moods", async (req, res) => {
    try {
      const p = createMoodS.parse(req.body);
      res.json(await storage.createMood({
        value: p.value,
        note: p.note ?? null,
        loggedAt: p.loggedAt ?? new Date().toISOString(),
      }));
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });
  app.delete("/api/moods/:id", async (req, res) => {
    try {
      await storage.deleteMood(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // -------- Fasts --------
  // Helper: after a fast is closed (endedAt is set), autofill the day the fast
  // ENDED on with the total duration in hours. If the same day already has a
  // fasting_hours value, take the max so a manual entry doesn't shrink an
  // auto-tracked value (and vice versa).
  async function autofillFastingHours(startedAt: string, endedAt: string) {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return;
    const hours = (end.getTime() - start.getTime()) / 3600000;
    // Local YYYY-MM-DD of the day the fast ended (that's when the user "gets credit")
    const y = end.getFullYear();
    const m = String(end.getMonth() + 1).padStart(2, "0");
    const d = String(end.getDate()).padStart(2, "0");
    const date = `${y}-${m}-${d}`;
    const existing = await storage.getLog(date);
    const prior = existing?.fastingHours ?? 0;
    const next = Math.max(prior, Math.round(hours * 10) / 10); // 1 decimal
    await storage.upsertLog(date, { fastingHours: next });
  }

  app.get("/api/fasts", async (_req, res) => res.json(await storage.getFasts()));
  app.get("/api/fasts/active", async (_req, res) => {
    res.json((await storage.getActiveFast()) ?? null);
  });

  const startFastS = z.object({
    goalHours: z.number().positive().max(72).optional(),
    startedAt: z.string().optional(),
    notes: z.string().optional().nullable(),
  });
  app.post("/api/fasts/start", async (req, res) => {
    try {
      const p = startFastS.parse(req.body ?? {});
      const active = await storage.getActiveFast();
      if (active) {
        // Idempotent: return the current active fast rather than 400-ing.
        return res.json(active);
      }
      const fast = await storage.createFast({
        startedAt: p.startedAt ?? new Date().toISOString(),
        endedAt: null,
        goalHours: p.goalHours ?? 18,
        notes: p.notes ?? null,
        manual: 0,
      });
      res.json(fast);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  const endFastS = z.object({ endedAt: z.string().optional() });
  app.post("/api/fasts/:id/end", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const p = endFastS.parse(req.body ?? {});
      const endedAt = p.endedAt ?? new Date().toISOString();
      const updated = await storage.updateFast(id, { endedAt });
      if (!updated) return res.status(404).json({ error: "Fast not found" });
      await autofillFastingHours(updated.startedAt, endedAt);
      res.json(updated);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // Manual entry: create a completed fast (both start + end)
  const manualFastS = z.object({
    startedAt: z.string(),
    endedAt: z.string(),
    goalHours: z.number().positive().max(72).optional(),
    notes: z.string().optional().nullable(),
  });
  app.post("/api/fasts", async (req, res) => {
    try {
      const p = manualFastS.parse(req.body);
      if (new Date(p.endedAt) <= new Date(p.startedAt)) {
        return res.status(400).json({ error: "End must be after start" });
      }
      const fast = await storage.createFast({
        startedAt: p.startedAt,
        endedAt: p.endedAt,
        goalHours: p.goalHours ?? 18,
        notes: p.notes ?? null,
        manual: 1,
      });
      await autofillFastingHours(p.startedAt, p.endedAt);
      res.json(fast);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  const patchFastS = z.object({
    startedAt: z.string().optional(),
    endedAt: z.string().optional().nullable(),
    goalHours: z.number().positive().max(72).optional(),
    notes: z.string().optional().nullable(),
  });
  app.patch("/api/fasts/:id", async (req, res) => {
    try {
      const p = patchFastS.parse(req.body);
      const updated = await storage.updateFast(Number(req.params.id), p as any);
      if (!updated) return res.status(404).json({ error: "Fast not found" });
      if (updated.endedAt) await autofillFastingHours(updated.startedAt, updated.endedAt);
      res.json(updated);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  app.delete("/api/fasts/:id", async (req, res) => {
    try {
      await storage.deleteFast(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  // ---------- Habits (definitions + values) ----------
  app.get("/api/habits", async (_req, res) => res.json(await storage.getHabits()));

  app.post("/api/habits", async (req, res) => {
    try {
      const { label, kind, goal, goalDirection, unit, hint, emoji } = req.body ?? {};
      if (!label || !kind) return res.status(400).json({ error: "label and kind required" });
      if (kind !== "bool" && kind !== "num") return res.status(400).json({ error: "kind must be bool or num" });
      // Auto-generate a stable key from label + timestamp so the user doesn't have to think about it.
      const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "habit";
      const key = `custom_${slug}_${Date.now().toString(36)}`;
      // Put new habit at the end of the list.
      const existing = await storage.getHabits();
      const position = existing.length;
      const row = await storage.createHabit({
        key, label, kind,
        goal: goal ?? null, goalDirection: goalDirection ?? null,
        unit: unit ?? null, hint: hint ?? null, emoji: emoji ?? null,
        position, active: 1, builtin: 0,
        createdAt: new Date().toISOString(),
      } as any);
      res.json(row);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  app.patch("/api/habits/:id", async (req, res) => {
    try {
      const row = await storage.updateHabit(Number(req.params.id), req.body ?? {});
      res.json(row ?? null);
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  app.delete("/api/habits/:id", async (req, res) => {
    try {
      await storage.deleteHabit(Number(req.params.id));
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  app.post("/api/habits/reorder", async (req, res) => {
    try {
      const ids: number[] = req.body?.ids ?? [];
      await storage.reorderHabits(ids);
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: (e as Error).message }); }
  });

  return httpServer;
}
