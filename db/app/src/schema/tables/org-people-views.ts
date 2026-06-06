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
  json,
  mysqlTable,
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
    memberStatuses?: PersonMemberStatus[];
    providers: PersonIdentityProvider[];
    sources?: PersonSource[];
    types: PersonIdentityType[];
  };
}

export const orgPeopleViews = mysqlTable(
  "lightfast_org_people_views",
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

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    // Runtime hook keeps updated-at-on-write semantics without database-side
    // on-update DDL.
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("org_people_views_public_id_uq").on(table.publicId),
    index("org_people_views_org_user_created_idx").on(
      table.clerkOrgId,
      table.createdByUserId,
      table.createdAt,
      table.id
    ),
  ]
);

export type PeopleView = typeof orgPeopleViews.$inferSelect;
export type InsertPeopleView = typeof orgPeopleViews.$inferInsert;
