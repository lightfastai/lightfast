import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const AUTOMATION_ID_PREFIX = "automation_";
export const AUTOMATION_RUN_ID_PREFIX = "automation_run_";

const PUBLIC_ID_LENGTH = 80;
const CLERK_ID_LENGTH = 64;
const NAME_LENGTH = 120;
const CODE_LENGTH = 32;
const TIMEZONE_LENGTH = 64;
const IDEMPOTENCY_KEY_LENGTH = 255;
const ERROR_CODE_LENGTH = 64;

export type AutomationStatus = "active" | "paused" | "deleted";
export type AutomationScheduleKind = "hourly" | "daily";
export type AutomationScheduleConfig =
  | { intervalHours: number }
  | { time: string };
export type AutomationRunTrigger = "scheduled" | "manual";
export type AutomationRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export function createAutomationId() {
  return `${AUTOMATION_ID_PREFIX}${randomUUID()}`;
}

export function createAutomationRunId() {
  return `${AUTOMATION_RUN_ID_PREFIX}${randomUUID()}`;
}

export const automations = mysqlTable(
  "lightfast_automations",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createAutomationId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    name: varchar("name", { length: NAME_LENGTH }).notNull(),

    prompt: text("prompt").notNull(),

    scheduleKind: varchar("schedule_kind", { length: CODE_LENGTH })
      .$type<AutomationScheduleKind>()
      .notNull(),

    scheduleConfig: json("schedule_config")
      .$type<AutomationScheduleConfig>()
      .notNull(),

    timezone: varchar("timezone", { length: TIMEZONE_LENGTH })
      .default("UTC")
      .notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<AutomationStatus>()
      .notNull(),

    nextRunAt: datetime("next_run_at", { mode: "date", fsp: 3 }).notNull(),

    lastRunAt: datetime("last_run_at", { mode: "date", fsp: 3 }),

    scheduleVersion: int("schedule_version", { unsigned: true })
      .default(1)
      .notNull(),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("automations_public_id_uq").on(table.publicId),
    orgStatusNextRunIdx: index("automations_org_status_next_run_idx").on(
      table.clerkOrgId,
      table.status,
      table.nextRunAt,
      table.id
    ),
    dueIdx: index("automations_due_idx").on(
      table.status,
      table.nextRunAt,
      table.id
    ),
  })
);

export const automationRuns = mysqlTable(
  "lightfast_automation_runs",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createAutomationRunId),

    automationId: bigint("automation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    automationPublicId: varchar("automation_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    trigger: varchar("trigger", { length: CODE_LENGTH })
      .$type<AutomationRunTrigger>()
      .notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<AutomationRunStatus>()
      .notNull(),

    dueAt: datetime("due_at", { mode: "date", fsp: 3 }).notNull(),

    startedAt: datetime("started_at", { mode: "date", fsp: 3 }),

    finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),

    scheduleVersion: int("schedule_version", { unsigned: true }).notNull(),

    idempotencyKey: varchar("idempotency_key", {
      length: IDEMPOTENCY_KEY_LENGTH,
    }).notNull(),

    output: json("output").$type<Record<string, unknown> | null>(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("automation_runs_public_id_uq").on(table.publicId),
    idempotencyKeyUq: uniqueIndex("automation_runs_idempotency_key_uq").on(
      table.idempotencyKey
    ),
    automationCreatedIdx: index("automation_runs_automation_created_idx").on(
      table.automationPublicId,
      table.createdAt,
      table.id
    ),
    orgStatusCreatedIdx: index("automation_runs_org_status_created_idx").on(
      table.clerkOrgId,
      table.status,
      table.createdAt,
      table.id
    ),
  })
);

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = typeof automations.$inferInsert;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type InsertAutomationRun = typeof automationRuns.$inferInsert;
