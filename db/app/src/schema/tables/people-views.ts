import { randomUUID } from "node:crypto";
import type {
  PersonIdentityProvider,
  PersonIdentityType,
} from "@repo/app-validation/schemas";
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

export const PEOPLE_VIEW_ID_PREFIX = "peoview_";

const PEOPLE_VIEW_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const NAME_LENGTH = 120;

export function createPeopleViewId() {
  return `${PEOPLE_VIEW_ID_PREFIX}${randomUUID()}`;
}

export interface PeopleViewConfig {
  filters: {
    providers: PersonIdentityProvider[];
    types: PersonIdentityType[];
  };
}

export const peopleViews = mysqlTable(
  "lightfast_people_views",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: PEOPLE_VIEW_ID_LENGTH })
      .notNull()
      .$defaultFn(createPeopleViewId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    name: varchar("name", { length: NAME_LENGTH }).notNull(),

    config: json("config").$type<PeopleViewConfig>().notNull(),

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // NOTE: runtime `$onUpdate` hook, NOT the DDL `.onUpdateNow()`. drizzle-kit
    // 0.31.10 emits `ON UPDATE CURRENT_TIMESTAMP` without the `(3)` precision a
    // `timestamp(3)` column requires, which Vitess rejects on CREATE TABLE
    // (errno 1294). The runtime hook keeps updated-at-on-write semantics
    // without emitting the invalid DDL clause. See signal-views.ts.
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("people_views_public_id_uq").on(table.publicId),
    index("people_views_org_user_created_idx").on(
      table.clerkOrgId,
      table.createdByUserId,
      table.createdAt,
      table.id
    ),
  ]
);

export type PeopleView = typeof peopleViews.$inferSelect;
export type InsertPeopleView = typeof peopleViews.$inferInsert;
