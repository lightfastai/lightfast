import { randomUUID } from "node:crypto";
import type { LightfastWorkspaceAssistantMessagePart } from "@repo/ai/workspace-assistant";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const PUBLIC_ID_LENGTH = 80;
const CLERK_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const MODEL_LENGTH = 128;
const TITLE_LENGTH = 160;
const IDEMPOTENCY_KEY_LENGTH = 128;
const STREAM_ID_LENGTH = 80;
const TOOL_CALL_ID_LENGTH = 128;
const TOOL_NAME_LENGTH = 128;
const SOURCE_ID_LENGTH = 128;
const SOURCE_SLUG_LENGTH = 128;
const ERROR_CODE_LENGTH = 64;

export const WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX = "conv_";
export const WORKSPACE_ASSISTANT_MESSAGE_ID_PREFIX = "msg_";
export const WORKSPACE_ASSISTANT_GENERATION_ID_PREFIX = "gen_";
export const WORKSPACE_ASSISTANT_STREAM_ID_PREFIX = "stream_";
export const WORKSPACE_ASSISTANT_TOOL_CALL_ID_PREFIX = "tool_";
export const WORKSPACE_ASSISTANT_CONTEXT_ITEM_ID_PREFIX = "ctx_";

export type WorkspaceAssistantConversationStatus =
  | "active"
  | "archived"
  | "deleted";
export type WorkspaceAssistantMessageRole = "system" | "user" | "assistant";
export type WorkspaceAssistantMessageStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";
export type WorkspaceAssistantGenerationStatus =
  WorkspaceAssistantMessageStatus;
export type WorkspaceAssistantToolCallStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";
export type WorkspaceAssistantContextItemKind =
  | "skill"
  | "signal"
  | "person"
  | "automation"
  | "custom";

export type WorkspaceAssistantRecordMetadata = Record<string, unknown>;
export type WorkspaceAssistantMessagePart =
  LightfastWorkspaceAssistantMessagePart;
export type WorkspaceAssistantGenerationUsage = Record<string, unknown>;
export type WorkspaceAssistantToolPayload = Record<string, unknown> | null;
export type WorkspaceAssistantContextSnapshot = Record<string, unknown>;

export function createWorkspaceAssistantConversationId() {
  return `${WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX}${randomUUID()}`;
}

export function createWorkspaceAssistantMessageId() {
  return `${WORKSPACE_ASSISTANT_MESSAGE_ID_PREFIX}${randomUUID()}`;
}

export function createWorkspaceAssistantGenerationId() {
  return `${WORKSPACE_ASSISTANT_GENERATION_ID_PREFIX}${randomUUID()}`;
}

export function createWorkspaceAssistantStreamId() {
  return `${WORKSPACE_ASSISTANT_STREAM_ID_PREFIX}${randomUUID()}`;
}

export function createWorkspaceAssistantToolCallId() {
  return `${WORKSPACE_ASSISTANT_TOOL_CALL_ID_PREFIX}${randomUUID()}`;
}

export function createWorkspaceAssistantContextItemId() {
  return `${WORKSPACE_ASSISTANT_CONTEXT_ITEM_ID_PREFIX}${randomUUID()}`;
}

export const orgWorkspaceAssistantConversations = mysqlTable(
  "lightfast_org_workspace_assistant_conversations",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createWorkspaceAssistantConversationId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    title: varchar("title", { length: TITLE_LENGTH }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<WorkspaceAssistantConversationStatus>()
      .default("active")
      .notNull(),

    activeStreamId: varchar("active_stream_id", { length: STREAM_ID_LENGTH }),

    lastMessageId: bigint("last_message_id", {
      mode: "number",
      unsigned: true,
    }),

    lastMessageAt: datetime("last_message_at", { mode: "date", fsp: 3 }),

    metadata: json("metadata")
      .$type<WorkspaceAssistantRecordMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex(
      "org_workspace_assistant_conversations_public_id_uq"
    ).on(table.publicId),
    orgUserStatusUpdatedIdx: index(
      "org_workspace_assistant_conversations_user_status_updated_idx"
    ).on(
      table.clerkOrgId,
      table.createdByUserId,
      table.status,
      table.updatedAt,
      table.id
    ),
    orgCreatedIdx: index(
      "org_workspace_assistant_conversations_org_created_idx"
    ).on(table.clerkOrgId, table.createdAt, table.id),
  })
);

