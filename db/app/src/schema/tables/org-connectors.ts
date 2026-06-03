import type {
  ConnectableConnectorProvider,
  ConnectorConnectionStatus,
  FullConnectorToolManifest,
} from "@repo/connector-contract";
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

const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;
const CURRENT_KEY_LENGTH = CLERK_ID_LENGTH + 1 + CODE_LENGTH;
const URL_LENGTH = 512;

export const orgConnectorConnections = mysqlTable(
  "lightfast_org_connector_connections",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    currentOrgProviderKey: varchar("current_org_provider_key", {
      length: CURRENT_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<ConnectableConnectorProvider>()
      .notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<ConnectorConnectionStatus>()
      .notNull(),
    connectedByUserId: varchar("connected_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    connectedAt: datetime("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    providerWorkspaceId: varchar("provider_workspace_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerWorkspaceName: varchar("provider_workspace_name", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerActorId: varchar("provider_actor_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    providerActorName: varchar("provider_actor_name", {
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
    enabledForAutomations: boolean("enabled_for_automations")
      .default(false)
      .notNull(),
    enabledForAgents: boolean("enabled_for_agents").default(false).notNull(),
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
    currentOrgProviderUq: uniqueIndex(
      "org_connector_connections_current_org_provider_uq"
    ).on(table.currentOrgProviderKey),
    orgProviderStatusIdx: index(
      "org_connector_connections_org_provider_status_idx"
    ).on(table.clerkOrgId, table.provider, table.status),
    providerWorkspaceIdx: index(
      "org_connector_connections_provider_workspace_idx"
    ).on(table.provider, table.providerWorkspaceId),
  })
);

type OrgConnectorConnectionRow = typeof orgConnectorConnections.$inferSelect;
export type OrgConnectorConnection = Omit<
  OrgConnectorConnectionRow,
  "currentOrgProviderKey"
>;
export type InsertOrgConnectorConnection =
  typeof orgConnectorConnections.$inferInsert;
