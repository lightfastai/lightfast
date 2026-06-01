import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  mysqlTable,
  timestamp,
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

export const namespaces = mysqlTable(
  "lightfast_namespaces",
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
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    activeOperationUq: uniqueIndex("namespaces_active_operation_uq").on(
      table.activeOperationId
    ),
    claimedOrgUq: uniqueIndex("namespaces_claimed_org_uq").on(
      table.claimedClerkOrgId
    ),
    claimedUserUq: uniqueIndex("namespaces_claimed_user_uq").on(
      table.claimedClerkUserId
    ),
    handleUq: uniqueIndex("namespaces_handle_uq").on(table.handle),
    orgIdx: index("namespaces_org_idx").on(table.clerkOrgId, table.status),
    userIdx: index("namespaces_user_idx").on(table.clerkUserId, table.status),
  })
);

export const namespaceOperations = mysqlTable(
  "lightfast_namespace_operations",
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
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }),
  },
  (table) => ({
    orgIdempotencyUq: uniqueIndex("namespace_operations_org_idempotency_uq").on(
      table.idempotencyClerkOrgId,
      table.operationType,
      table.idempotencyKey
    ),
    orgIdx: index("namespace_operations_org_idx").on(
      table.clerkOrgId,
      table.status
    ),
    statusIdx: index("namespace_operations_status_idx").on(
      table.status,
      table.updatedAt
    ),
    userIdempotencyUq: uniqueIndex(
      "namespace_operations_user_idempotency_uq"
    ).on(
      table.idempotencyClerkUserId,
      table.operationType,
      table.idempotencyKey
    ),
    userIdx: index("namespace_operations_user_idx").on(
      table.clerkUserId,
      table.status
    ),
  })
);

export type Namespace = typeof namespaces.$inferSelect;
export type InsertNamespace = typeof namespaces.$inferInsert;
export type NamespaceOperation = typeof namespaceOperations.$inferSelect;
export type InsertNamespaceOperation = typeof namespaceOperations.$inferInsert;
