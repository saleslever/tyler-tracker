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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Reset (nukes everything)
  app.post("/api/reset", async (_req, res) => {
    await storage.resetAll();
    res.json({ ok: true });
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

  return httpServer;
}
