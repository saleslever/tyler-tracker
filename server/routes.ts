import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  insertDailyLogSchema,
  insertTaskSchema,
  insertJournalSchema,
  insertGoalSchema,
  insertChallengeSchema,
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

  return httpServer;
}
