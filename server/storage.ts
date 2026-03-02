import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, and, sql } from "drizzle-orm";
import pg from "pg";
import {
  members, tasks, taskSubmissions,
  type Member, type InsertMember,
  type Task, type InsertTask,
  type TaskSubmission, type InsertTaskSubmission,
} from "@shared/schema";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export interface IStorage {
  getMember(telegramId: string): Promise<Member | undefined>;
  getAllMembers(): Promise<Member[]>;
  createMember(member: InsertMember): Promise<Member>;
  updateMember(telegramId: string, data: Partial<Member>): Promise<Member | undefined>;
  getMembersByStatus(status: string): Promise<Member[]>;

  getTask(id: number): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: number, data: Partial<Task>): Promise<Task | undefined>;
  deleteTask(id: number): Promise<void>;
  getTasksForMember(telegramId: string): Promise<Task[]>;

  getSubmission(taskId: number, memberId: string): Promise<TaskSubmission | undefined>;
  getSubmissionById(id: number): Promise<TaskSubmission | undefined>;
  getAllSubmissions(): Promise<TaskSubmission[]>;
  createSubmission(submission: InsertTaskSubmission): Promise<TaskSubmission>;
  updateSubmission(id: number, data: Partial<TaskSubmission>): Promise<TaskSubmission | undefined>;
  getSubmissionsByStatus(status: string): Promise<TaskSubmission[]>;
  getStats(): Promise<{ totalMembers: number; approvedMembers: number; pendingMembers: number; totalTasks: number; completedTasks: number; pendingPayments: number; totalPaid: number }>;
}

class DbStorage implements IStorage {
  async getMember(telegramId: string): Promise<Member | undefined> {
    const [m] = await db.select().from(members).where(eq(members.telegramId, telegramId));
    return m;
  }

  async getAllMembers(): Promise<Member[]> {
    return db.select().from(members).orderBy(desc(members.joinedAt));
  }

  async createMember(member: InsertMember): Promise<Member> {
    const [m] = await db.insert(members).values(member).returning();
    return m;
  }

  async updateMember(telegramId: string, data: Partial<Member>): Promise<Member | undefined> {
    const [m] = await db.update(members).set(data).where(eq(members.telegramId, telegramId)).returning();
    return m;
  }

  async getMembersByStatus(status: string): Promise<Member[]> {
    return db.select().from(members).where(eq(members.status, status)).orderBy(desc(members.joinedAt));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [t] = await db.select().from(tasks).where(eq(tasks.id, id));
    return t;
  }

  async getAllTasks(): Promise<Task[]> {
    return db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [t] = await db.insert(tasks).values(task).returning();
    return t;
  }

  async updateTask(id: number, data: Partial<Task>): Promise<Task | undefined> {
    const [t] = await db.update(tasks).set(data).where(eq(tasks.id, id)).returning();
    return t;
  }

  async deleteTask(id: number): Promise<void> {
    await db.delete(taskSubmissions).where(eq(taskSubmissions.taskId, id));
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getTasksForMember(telegramId: string): Promise<Task[]> {
    return db.select().from(tasks)
      .where(and(eq(tasks.assignedTo, telegramId), eq(tasks.status, "sent")))
      .orderBy(desc(tasks.sentAt));
  }

  async getSubmission(taskId: number, memberId: string): Promise<TaskSubmission | undefined> {
    const [s] = await db.select().from(taskSubmissions)
      .where(and(eq(taskSubmissions.taskId, taskId), eq(taskSubmissions.memberId, memberId)));
    return s;
  }

  async getSubmissionById(id: number): Promise<TaskSubmission | undefined> {
    const [s] = await db.select().from(taskSubmissions).where(eq(taskSubmissions.id, id));
    return s;
  }

  async getAllSubmissions(): Promise<TaskSubmission[]> {
    return db.select().from(taskSubmissions).orderBy(desc(taskSubmissions.submittedAt));
  }

  async createSubmission(submission: InsertTaskSubmission): Promise<TaskSubmission> {
    const [s] = await db.insert(taskSubmissions).values(submission).returning();
    return s;
  }

  async updateSubmission(id: number, data: Partial<TaskSubmission>): Promise<TaskSubmission | undefined> {
    const [s] = await db.update(taskSubmissions).set(data).where(eq(taskSubmissions.id, id)).returning();
    return s;
  }

  async getSubmissionsByStatus(status: string): Promise<TaskSubmission[]> {
    return db.select().from(taskSubmissions).where(eq(taskSubmissions.status, status)).orderBy(desc(taskSubmissions.submittedAt));
  }

  async getStats() {
    const allMembers = await db.select().from(members);
    const allTasks = await db.select().from(tasks);
    const allSubs = await db.select().from(taskSubmissions);

    const approved = allMembers.filter(m => m.status === "approved");
    const pending = allMembers.filter(m => m.status === "pending");
    const completed = allSubs.filter(s => s.status === "approved");
    const pendingPay = allSubs.filter(s => s.status === "pending");

    const totalPaid = allMembers.reduce((sum, m) => sum + m.balance, 0);

    return {
      totalMembers: allMembers.length,
      approvedMembers: approved.length,
      pendingMembers: pending.length,
      totalTasks: allTasks.length,
      completedTasks: completed.length,
      pendingPayments: pendingPay.length,
      totalPaid,
    };
  }
}

export const storage = new DbStorage();
