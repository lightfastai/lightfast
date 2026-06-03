import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export type NamespaceKind = "user" | "org";
export type NamespaceStatus = "reserved" | "active";
export type NamespaceOperationType =
  | "create_user_username"
  | "create_org_slug"
  | "backfill_existing_handle";
export type NamespaceOperationStatus =
  | "started"
  | "namespace_reserved"
  | "clerk_applied"
  | "finalized"
  | "failed"
  | "compensating";

const HANDLE_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const CODE_LENGTH = 48;
const IDEMPOTENCY_KEY_LENGTH = 128;
const ERROR_CODE_LENGTH = 64;
const ERROR_MESSAGE_LENGTH = 512;

export const systemNamespaces = mysqlTable(
  "lightfast_system_namespaces",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    handle: varchar("handle", { length: HANDLE_LENGTH }).notNull(),
    kind: varchar("kind", { length: CODE_LENGTH })
      .$type<NamespaceKind>()
      .notNull(),
    clerkUserId: varchar("clerk_user_id", { length: CLERK_ID_LENGTH }),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }),
    claimedClerkUserId: varchar("claimed_clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }),
    claimedClerkOrgId: varchar("claimed_clerk_org_id", {
      length: CLERK_ID_LENGTH,
    }),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<NamespaceStatus>()
      .notNull(),
    activeOperationId: bigint("active_operation_id", {
      mode: "number",
      unsigned: true,
    }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    activeOperationUq: uniqueIndex("system_namespaces_active_operation_uq").on(
      table.activeOperationId
    ),
    claimedOrgUq: uniqueIndex("system_namespaces_claimed_org_uq").on(
      table.claimedClerkOrgId
    ),
    claimedUserUq: uniqueIndex("system_namespaces_claimed_user_uq").on(
      table.claimedClerkUserId
    ),
    handleUq: uniqueIndex("system_namespaces_handle_uq").on(table.handle),
    orgIdx: index("system_namespaces_org_idx").on(table.clerkOrgId, table.status),
    userIdx: index("system_namespaces_user_idx").on(table.clerkUserId, table.status),
  })
);

export const systemNamespaceOperations = mysqlTable(
  "lightfast_system_namespace_operations",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    operationType: varchar("operation_type", { length: CODE_LENGTH })
      .$type<NamespaceOperationType>()
      .notNull(),
    ownerKind: varchar("owner_kind", { length: CODE_LENGTH })
      .$type<NamespaceKind>()
      .notNull(),
    clerkUserId: varchar("clerk_user_id", { length: CLERK_ID_LENGTH }),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }),
    idempotencyClerkUserId: varchar("idempotency_clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }),
    idempotencyClerkOrgId: varchar("idempotency_clerk_org_id", {
      length: CLERK_ID_LENGTH,
    }),
    fromHandle: varchar("from_handle", { length: HANDLE_LENGTH }),
    toHandle: varchar("to_handle", { length: HANDLE_LENGTH }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<NamespaceOperationStatus>()
      .notNull(),
    idempotencyKey: varchar("idempotency_key", {
      length: IDEMPOTENCY_KEY_LENGTH,
    }).notNull(),
    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),
    errorMessage: varchar("error_message", { length: ERROR_MESSAGE_LENGTH }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
  },
  (table) => ({
    orgIdempotencyUq: uniqueIndex("system_namespace_operations_org_idempotency_uq").on(
      table.idempotencyClerkOrgId,
      table.operationType,
      table.idempotencyKey
    ),
    orgIdx: index("system_namespace_operations_org_idx").on(
      table.clerkOrgId,
      table.status
    ),
    statusIdx: index("system_namespace_operations_status_idx").on(
      table.status,
      table.updatedAt
    ),
    userIdempotencyUq: uniqueIndex(
      "system_namespace_operations_user_idempotency_uq"
    ).on(
      table.idempotencyClerkUserId,
      table.operationType,
      table.idempotencyKey
    ),
    userIdx: index("system_namespace_operations_user_idx").on(
      table.clerkUserId,
      table.status
    ),
  })
);

export type Namespace = typeof systemNamespaces.$inferSelect;
export type InsertNamespace = typeof systemNamespaces.$inferInsert;
export type NamespaceOperation = typeof systemNamespaceOperations.$inferSelect;
export type InsertNamespaceOperation = typeof systemNamespaceOperations.$inferInsert;
