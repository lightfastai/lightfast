import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  boolean,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const PROVIDER_ROUTINE_CALL_ID_PREFIX = "provider_routine_call_";

const PUBLIC_ID_LENGTH = 80;
const CLERK_ID_LENGTH = 64;
const CALLER_ID_LENGTH = 128;
const CODE_LENGTH = 32;
const ROUTINE_NAME_LENGTH = 128;
const PROVIDER_REF_LENGTH = 128;
const ERROR_CODE_LENGTH = 64;
const SOURCE_REF_LENGTH = 128;

export type ProviderRoutineCallCalledByKind = "automation" | "system" | "user";
export type ProviderRoutineCallProvider = "linear" | "x";
export type ProviderRoutineCallSourceSurface =
  | "automation"
  | "hosted_mcp"
  | "native_cli"
  | "system";
export type ProviderRoutineCallStatus = "failed" | "running" | "succeeded";
export type ProviderRoutineCallRedactedPayload = Record<string, unknown> | null;

export function createProviderRoutineCallId() {
  return `${PROVIDER_ROUTINE_CALL_ID_PREFIX}${randomUUID()}`;
}

export const orgProviderRoutineCalls = mysqlTable(
  "lightfast_org_provider_routine_calls",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createProviderRoutineCallId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    calledByKind: varchar("called_by_kind", { length: CODE_LENGTH })
      .$type<ProviderRoutineCallCalledByKind>()
      .notNull(),

    calledById: varchar("called_by_id", { length: CALLER_ID_LENGTH }).notNull(),

    calledByUserId: varchar("called_by_user_id", {
      length: CLERK_ID_LENGTH,
    }),

    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<ProviderRoutineCallProvider>()
      .notNull(),

    routineId: varchar("routine_id", {
      length: ROUTINE_NAME_LENGTH,
    }).notNull(),

    providerToolName: varchar("provider_tool_name", {
      length: ROUTINE_NAME_LENGTH,
    }).notNull(),

    providerConnectionId: bigint("provider_connection_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    providerWorkspaceId: varchar("provider_workspace_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    providerActorId: varchar("provider_actor_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    providerAttempted: boolean("provider_attempted").default(false).notNull(),

    sourceSurface: varchar("source_surface", { length: CODE_LENGTH })
      .$type<ProviderRoutineCallSourceSurface>()
      .default("system")
      .notNull(),

    sourceRef: varchar("source_ref", { length: SOURCE_REF_LENGTH }),

    sourceClientId: varchar("source_client_id", { length: SOURCE_REF_LENGTH }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<ProviderRoutineCallStatus>()
      .notNull(),

    inputRedacted:
      json("input_redacted").$type<ProviderRoutineCallRedactedPayload>(),

    outputRedacted:
      json("output_redacted").$type<ProviderRoutineCallRedactedPayload>(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),

    finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_provider_routine_calls_public_id_uq").on(
      table.publicId
    ),
    orgCreatedIdx: index("org_provider_routine_calls_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    orgCallerCreatedIdx: index(
      "org_provider_routine_calls_org_caller_created_idx"
    ).on(
      table.clerkOrgId,
      table.calledByKind,
      table.calledById,
      table.createdAt,
      table.id
    ),
    connectionCreatedIdx: index(
      "org_provider_routine_calls_connection_created_idx"
    ).on(table.providerConnectionId, table.createdAt, table.id),
    providerRoutineCreatedIdx: index(
      "org_provider_routine_calls_provider_routine_created_idx"
    ).on(table.provider, table.routineId, table.createdAt, table.id),
  })
);

export type ProviderRoutineCall = typeof orgProviderRoutineCalls.$inferSelect;
export type InsertProviderRoutineCall =
  typeof orgProviderRoutineCalls.$inferInsert;
