import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export type UserSourceControlAccountProvider = "github";
export type UserSourceControlAccountStatus =
  | "active"
  | "revoked"
  | "expired"
  | "error";

const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const ACTIVE_PROVIDER_KEY_LENGTH = 192;
const CODE_LENGTH = 32;

export const userSourceControlAccounts = mysqlTable(
  "lightfast_user_source_control_accounts",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    clerkUserId: varchar("clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    activeClerkUserId: varchar("active_clerk_user_id", {
      length: CLERK_ID_LENGTH,
    }),
    activeProviderUserKey: varchar("active_provider_user_key", {
      length: ACTIVE_PROVIDER_KEY_LENGTH,
    }),
    provider: varchar("provider", { length: CODE_LENGTH })
      .$type<UserSourceControlAccountProvider>()
      .notNull(),
    providerUserId: varchar("provider_user_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<UserSourceControlAccountStatus>()
      .notNull(),
    connectedAt: datetime("connected_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
    accessTokenExpiresAt: datetime("access_token_expires_at", {
      mode: "date",
      fsp: 3,
    }).notNull(),
    refreshTokenExpiresAt: datetime("refresh_token_expires_at", {
      mode: "date",
      fsp: 3,
    }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    activeUserUq: uniqueIndex("user_source_control_accounts_active_user_uq").on(
      table.activeClerkUserId
    ),
    activeProviderUserUq: uniqueIndex(
      "user_source_control_accounts_active_provider_user_uq"
    ).on(table.activeProviderUserKey),
    userStatusIdx: index("user_source_control_accounts_user_status_idx").on(
      table.clerkUserId,
      table.status
    ),
    providerUserIdx: index("user_source_control_accounts_provider_user_idx").on(
      table.provider,
      table.providerUserId
    ),
  })
);

type UserSourceControlAccountRow =
  typeof userSourceControlAccounts.$inferSelect;
export type UserSourceControlAccount = Omit<
  UserSourceControlAccountRow,
  "activeClerkUserId" | "activeProviderUserKey"
>;
export type InsertUserSourceControlAccount =
  typeof userSourceControlAccounts.$inferInsert;