export const orgWorkspaceAssistantMessages = mysqlTable(
  "lightfast_org_workspace_assistant_messages",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createWorkspaceAssistantMessageId),

    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    conversationPublicId: varchar("conversation_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    role: varchar("role", { length: CODE_LENGTH })
      .$type<WorkspaceAssistantMessageRole>()
      .notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<WorkspaceAssistantMessageStatus>()
      .default("completed")
      .notNull(),

    sequence: int("sequence", { unsigned: true }).notNull(),

    idempotencyKey: varchar("idempotency_key", {
      length: IDEMPOTENCY_KEY_LENGTH,
    }),

    parts: json("parts")
      .$type<WorkspaceAssistantMessagePart[]>()
      .default(sql`(JSON_ARRAY())`)
      .notNull(),

    metadata: json("metadata")
      .$type<WorkspaceAssistantRecordMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_workspace_assistant_messages_public_id_uq").on(
      table.publicId
    ),
    conversationSequenceUq: uniqueIndex(
      "org_workspace_assistant_messages_conversation_sequence_uq"
    ).on(table.conversationId, table.sequence),
    conversationIdempotencyKeyUq: uniqueIndex(
      "org_workspace_assistant_messages_conv_idempotency_key_uq"
    ).on(table.conversationId, table.idempotencyKey),
    conversationCreatedIdx: index(
      "org_workspace_assistant_messages_conversation_created_idx"
    ).on(table.conversationId, table.createdAt, table.id),
    orgUserConversationSequenceIdx: index(
      "org_workspace_assistant_messages_user_conversation_sequence_idx"
    ).on(
      table.clerkOrgId,
      table.createdByUserId,
      table.conversationId,
      table.sequence,
      table.id
    ),
    orgCreatedIdx: index("org_workspace_assistant_messages_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
  })
);

export const orgWorkspaceAssistantGenerations = mysqlTable(
  "lightfast_org_workspace_assistant_generations",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createWorkspaceAssistantGenerationId),

    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    assistantMessageId: bigint("assistant_message_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    assistantMessagePublicId: varchar("assistant_message_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    requestedByUserId: varchar("requested_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    model: varchar("model", { length: MODEL_LENGTH }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<WorkspaceAssistantGenerationStatus>()
      .default("pending")
      .notNull(),

    finishReason: varchar("finish_reason", { length: CODE_LENGTH }),

    usage: json("usage").$type<WorkspaceAssistantGenerationUsage | null>(),

    providerMetadata: json("provider_metadata")
      .$type<WorkspaceAssistantRecordMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    requestMetadata: json("request_metadata")
      .$type<WorkspaceAssistantRecordMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    startedAt: datetime("started_at", { mode: "date", fsp: 3 }),

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
    publicIdUq: uniqueIndex(
      "org_workspace_assistant_generations_public_id_uq"
    ).on(table.publicId),
    assistantMessageUq: uniqueIndex(
      "org_workspace_assistant_generations_assistant_message_uq"
    ).on(table.assistantMessageId),
    orgStatusIdx: index(
      "org_workspace_assistant_generations_org_status_idx"
    ).on(table.clerkOrgId, table.status, table.createdAt, table.id),
    orgUserStatusIdx: index(
      "org_workspace_assistant_generations_org_user_status_idx"
    ).on(
      table.clerkOrgId,
      table.requestedByUserId,
      table.status,
      table.createdAt,
      table.id
    ),
    conversationCreatedIdx: index(
      "org_workspace_assistant_generations_conversation_created_idx"
    ).on(table.conversationId, table.createdAt, table.id),
  })
);

