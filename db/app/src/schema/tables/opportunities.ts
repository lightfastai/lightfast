import { randomUUID } from "node:crypto";
import type {
  OpportunityClassification,
  OpportunityStatus,
} from "@repo/api-contract";
import { sql } from "drizzle-orm";
import {
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

const OPPORTUNITY_ID_LENGTH = 64;
const CLERK_ID_LENGTH = 64;
const API_KEY_ID_LENGTH = 128;
const CODE_LENGTH = 64;

export function createOpportunityId() {
  return `opp_${randomUUID()}`;
}

export const opportunities = mysqlTable(
  "lightfast_opportunities",
  {
    id: varchar("id", { length: OPPORTUNITY_ID_LENGTH })
      .primaryKey()
      .$defaultFn(createOpportunityId),

    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),

    createdByUserId: varchar("created_by_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),

    createdByApiKeyId: varchar("created_by_api_key_id", {
      length: API_KEY_ID_LENGTH,
    }).notNull(),

    input: text("input").notNull(),

    status: varchar("status", { length: CODE_LENGTH })
      .$type<OpportunityStatus>()
      .notNull(),

    classification: json(
      "classification"
    ).$type<OpportunityClassification | null>(),

    errorCode: varchar("error_code", { length: CODE_LENGTH }),

    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { mode: "string", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "string", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .onUpdateNow()
      .notNull(),
  },
  (table) => ({
    orgCreatedIdx: index("opportunities_org_created_idx").on(
      table.clerkOrgId,
      table.createdAt
    ),
    orgStatusIdx: index("opportunities_org_status_idx").on(
      table.clerkOrgId,
      table.status
    ),
  })
);

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;
