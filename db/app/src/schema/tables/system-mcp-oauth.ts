import { createHash, randomUUID } from "node:crypto";
import type { McpScope } from "@repo/api-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  json,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const MCP_CLIENT_ID_PREFIX = "mcp_client_";
const MCP_GRANT_ID_PREFIX = "mcp_grant_";
const MCP_REGISTRATION_TOKEN_ID_PREFIX = "mcp_reg_";

const PUBLIC_ID_LENGTH = 128;
const CLERK_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const HASH_LENGTH = 128;
const SHA256_HEX_LENGTH = 64;
const NAME_LENGTH = 255;
const URI_LENGTH = 2048;
const RESOURCE_LENGTH = 512;
const EVENT_NAME_LENGTH = 128;
const CODE_CHALLENGE_LENGTH = 256;

function updatedAtColumn() {
  // Keep updated-at-on-write semantics without database-side on-update DDL.
  return datetime("updated_at", { mode: "date", fsp: 3 })
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => new Date())
    .notNull();
}

export type McpOauthClientStatus = "active" | "deleted";
export type McpOauthRegistrationTokenStatus = "active" | "revoked" | "rotated";
export type McpOauthGrantStatus = "active" | "revoked";
export type McpOauthRefreshTokenStatus =
  | "active"
  | "reuse_detected"
  | "revoked"
  | "rotated";
export type McpAuditOutcome = "denied" | "error" | "success";
export type McpCodeChallengeMethod = "plain" | "S256";
export type McpOauthMetadata = Record<string, unknown>;

export function createMcpOauthClientId(): string {
  return `${MCP_CLIENT_ID_PREFIX}${randomUUID()}`;
}

export function createMcpOauthGrantId(): string {
  return `${MCP_GRANT_ID_PREFIX}${randomUUID()}`;
}

export function createMcpOauthRegistrationTokenId(): string {
  return `${MCP_REGISTRATION_TOKEN_ID_PREFIX}${randomUUID()}`;
}

export function hashMcpOauthResource(resource: string): string {
  return createHash("sha256").update(resource).digest("hex");
}

export const systemMcpOauthClients = mysqlTable(
  "lightfast_system_mcp_oauth_clients",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicClientId: varchar("public_client_id", {
      length: PUBLIC_ID_LENGTH,
    })
      .notNull()
      .$defaultFn(createMcpOauthClientId),

    clientName: varchar("client_name", { length: NAME_LENGTH }).notNull(),

    clientUri: varchar("client_uri", { length: URI_LENGTH }),

    logoUri: varchar("logo_uri", { length: URI_LENGTH }),

    contacts: json("contacts").$type<string[] | null>(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<McpOauthClientStatus>()
      .notNull()
      .default("active"),

    metadata: json("metadata").$type<McpOauthMetadata | null>(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    publicClientIdUq: uniqueIndex("system_mcp_oauth_clients_public_id_uq").on(
      table.publicClientId
    ),
  })
);

export const systemMcpOauthClientRedirectUris = mysqlTable(
  "lightfast_system_mcp_oauth_client_redirect_uris",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    redirectUri: varchar("redirect_uri", { length: URI_LENGTH }).notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    clientIdx: index("system_mcp_redirect_uris_client_idx").on(
      table.clientPublicId
    ),
  })
);

export const systemMcpOauthRegistrationTokens = mysqlTable(
  "lightfast_system_mcp_oauth_registration_tokens",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createMcpOauthRegistrationTokenId),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    tokenHash: varchar("token_hash", { length: HASH_LENGTH }).notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<McpOauthRegistrationTokenStatus>()
      .notNull()
      .default("active"),

    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("system_mcp_registration_public_id_uq").on(
      table.publicId
    ),
    tokenHashUq: uniqueIndex("system_mcp_registration_token_hash_uq").on(
      table.tokenHash
    ),
    clientStatusIdx: index("system_mcp_registration_client_status_idx").on(
      table.clientPublicId,
      table.status
    ),
  })
);

export const systemMcpOauthAuthorizationCodes = mysqlTable(
  "lightfast_system_mcp_oauth_authorization_codes",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    codeHash: varchar("code_hash", { length: HASH_LENGTH }).notNull(),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    redirectUri: varchar("redirect_uri", { length: URI_LENGTH }).notNull(),

    resource: varchar("resource", { length: RESOURCE_LENGTH }).notNull(),

    resourceHash: varchar("resource_hash", {
      length: SHA256_HEX_LENGTH,
    }).notNull(),

    scopes: json("scopes").$type<McpScope[]>().notNull(),

    codeChallenge: varchar("code_challenge", {
      length: CODE_CHALLENGE_LENGTH,
    }).notNull(),

    codeChallengeMethod: varchar("code_challenge_method", {
      length: CODE_LENGTH,
    })
      .$type<McpCodeChallengeMethod>()
      .notNull(),

    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),

    consumedAt: datetime("consumed_at", { mode: "date", fsp: 3 }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    codeHashUq: uniqueIndex("system_mcp_authorization_codes_hash_uq").on(
      table.codeHash
    ),
    clientUserIdx: index("system_mcp_authorization_client_user_idx").on(
      table.clientPublicId,
      table.clerkUserId,
      table.createdAt
    ),
  })
);

