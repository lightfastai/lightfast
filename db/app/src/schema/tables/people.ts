import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const PERSON_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const SIGNAL_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const IDENTITY_KEY_LENGTH = 64;
export const PERSON_ID_PREFIX = "person_";
export const PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH = 512;
export const PERSON_DISPLAY_NAME_LENGTH = 160;

export type PersonIdentityProvider =
  | "email"
  | "x"
  | "linkedin"
  | "github"
  | "website";

export type PersonIdentityType = "email" | "handle" | "profile_url";

export function createPersonId() {
  return `${PERSON_ID_PREFIX}${randomUUID()}`;
}

export const people = mysqlTable(
  "lightfast_people",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PERSON_ID_LENGTH })
      .notNull()
      .$defaultFn(createPersonId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    displayName: varchar("display_name", {
      length: PERSON_DISPLAY_NAME_LENGTH,
    }),

    identityProvider: varchar("identity_provider", { length: CODE_LENGTH })
      .$type<PersonIdentityProvider>()
      .notNull(),

    identityType: varchar("identity_type", { length: CODE_LENGTH })
      .$type<PersonIdentityType>()
      .notNull(),

    identityValue: text("identity_value").notNull(),

    normalizedIdentityValue: varchar("normalized_identity_value", {
      length: PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH,
    }).notNull(),

    identityKey: varchar("identity_key", {
      length: IDENTITY_KEY_LENGTH,
    }).notNull(),

    firstSeenSignalId: varchar("first_seen_signal_id", {
      length: SIGNAL_ID_LENGTH,
    }),

    lastSeenSignalId: varchar("last_seen_signal_id", {
      length: SIGNAL_ID_LENGTH,
    }),

    seenCount: int("seen_count", { unsigned: true }).default(1).notNull(),

    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("people_public_id_uq").on(table.publicId),
    orgIdentityKeyUq: uniqueIndex("people_org_identity_key_uq").on(
      table.clerkOrgId,
      table.identityKey
    ),
    orgCreatedIdx: index("people_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
  })
);

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;
