import { randomUUID } from "node:crypto";
import type { SignalClassification } from "@repo/api-contract";
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

export const SIGNAL_VIEW_ID_PREFIX = "sigview_";

const SIGNAL_VIEW_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const NAME_LENGTH = 120;

export function createSignalViewId() {
  return `${SIGNAL_VIEW_ID_PREFIX}${randomUUID()}`;
}

export type SignalViewLayout = "list" | "board";

export interface SignalViewConfig {
  filters: {
    kinds: SignalClassification["kind"][];
    priorities: SignalClassification["priority"][];
    dispositions: SignalClassification["disposition"][];
    peopleRouted: boolean;
  };
  layout: SignalViewLayout;
}

export const signalViews = mysqlTable(
  "lightfast_signal_views",
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

    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("signal_views_public_id_uq").on(table.publicId),
    index("signal_views_org_user_created_idx").on(
      table.clerkOrgId,
      table.createdByUserId,
      table.createdAt,
      table.id
    ),
  ]
);

export type SignalView = typeof signalViews.$inferSelect;
export type InsertSignalView = typeof signalViews.$inferInsert;
