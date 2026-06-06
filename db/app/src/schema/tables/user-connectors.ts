import type {
  FullConnectorToolManifest,
  UserConnectorConnectionStatus,
  UserConnectorProvider,
} from "@repo/connector-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const CURRENT_KEY_LENGTH = CLERK_ID_LENGTH + 1 + CODE_LENGTH;
const URL_LENGTH = 512;

export const userConnectorConnections = mysqlTable(
  "lightfast_user_connector_connections",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    currentUserProviderKey: varchar("current_user_provider_key", {
      length: CURRENT_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<UserConnectorProvider>()
      .notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<UserConnectorConnectionStatus>()
      .notNull(),
    connectedAt: datetime("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    providerAccountId: varchar("provider_account_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerAccountName: varchar("provider_account_name", {
      length: PROVIDER_REF_LENGTH,
    }),
    encryptedAccessToken: text("encrypted_access_token"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    accessTokenExpiresAt: datetime("access_token_expires_at", {
      mode: "date",
      fsp: 3,
    }),
    refreshTokenExpiresAt: datetime("refresh_token_expires_at", {
      mode: "date",
      fsp: 3,
    }),
    scopes: json("scopes").$type<string[]>().notNull(),
    mcpEndpoint: varchar("mcp_endpoint", { length: URL_LENGTH }).notNull(),
    toolManifest: json("tool_manifest")
      .$type<FullConnectorToolManifest>()
      .notNull(),
    lastToolRefreshAt: datetime("last_tool_refresh_at", {
      mode: "date",
      fsp: 3,
    }),
    lastToolRefreshErrorAt: datetime("last_tool_refresh_error_at", {
      mode: "date",
      fsp: 3,
    }),
    lastToolRefreshErrorCode: varchar("last_tool_refresh_error_code", {
      length: CODE_LENGTH,
    }),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    // Match the views tables: keep update semantics in Drizzle runtime because
    // drizzle-kit emits an invalid Vitess DDL clause for datetime(3).
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    currentUserProviderUq: uniqueIndex(
      "user_connector_connections_current_user_provider_uq"
    ).on(table.currentUserProviderKey),
    userProviderStatusIdx: index(
      "user_connector_connections_user_provider_status_idx"
    ).on(table.clerkUserId, table.provider, table.status),
    providerAccountIdx: index(
      "user_connector_connections_provider_account_idx"
    ).on(table.provider, table.providerAccountId),
  })
);

type UserConnectorConnectionRow =
  typeof userConnectorConnections.$inferSelect;
export type UserConnectorConnection = Omit<
  UserConnectorConnectionRow,
  "currentUserProviderKey"
>;
export type InsertUserConnectorConnection =
  typeof userConnectorConnections.$inferInsert;
