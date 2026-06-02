import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const INTEGRATION_CALL_ID_PREFIX = "integration_call_";

const PUBLIC_ID_LENGTH = 80;
const CLERK_ID_LENGTH = 64;
const CALLER_ID_LENGTH = 128;
const CODE_LENGTH = 32;
const ROUTINE_NAME_LENGTH = 128;
const PROVIDER_REF_LENGTH = 128;
const ERROR_CODE_LENGTH = 64;

export type IntegrationCallCalledByKind = "automation" | "system" | "user";
export type IntegrationCallProvider = "linear";
export type IntegrationCallStatus = "failed" | "running" | "succeeded";
export type IntegrationCallRedactedPayload = Record<string, unknown> | null;

export function createIntegrationCallId() {
  return `${INTEGRATION_CALL_ID_PREFIX}${randomUUID()}`;
}

export const integrationCalls = mysqlTable(
  "lightfast_integration_calls",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createIntegrationCallId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    calledByKind: varchar("called_by_kind", { length: CODE_LENGTH })
      .$type<IntegrationCallCalledByKind>()
      .notNull(),

    calledById: varchar("called_by_id", { length: CALLER_ID_LENGTH }).notNull(),

    calledByUserId: varchar("called_by_user_id", {
      length: CLERK_ID_LENGTH,
    }),

    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<IntegrationCallProvider>()
      .notNull(),

    routineName: varchar("routine_name", {
      length: ROUTINE_NAME_LENGTH,
    }).notNull(),

    providerToolName: varchar("provider_tool_name", {
      length: ROUTINE_NAME_LENGTH,
    }).notNull(),

    connectorConnectionId: bigint("connector_connection_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    providerWorkspaceId: varchar("provider_workspace_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    providerActorId: varchar("provider_actor_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<IntegrationCallStatus>()
      .notNull(),

    inputRedacted:
      json("input_redacted").$type<IntegrationCallRedactedPayload>(),

    outputRedacted:
      json("output_redacted").$type<IntegrationCallRedactedPayload>(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    startedAt: timestamp("started_at", { mode: "date", fsp: 3 }).notNull(),

    finishedAt: timestamp("finished_at", { mode: "date", fsp: 3 }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("integration_calls_public_id_uq").on(
      table.publicId
    ),
    orgCreatedIdx: index("integration_calls_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    orgCallerCreatedIdx: index("integration_calls_org_caller_created_idx").on(
      table.clerkOrgId,
      table.calledByKind,
      table.calledById,
      table.createdAt,
      table.id
    ),
    connectionCreatedIdx: index("integration_calls_connection_created_idx").on(
      table.connectorConnectionId,
      table.createdAt,
      table.id
    ),
    providerRoutineCreatedIdx: index(
      "integration_calls_provider_routine_created_idx"
    ).on(table.provider, table.routineName, table.createdAt, table.id),
  })
);

export type IntegrationCall = typeof integrationCalls.$inferSelect;
export type InsertIntegrationCall = typeof integrationCalls.$inferInsert;
