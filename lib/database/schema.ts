import { index, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { JobEvent } from "./events";

// Thread status enum
export const threadStatusEnum = mysqlEnum("status", ["active", "completed", "error"]);

// Job status enum
export const jobStatusEnum = mysqlEnum("status", ["pending", "running", "completed", "failed"]);

// Thread table - represents a conversation/chat
export const threads = mysqlTable("threads", {
	id: varchar("id", { length: 255 }).primaryKey(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
	status: threadStatusEnum.notNull().default("active"),
	metadata: json("metadata"),
}, (table) => [
	index("threads_created_at_idx").on(table.createdAt),
	index("threads_status_idx").on(table.status),
]);

// Job table - represents a task execution within a thread
export const jobs = mysqlTable("jobs", {
	id: varchar("id", { length: 255 }).primaryKey(),
	threadId: varchar("thread_id", { length: 255 }).notNull(),
	taskDescription: text("task_description").notNull(),
	status: jobStatusEnum.notNull().default("pending"),
	events: json("events").$type<JobEvent[]>().default([]).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	startedAt: timestamp("started_at"),
	completedAt: timestamp("completed_at"),
	error: text("error"),
	result: json("result"),
}, (table) => [
	index("jobs_thread_id_idx").on(table.threadId),
	index("jobs_status_idx").on(table.status),
	index("jobs_created_at_idx").on(table.createdAt),
]);

// Type exports
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;