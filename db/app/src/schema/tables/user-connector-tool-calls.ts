import { randomUUID } from "node:crypto";
import type { UserConnectorProvider } from "@repo/connector-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const USER_CONNECTOR_TOOL_CALL_ID_PREFIX = "user_connector_tool_call_";

const PUBLIC_ID_LENGTH = 80;
const CLERK_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const ROUTINE_NAME_LENGTH = 128;
const ERROR_CODE_LENGTH = 64;
const SOURCE_REF_LENGTH = 128;

export type UserConnectorToolCallSourceSurface = "interactive_chat";
export type UserConnectorToolCallStatus = "failed" | "running" | "succeeded";
export type UserConnectorToolCallRedactedPayload = Record<
  string,
  unknown
> | null;

export function createUserConnectorToolCallId() {
  return `${USER_CONNECTOR_TOOL_CALL_ID_PREFIX}${randomUUID()}`;
}

export const userConnectorToolCalls = mysqlTable(
  "lightfast_user_connector_tool_calls",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createUserConnectorToolCallId),

    calledByUserId: varchar("called_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }),

    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<UserConnectorProvider>()
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

    providerAttempted: boolean("provider_attempted").default(false).notNull(),

    sourceSurface: varchar("source_surface", { length: CODE_LENGTH })
      .$type<UserConnectorToolCallSourceSurface>()
      .default("interactive_chat")
      .notNull(),

    sourceRef: varchar("source_ref", { length: SOURCE_REF_LENGTH }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<UserConnectorToolCallStatus>()
      .notNull(),

    inputRedacted:
      json("input_redacted").$type<UserConnectorToolCallRedactedPayload>(),

    outputRedacted:
      json("output_redacted").$type<UserConnectorToolCallRedactedPayload>(),

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
    publicIdUq: uniqueIndex("user_connector_tool_calls_public_id_uq").on(
      table.publicId
    ),
    userCreatedIdx: index("user_connector_tool_calls_user_created_idx").on(
      table.calledByUserId,
      table.createdAt,
      table.id
    ),
    orgCreatedIdx: index("user_connector_tool_calls_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    connectionCreatedIdx: index(
      "user_connector_tool_calls_connection_created_idx"
    ).on(table.providerConnectionId, table.createdAt, table.id),
    providerRoutineCreatedIdx: index(
      "user_connector_tool_calls_provider_routine_created_idx"
    ).on(table.provider, table.routineId, table.createdAt, table.id),
  })
);

export type UserConnectorToolCall = typeof userConnectorToolCalls.$inferSelect;
export type InsertUserConnectorToolCall =
  typeof userConnectorToolCalls.$inferInsert;
