import { randomUUID } from "node:crypto";
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
import type {
  ProviderRoutineCallProvider,
  ProviderRoutineCallStatus,
} from "./org-provider-routine-calls";

export const DECISION_VIEW_ID_PREFIX = "decview_";

const DECISION_VIEW_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const NAME_LENGTH = 120;

export function createDecisionViewId() {
  return `${DECISION_VIEW_ID_PREFIX}${randomUUID()}`;
}

export interface DecisionViewConfig {
  filters: {
    providers: ProviderRoutineCallProvider[];
    statuses: ProviderRoutineCallStatus[];
  };
}

export const orgDecisionViews = mysqlTable(
  "lightfast_org_decision_views",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: DECISION_VIEW_ID_LENGTH })
      .notNull()
      .$defaultFn(createDecisionViewId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    name: varchar("name", { length: NAME_LENGTH }).notNull(),

    config: json("config").$type<DecisionViewConfig>().notNull(),

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
    uniqueIndex("org_decision_views_public_id_uq").on(table.publicId),
    index("org_decision_views_org_user_created_idx").on(
      table.clerkOrgId,
      table.createdByUserId,
      table.createdAt,
      table.id
    ),
  ]
);

export type DecisionView = typeof orgDecisionViews.$inferSelect;
export type InsertDecisionView = typeof orgDecisionViews.$inferInsert;
