import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const PERSON_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const SIGNAL_ID_LENGTH = 64;
const CODE_LENGTH = 32;
const IDENTITY_KEY_LENGTH = 64;
const NORMALIZED_IDENTITY_VALUE_LENGTH = 512;
const DISPLAY_NAME_LENGTH = 160;

export type PersonIdentityProvider =
  | "email"
  | "x"
  | "linkedin"
  | "github"
  | "website";

export type PersonIdentityType = "email" | "handle" | "profile_url";

export function createPersonId() {
  return `person_${randomUUID()}`;
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

    displayName: varchar("display_name", { length: DISPLAY_NAME_LENGTH }),

    identityProvider: varchar("identity_provider", { length: CODE_LENGTH })
      .$type<PersonIdentityProvider>()
      .notNull(),

    identityType: varchar("identity_type", { length: CODE_LENGTH })
      .$type<PersonIdentityType>()
      .notNull(),

    identityValue: text("identity_value").notNull(),

    normalizedIdentityValue: varchar("normalized_identity_value", {
      length: NORMALIZED_IDENTITY_VALUE_LENGTH,
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

    createdAt: datetime("created_at", { mode: "string", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "string", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
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
