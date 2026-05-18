/**
 * Org Lightfast Tasks Table Schema
 *
 * Source of truth for the per-org Lightfast Tasks readiness primitive.
 *
 * One row = one (org, task_key) pair that has been cleared. Absence of
 * a row means the task is still pending for that org. Idempotent upserts
 * via INSERT … ON CONFLICT DO NOTHING; the composite PK makes concurrent
 * writes race-free at the DB layer.
 */

import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const orgLightfastTasks = pgTable(
  "org_lightfast_tasks",
  {
    orgId: text("org_id").notNull(),
    taskKey: text("task_key").notNull(),
    clearedAt: timestamp("cleared_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.orgId, table.taskKey] }),
    orgIdx: index("org_lightfast_tasks_org_idx").on(table.orgId),
  })
);

export type OrgLightfastTask = typeof orgLightfastTasks.$inferSelect;
export type InsertOrgLightfastTask = typeof orgLightfastTasks.$inferInsert;
