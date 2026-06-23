import { randomUUID } from "node:crypto";
import type {
  DeveloperConnectionCredentialKind,
  DeveloperConnectionLeaseStatus,
  DeveloperConnectionProvider,
  DeveloperConnectionStatus,
} from "@repo/api-contract";
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

export const DEVELOPER_CONNECTION_ID_PREFIX = "developer_connection_";
export const DEVELOPER_CONNECTION_LEASE_ID_PREFIX =
  "developer_connection_lease_";

const PUBLIC_ID_LENGTH = 96;
const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const CURRENT_KEY_LENGTH = CLERK_ID_LENGTH + 1 + CODE_LENGTH;

export function createDeveloperConnectionId() {
  return `${DEVELOPER_CONNECTION_ID_PREFIX}${randomUUID()}`;
}

export function createDeveloperConnectionLeaseId() {
  return `${DEVELOPER_CONNECTION_LEASE_ID_PREFIX}${randomUUID()}`;
}

export const orgDeveloperConnections = mysqlTable(
  "lightfast_org_developer_connections",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperConnectionId),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    currentOrgProviderKey: varchar("current_org_provider_key", {
      length: CURRENT_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<DeveloperConnectionProvider>()
      .notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerAccountName: varchar("provider_account_name", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperConnectionStatus>()
      .notNull(),
    enabledForSandboxes: boolean("enabled_for_sandboxes")
      .default(true)
      .notNull(),
    credentialKind: varchar("credential_kind", { length: CODE_LENGTH })
      .$type<DeveloperConnectionCredentialKind>()
      .notNull(),
    credentialSchemaVersion: varchar("credential_schema_version", {
      length: CODE_LENGTH,
    }).notNull(),
    encryptedCredential: text("encrypted_credential"),
    scopes: json("scopes").$type<string[]>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
    lastVerifiedAt: datetime("last_verified_at", { mode: "date", fsp: 3 }),
    lastUsedAt: datetime("last_used_at", { mode: "date", fsp: 3 }),
    lastUsedByUserId: varchar("last_used_by_user_id", {
      length: CLERK_ID_LENGTH,
    }),
    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    updatedByUserId: varchar("updated_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
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
    publicIdUq: uniqueIndex("org_developer_connections_public_id_uq").on(
      table.publicId
    ),
    currentOrgProviderUq: uniqueIndex(
      "org_developer_connections_current_org_provider_uq"
    ).on(table.currentOrgProviderKey),
    orgProviderStatusIdx: index(
      "org_developer_connections_org_provider_status_idx"
    ).on(table.clerkOrgId, table.provider, table.status),
  })
);

export const orgDeveloperConnectionLeases = mysqlTable(
  "lightfast_org_developer_connection_leases",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperConnectionLeaseId),
    connectionId: bigint("connection_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    actorUserId: varchar("actor_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    sandboxRunId: varchar("sandbox_run_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    workflowRunId: varchar("workflow_run_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<DeveloperConnectionProvider>()
      .notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperConnectionLeaseStatus>()
      .notNull(),
    requestedAt: datetime("requested_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    issuedAt: datetime("issued_at", { mode: "date", fsp: 3 }).notNull(),
    materializedAt: datetime("materialized_at", { mode: "date", fsp: 3 }),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    failureCode: varchar("failure_code", { length: CODE_LENGTH }),
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
    publicIdUq: uniqueIndex("org_developer_connection_leases_public_id_uq").on(
      table.publicId
    ),
    orgActorStatusIdx: index(
      "org_developer_connection_leases_org_actor_idx"
    ).on(table.clerkOrgId, table.actorUserId, table.status),
    workflowIdx: index("org_developer_connection_leases_workflow_idx").on(
      table.workflowRunId,
      table.provider
    ),
  })
);

type DeveloperConnectionRow = typeof orgDeveloperConnections.$inferSelect;
export type DeveloperConnection = Omit<
  DeveloperConnectionRow,
  "currentOrgProviderKey"
>;
export type InsertDeveloperConnection =
  typeof orgDeveloperConnections.$inferInsert;
export type DeveloperConnectionLease =
  typeof orgDeveloperConnectionLeases.$inferSelect;
export type InsertDeveloperConnectionLease =
  typeof orgDeveloperConnectionLeases.$inferInsert;
