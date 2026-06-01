import { createHash, randomUUID } from "node:crypto";
import type { McpScope } from "@repo/api-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  json,
  mysqlTable,
  timestamp,
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

export const mcpOauthClients = mysqlTable(
  "lightfast_mcp_oauth_clients",
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

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicClientIdUq: uniqueIndex("mcp_oauth_clients_public_id_uq").on(
      table.publicClientId
    ),
  })
);

export const mcpOauthClientRedirectUris = mysqlTable(
  "lightfast_mcp_oauth_client_redirect_uris",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    clientPublicId: varchar("client_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),

    redirectUri: varchar("redirect_uri", { length: URI_LENGTH }).notNull(),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    clientIdx: index("mcp_redirect_uris_client_idx").on(table.clientPublicId),
  })
);

export const mcpOauthRegistrationTokens = mysqlTable(
  "lightfast_mcp_oauth_registration_tokens",
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

    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("mcp_registration_public_id_uq").on(table.publicId),
    tokenHashUq: uniqueIndex("mcp_registration_token_hash_uq").on(
      table.tokenHash
    ),
    clientStatusIdx: index("mcp_registration_client_status_idx").on(
      table.clientPublicId,
      table.status
    ),
  })
);

export const mcpOauthAuthorizationCodes = mysqlTable(
  "lightfast_mcp_oauth_authorization_codes",
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

    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }).notNull(),

    consumedAt: timestamp("consumed_at", { mode: "date", fsp: 3 }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    codeHashUq: uniqueIndex("mcp_authorization_codes_hash_uq").on(
      table.codeHash
    ),
    clientUserIdx: index("mcp_authorization_client_user_idx").on(
      table.clientPublicId,
      table.clerkUserId,
      table.createdAt
    ),
  })
);

export const mcpOauthGrants = mysqlTable(
  "lightfast_mcp_oauth_grants",
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

    lastUsedAt: timestamp("last_used_at", { mode: "date", fsp: 3 }),

    revokedAt: timestamp("revoked_at", { mode: "date", fsp: 3 }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("mcp_grants_public_id_uq").on(table.publicId),
    lookupIdx: index("mcp_grants_lookup_idx").on(
      table.clerkUserId,
      table.clerkOrgId,
      table.clientPublicId,
      table.resourceHash,
      table.status
    ),
    orgActiveIdx: index("mcp_grants_org_active_idx").on(
      table.clerkOrgId,
      table.status,
      table.createdAt,
      table.id
    ),
  })
);

export const mcpOauthRefreshTokens = mysqlTable(
  "lightfast_mcp_oauth_refresh_tokens",
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

    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }).notNull(),

    reuseDetectedAt: timestamp("reuse_detected_at", {
      mode: "date",
      fsp: 3,
    }),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    tokenHashUq: uniqueIndex("mcp_refresh_token_hash_uq").on(table.tokenHash),
    grantStatusIdx: index("mcp_refresh_grant_status_idx").on(
      table.grantPublicId,
      table.status,
      table.createdAt
    ),
  })
);

export const mcpAuditEvents = mysqlTable(
  "lightfast_mcp_audit_events",
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

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
  },
  (table) => ({
    orgCreatedIdx: index("mcp_audit_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    clientCreatedIdx: index("mcp_audit_client_created_idx").on(
      table.clientPublicId,
      table.createdAt,
      table.id
    ),
  })
);

export type McpOauthClient = typeof mcpOauthClients.$inferSelect;
export type InsertMcpOauthClient = typeof mcpOauthClients.$inferInsert;
export type McpOauthClientRedirectUri =
  typeof mcpOauthClientRedirectUris.$inferSelect;
export type InsertMcpOauthClientRedirectUri =
  typeof mcpOauthClientRedirectUris.$inferInsert;
export type McpOauthRegistrationToken =
  typeof mcpOauthRegistrationTokens.$inferSelect;
export type InsertMcpOauthRegistrationToken =
  typeof mcpOauthRegistrationTokens.$inferInsert;
export type McpOauthAuthorizationCode =
  typeof mcpOauthAuthorizationCodes.$inferSelect;
export type InsertMcpOauthAuthorizationCode =
  typeof mcpOauthAuthorizationCodes.$inferInsert;
export type McpOauthGrant = typeof mcpOauthGrants.$inferSelect;
export type InsertMcpOauthGrant = typeof mcpOauthGrants.$inferInsert;
export type McpOauthRefreshToken = typeof mcpOauthRefreshTokens.$inferSelect;
export type InsertMcpOauthRefreshToken =
  typeof mcpOauthRefreshTokens.$inferInsert;
export type McpAuditEvent = typeof mcpAuditEvents.$inferSelect;
export type InsertMcpAuditEvent = typeof mcpAuditEvents.$inferInsert;