export const systemMcpOauthGrants = mysqlTable(
  "lightfast_system_mcp_oauth_grants",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createMcpOauthGrantId),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    resource: varchar("resource", { length: RESOURCE_LENGTH }).notNull(),

    resourceHash: varchar("resource_hash", {
      length: SHA256_HEX_LENGTH,
    }).notNull(),

    scopes: json("scopes").$type<McpScope[]>().notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<McpOauthGrantStatus>()
      .notNull()
      .default("active"),

    metadata: json("metadata").$type<McpOauthMetadata | null>(),

    lastUsedAt: datetime("last_used_at", { mode: "date", fsp: 3 }),

    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("system_mcp_grants_public_id_uq").on(
      table.publicId
    ),
    lookupIdx: index("system_mcp_grants_lookup_idx").on(
      table.clerkUserId,
      table.clerkOrgId,
      table.clientPublicId,
      table.resourceHash,
      table.status
    ),
    orgActiveIdx: index("system_mcp_grants_org_active_idx").on(
      table.clerkOrgId,
      table.status,
      table.createdAt,
      table.id
    ),
  })
);

export const systemMcpOauthRefreshTokens = mysqlTable(
  "lightfast_system_mcp_oauth_refresh_tokens",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    tokenHash: varchar("token_hash", { length: HASH_LENGTH }).notNull(),

    grantPublicId: varchar("grant_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    parentTokenHash: varchar("parent_token_hash", { length: HASH_LENGTH }),

    rotatedToTokenHash: varchar("rotated_to_token_hash", {
      length: HASH_LENGTH,
    }),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<McpOauthRefreshTokenStatus>()
      .notNull()
      .default("active"),

    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),

    reuseDetectedAt: datetime("reuse_detected_at", {
      mode: "date",
      fsp: 3,
    }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: updatedAtColumn(),
  },
  (table) => ({
    tokenHashUq: uniqueIndex("system_mcp_refresh_token_hash_uq").on(
      table.tokenHash
    ),
    grantStatusIdx: index("system_mcp_refresh_grant_status_idx").on(
      table.grantPublicId,
      table.status,
      table.createdAt
    ),
  })
);

export const systemMcpAuditEvents = mysqlTable(
  "lightfast_system_mcp_audit_events",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    eventName: varchar("event_name", { length: EVENT_NAME_LENGTH }).notNull(),

    outcome: varchar("outcome", { length: CODE_LENGTH })
      .$type<McpAuditOutcome>()
      .notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }),

    clerkUserId: varchar("clerk_user_id", { length: CLERK_ID_LENGTH }),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }),

    grantPublicId: varchar("grant_public_id", { length: PUBLIC_ID_LENGTH }),

    metadata: json("metadata").$type<McpOauthMetadata | null>(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    orgCreatedIdx: index("system_mcp_audit_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    clientCreatedIdx: index("system_mcp_audit_client_created_idx").on(
      table.clientPublicId,
      table.createdAt,
      table.id
    ),
  })
);

export type McpOauthClient = typeof systemMcpOauthClients.$inferSelect;
export type InsertMcpOauthClient = typeof systemMcpOauthClients.$inferInsert;
export type McpOauthClientRedirectUri =
  typeof systemMcpOauthClientRedirectUris.$inferSelect;
export type InsertMcpOauthClientRedirectUri =
  typeof systemMcpOauthClientRedirectUris.$inferInsert;
export type McpOauthRegistrationToken =
  typeof systemMcpOauthRegistrationTokens.$inferSelect;
export type InsertMcpOauthRegistrationToken =
  typeof systemMcpOauthRegistrationTokens.$inferInsert;
export type McpOauthAuthorizationCode =
  typeof systemMcpOauthAuthorizationCodes.$inferSelect;
export type InsertMcpOauthAuthorizationCode =
  typeof systemMcpOauthAuthorizationCodes.$inferInsert;
export type McpOauthGrant = typeof systemMcpOauthGrants.$inferSelect;
export type InsertMcpOauthGrant = typeof systemMcpOauthGrants.$inferInsert;
export type McpOauthRefreshToken =
  typeof systemMcpOauthRefreshTokens.$inferSelect;
export type InsertMcpOauthRefreshToken =
  typeof systemMcpOauthRefreshTokens.$inferInsert;
export type McpAuditEvent = typeof systemMcpAuditEvents.$inferSelect;
export type InsertMcpAuditEvent = typeof systemMcpAuditEvents.$inferInsert;
