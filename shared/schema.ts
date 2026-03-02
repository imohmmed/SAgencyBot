import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  accountLink: text("account_link"),
  screenshotFileId: text("screenshot_file_id"),
  status: text("status").notNull().default("pending"),
  balance: integer("balance").notNull().default(0),
  registrationStep: integer("registration_step").notNull().default(0),
  joinedAt: timestamp("joined_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  postLink: text("post_link").notNull(),
  assignedTo: text("assigned_to"),
  taskTypes: text("task_types").array().notNull().default(sql`'{}'::text[]`),
  price: integer("price").notNull().default(1000),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  sentAt: timestamp("sent_at"),
});

export const taskSubmissions = pgTable("task_submissions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  memberId: text("member_id").notNull(),
  workScreenshotFileId: text("work_screenshot_file_id"),
  accountScreenshotFileId: text("account_screenshot_file_id"),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const insertMemberSchema = createInsertSchema(members).omit({ id: true, joinedAt: true, approvedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, sentAt: true });
export const insertTaskSubmissionSchema = createInsertSchema(taskSubmissions).omit({ id: true, submittedAt: true, approvedAt: true });

export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type TaskSubmission = typeof taskSubmissions.$inferSelect;
export type InsertTaskSubmission = z.infer<typeof insertTaskSubmissionSchema>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
