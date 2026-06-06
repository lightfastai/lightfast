import { randomUUID } from "node:crypto";
import type {
  PersonIdentityProvider,
  PersonIdentityType,
  PersonMemberStatus,
  PersonSource,
} from "@repo/app-validation/schemas";
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
export const PERSON_ID_PREFIX = "person_";
export const PERSON_NORMALIZED_IDENTITY_VALUE_LENGTH = 512;
export const PERSON_DISPLAY_NAME_LENGTH = 160;
export type {
  PersonIdentityProvider,
  PersonIdentityType,
  PersonMemberStatus,
  PersonSource,
};

export function createPersonId() {
  return `${PERSON_ID_PREFIX}${randomUUID()}`;
}

export const orgPeople = mysqlTable(
  "lightfast_org_people",
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

    personSource: varchar("person_source", { length: CODE_LENGTH })
      .$type<PersonSource>()
      .default("signal")
      .notNull(),

    memberStatus: varchar("member_status", { length: CODE_LENGTH }).$type<
      PersonMemberStatus
    >(),

    clerkUserId: varchar("clerk_user_id", { length: CLERK_ID_LENGTH }),

    memberRole: varchar("member_role", { length: CODE_LENGTH }).$type<
      "org:admin" | "org:member"
    >(),

    memberSyncedAt: datetime("member_synced_at", { mode: "date", fsp: 3 }),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("org_people_public_id_uq").on(table.publicId),
    orgIdentityKeyUq: uniqueIndex("org_people_org_identity_key_uq").on(
      table.clerkOrgId,
      table.identityKey
    ),
    orgCreatedIdx: index("org_people_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt,
      table.id
    ),
    orgPersonSourceIdx: index("org_people_org_person_source_idx").on(
      table.clerkOrgId,
      table.personSource,
      table.id
    ),
    orgMemberStatusIdx: index("org_people_org_member_status_idx").on(
      table.clerkOrgId,
      table.memberStatus,
      table.id
    ),
  })
);

export type Person = typeof orgPeople.$inferSelect;
export type InsertPerson = typeof orgPeople.$inferInsert;
