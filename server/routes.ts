import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startBot, sendTaskToMember, approveMember, rejectMember, approvePayment } from "./bot";
import { insertTaskSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  startBot();

  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/members", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const members = status
        ? await storage.getMembersByStatus(status)
        : await storage.getAllMembers();
      res.json(members);
    } catch (e) {
      res.status(500).json({ error: "Failed to get members" });
    }
  });

  app.patch("/api/members/:telegramId/approve", async (req, res) => {
    try {
      await approveMember(req.params.telegramId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to approve member" });
    }
  });

  app.patch("/api/members/:telegramId/reject", async (req, res) => {
    try {
      await rejectMember(req.params.telegramId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to reject member" });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (e) {
      res.status(500).json({ error: "Failed to get tasks" });
    }
  });

  app.post("/api/tasks", async (req, res) => {
    try {
      const data = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(data);
      res.json(task);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/tasks/send-all", async (req, res) => {
    try {
      const { postLink, taskTypes, price, notes } = req.body;
      if (!postLink || !taskTypes || !price) {
        return res.status(400).json({ error: "postLink, taskTypes, price required" });
      }
      const approvedMembers = await storage.getMembersByStatus("approved");
      let sentCount = 0;
      for (const m of approvedMembers) {
        const task = await storage.createTask({
          postLink,
          taskTypes,
          price,
          notes: notes || null,
          assignedTo: m.telegramId,
          status: "pending",
        });
        const sent = await sendTaskToMember(m.telegramId, task.id);
        if (sent) sentCount++;
      }
      res.json({ sentCount, total: approvedMembers.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/tasks/:id/send", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      const { telegramId } = req.body;
      if (!telegramId) return res.status(400).json({ error: "telegramId required" });

      await storage.updateTask(taskId, { assignedTo: telegramId });
      const success = await sendTaskToMember(telegramId, taskId);
      res.json({ success });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const taskId = parseInt(req.params.id);
      await storage.deleteTask(taskId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/submissions", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const subs = status
        ? await storage.getSubmissionsByStatus(status)
        : await storage.getAllSubmissions();
      res.json(subs);
    } catch (e) {
      res.status(500).json({ error: "Failed to get submissions" });
    }
  });

  app.patch("/api/submissions/:id/approve", async (req, res) => {
    try {
      await approvePayment(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to approve payment" });
    }
  });

  app.patch("/api/submissions/:id/reject", async (req, res) => {
    try {
      const sub = await storage.updateSubmission(parseInt(req.params.id), { status: "rejected" });
      res.json({ success: true, sub });
    } catch (e) {
      res.status(500).json({ error: "Failed to reject submission" });
    }
  });

  return httpServer;
}
