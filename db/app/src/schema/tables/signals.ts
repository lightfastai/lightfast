import { randomUUID } from "node:crypto";
import {
  SIGNAL_ID_PREFIX,
  type SignalClassification,
  type SignalStatus,
} from "@repo/api-contract";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const SIGNAL_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const API_KEY_ID_LENGTH = 128;
const CODE_LENGTH = 32;
const ERROR_CODE_LENGTH = 64;

export function createSignalId() {
  return `${SIGNAL_ID_PREFIX}${randomUUID()}`;
}

export const signals = mysqlTable(
  "lightfast_signals",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: SIGNAL_ID_LENGTH })
      .notNull()
      .$defaultFn(createSignalId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    createdByApiKeyId: varchar("created_by_api_key_id", {
      length: API_KEY_ID_LENGTH,
    }).notNull(),

    input: text("input").notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<SignalStatus>()
      .notNull(),

    classification: json("classification").$type<SignalClassification | null>(),

    errorCode: varchar("error_code", { length: ERROR_CODE_LENGTH }),

    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("signals_public_id_uq").on(table.publicId),
    orgCreatedIdx: index("signals_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    orgStatusCreatedIdx: index("signals_org_status_created_idx").on(
      table.clerkOrgId,
      table.status,
      table.createdAt,
      table.id
    ),
  })
);

export type Signal = typeof signals.$inferSelect;
export type InsertSignal = typeof signals.$inferInsert;
