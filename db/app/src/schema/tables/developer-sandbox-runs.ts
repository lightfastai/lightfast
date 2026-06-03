import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const DEVELOPER_SANDBOX_RUN_ID_PREFIX = "developer_sandbox_run_";
export const DEVELOPER_SANDBOX_COMMAND_ID_PREFIX = "developer_sandbox_command_";

const PUBLIC_ID_LENGTH = 96;
const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const COMMAND_LENGTH = 256;
const CWD_LENGTH = 512;
const REASON_LENGTH = 512;

export type DeveloperSandboxRunStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "expired"
  | "failed";

export type DeveloperSandboxCommandStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "blocked"
  | "timed_out";

export type DeveloperSandboxCommandPolicyDecision = "allowed" | "denied";

export function createDeveloperSandboxRunId() {
  return `${DEVELOPER_SANDBOX_RUN_ID_PREFIX}${randomUUID()}`;
}

export function createDeveloperSandboxCommandId() {
  return `${DEVELOPER_SANDBOX_COMMAND_ID_PREFIX}${randomUUID()}`;
}

export const orgDeveloperSandboxRuns = mysqlTable(
  "lightfast_org_developer_sandbox_runs",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperSandboxRunId),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    actorUserId: varchar("actor_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    workflowRunId: varchar("workflow_run_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    vercelSandboxId: varchar("vercel_sandbox_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperSandboxRunStatus>()
      .notNull(),
    credentialsLoadedAt: datetime("credentials_loaded_at", {
      mode: "date",
      fsp: 3,
    }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    stoppedAt: datetime("stopped_at", { mode: "date", fsp: 3 }),
    cleanupAttemptedAt: datetime("cleanup_attempted_at", {
      mode: "date",
      fsp: 3,
    }),
    cleanupFailureCode: varchar("cleanup_failure_code", {
      length: CODE_LENGTH,
    }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    // Keep update semantics in Drizzle runtime because drizzle-kit emits an
    // invalid Vitess DDL clause for datetime(3) ON UPDATE.
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("developer_sandbox_runs_public_id_uq").on(
      table.publicId
    ),
    orgActorStatusIdx: index("developer_sandbox_runs_org_actor_status_idx").on(
      table.clerkOrgId,
      table.actorUserId,
      table.status
    ),
    expiresStatusIdx: index("developer_sandbox_runs_expires_status_idx").on(
      table.expiresAt,
      table.status
    ),
  })
);

export const orgDeveloperSandboxCommands = mysqlTable(
  "lightfast_org_developer_sandbox_commands",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperSandboxCommandId),
    sandboxRunId: bigint("sandbox_run_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    actorUserId: varchar("actor_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    cmd: varchar("cmd", { length: COMMAND_LENGTH }).notNull(),
    args: json("args").$type<string[]>().notNull(),
    cwd: varchar("cwd", { length: CWD_LENGTH }),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperSandboxCommandStatus>()
      .notNull(),
    policyDecision: varchar("policy_decision", { length: CODE_LENGTH })
      .$type<DeveloperSandboxCommandPolicyDecision>()
      .notNull(),
    policyRuleId: varchar("policy_rule_id", { length: PROVIDER_REF_LENGTH }),
    policyReason: varchar("policy_reason", { length: REASON_LENGTH }),
    exitCode: int("exit_code"),
    stdoutBytes: int("stdout_bytes", { unsigned: true }).default(0).notNull(),
    stderrBytes: int("stderr_bytes", { unsigned: true }).default(0).notNull(),
    redactionCount: int("redaction_count", { unsigned: true })
      .default(0)
      .notNull(),
    startedAt: datetime("started_at", { mode: "date", fsp: 3 }),
    finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    // Keep update semantics in Drizzle runtime because drizzle-kit emits an
    // invalid Vitess DDL clause for datetime(3) ON UPDATE.
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("developer_sandbox_commands_public_id_uq").on(
      table.publicId
    ),
    runStatusIdx: index("developer_sandbox_commands_run_status_idx").on(
      table.sandboxRunId,
      table.status
    ),
    orgActorCreatedIdx: index(
      "developer_sandbox_commands_org_actor_created_idx"
    ).on(table.clerkOrgId, table.actorUserId, table.createdAt),
  })
);

export type DeveloperSandboxRun = typeof orgDeveloperSandboxRuns.$inferSelect;
export type InsertDeveloperSandboxRun =
  typeof orgDeveloperSandboxRuns.$inferInsert;
export type DeveloperSandboxCommand =
  typeof orgDeveloperSandboxCommands.$inferSelect;
export type InsertDeveloperSandboxCommand =
  typeof orgDeveloperSandboxCommands.$inferInsert;