export const orgWorkspaceAssistantToolCalls = mysqlTable(
  "lightfast_org_workspace_assistant_tool_calls",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createWorkspaceAssistantToolCallId),

    generationId: bigint("generation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    generationPublicId: varchar("generation_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    messageId: bigint("message_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    toolCallId: varchar("tool_call_id", {
      length: TOOL_CALL_ID_LENGTH,
    }).notNull(),

    toolName: varchar("tool_name", { length: TOOL_NAME_LENGTH }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<WorkspaceAssistantToolCallStatus>()
      .default("pending")
      .notNull(),

    input: json("input")
      .$type<WorkspaceAssistantToolPayload>()
      .default(sql`(JSON_OBJECT())`),

    output: json("output").$type<WorkspaceAssistantToolPayload>(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    startedAt: datetime("started_at", { mode: "date", fsp: 3 }),

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
    publicIdUq: uniqueIndex(
      "org_workspace_assistant_tool_calls_public_id_uq"
    ).on(table.publicId),
    generationToolCallUq: uniqueIndex(
      "org_workspace_assistant_tool_calls_generation_tool_call_uq"
    ).on(table.generationId, table.toolCallId),
    messageIdx: index("org_workspace_assistant_tool_calls_message_idx").on(
      table.messageId,
      table.createdAt,
      table.id
    ),
    orgCreatedIdx: index(
      "org_workspace_assistant_tool_calls_org_created_idx"
    ).on(table.clerkOrgId, table.createdAt, table.id),
  })
);

export const orgWorkspaceAssistantContextItems = mysqlTable(
  "lightfast_org_workspace_assistant_context_items",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createWorkspaceAssistantContextItemId),

    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    messageId: bigint("message_id", {
      mode: "number",
      unsigned: true,
    }),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    kind: varchar("kind", { length: CODE_LENGTH })
      .$type<WorkspaceAssistantContextItemKind>()
      .notNull(),

    sourcePublicId: varchar("source_public_id", { length: SOURCE_ID_LENGTH }),

    sourceSlug: varchar("source_slug", { length: SOURCE_SLUG_LENGTH }),

    title: varchar("title", { length: TITLE_LENGTH }),

    snapshot: json("snapshot")
      .$type<WorkspaceAssistantContextSnapshot>()
      .notNull(),

    metadata: json("metadata")
      .$type<WorkspaceAssistantRecordMetadata>()
      .default(sql`(JSON_OBJECT())`)
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex(
      "org_workspace_assistant_context_items_public_id_uq"
    ).on(table.publicId),
    conversationKindIdx: index(
      "org_workspace_assistant_context_items_conversation_kind_idx"
    ).on(table.conversationId, table.kind, table.id),
    messageKindIdx: index(
      "org_workspace_assistant_context_items_message_kind_idx"
    ).on(table.messageId, table.kind, table.id),
    orgCreatedIdx: index(
      "org_workspace_assistant_context_items_org_created_idx"
    ).on(table.clerkOrgId, table.createdAt, table.id),
  })
);

export type WorkspaceAssistantConversation =
  typeof orgWorkspaceAssistantConversations.$inferSelect;
export type InsertWorkspaceAssistantConversation =
  typeof orgWorkspaceAssistantConversations.$inferInsert;
export type WorkspaceAssistantMessage =
  typeof orgWorkspaceAssistantMessages.$inferSelect;
export type InsertWorkspaceAssistantMessage =
  typeof orgWorkspaceAssistantMessages.$inferInsert;
export type WorkspaceAssistantGeneration =
  typeof orgWorkspaceAssistantGenerations.$inferSelect;
export type InsertWorkspaceAssistantGeneration =
  typeof orgWorkspaceAssistantGenerations.$inferInsert;
export type WorkspaceAssistantToolCall =
  typeof orgWorkspaceAssistantToolCalls.$inferSelect;
export type InsertWorkspaceAssistantToolCall =
  typeof orgWorkspaceAssistantToolCalls.$inferInsert;
export type WorkspaceAssistantContextItem =
  typeof orgWorkspaceAssistantContextItems.$inferSelect;
export type InsertWorkspaceAssistantContextItem =
  typeof orgWorkspaceAssistantContextItems.$inferInsert;
