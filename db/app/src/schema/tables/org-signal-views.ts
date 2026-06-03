import { randomUUID } from "node:crypto";
import type { SignalClassification } from "@repo/api-contract";
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

export const SIGNAL_VIEW_ID_PREFIX = "sigview_";

const SIGNAL_VIEW_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const NAME_LENGTH = 120;

export function createSignalViewId() {
  return `${SIGNAL_VIEW_ID_PREFIX}${randomUUID()}`;
}

export interface SignalViewConfig {
  filters: {
    kinds: SignalClassification["kind"][];
    priorities: SignalClassification["priority"][];
    dispositions: SignalClassification["disposition"][];
    peopleRouted: boolean;
  };
}

export const orgSignalViews = mysqlTable(
  "lightfast_org_signal_views",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    publicId: varchar("public_id", { length: SIGNAL_VIEW_ID_LENGTH })
      .notNull()
      .$defaultFn(createSignalViewId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    name: varchar("name", { length: NAME_LENGTH }).notNull(),

    config: json("config").$type<SignalViewConfig>().notNull(),

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
    uniqueIndex("org_signal_views_public_id_uq").on(table.publicId),
    index("org_signal_views_org_user_created_idx").on(
      table.clerkOrgId,
      table.createdByUserId,
      table.createdAt,
      table.id
    ),
  ]
);

export type SignalView = typeof orgSignalViews.$inferSelect;
export type InsertSignalView = typeof orgSignalViews.$inferInsert;
