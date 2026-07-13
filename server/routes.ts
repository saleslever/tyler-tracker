import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import { insertDailyLogSchema, insertTaskSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Daily log routes ---

  app.get("/api/logs", async (_req, res) => {
    const logs = await storage.getAllLogs();
    res.json(logs);
  });

  app.get("/api/logs/:date", async (req, res) => {
    const log = await storage.getLog(req.params.date);
    res.json(log ?? null);
  });

  const patchLogSchema = insertDailyLogSchema.partial().omit({ date: true });

  app.patch("/api/logs/:date", async (req, res) => {
    try {
      const patch = patchLogSchema.parse(req.body);
      const log = await storage.upsertLog(req.params.date, patch);
      res.json(log);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --- Task routes ---

  app.get("/api/tasks", async (_req, res) => {
    const tasks = await storage.getTasks();
    res.json(tasks);
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const parsed = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(parsed);
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  const updateTaskSchema = z.object({
    title: z.string().optional(),
    list: z.enum(["today", "backlog"]).optional(),
    priority: z.enum(["high", "med", "low"]).optional(),
    completed: z.number().optional(),
    completedAt: z.string().nullable().optional(),
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    try {
      const patch = updateTaskSchema.parse(req.body);
      const task = await storage.updateTask(Number(req.params.id), patch);
      res.json(task);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    await storage.deleteTask(Number(req.params.id));
    res.json({ ok: true });
  });

  return httpServer;
}
