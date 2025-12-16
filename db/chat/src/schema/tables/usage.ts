import { sql } from "drizzle-orm";
import { datetime, int, mysqlTable, varchar, uniqueIndex } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib/uuid";

/**
 * LightfastChatUsage table tracks user billing usage by period
 * for the Lightfast Chat application.
 * 
 * This table stores monthly usage counts for both premium and non-premium messages
 * to enforce billing limits based on user subscription plans.
 */
export const LightfastChatUsage = mysqlTable(
  "lightfast_chat_usage",
  {
    /**
     * Unique identifier for the usage record
     * Generated using uuidv4 for global uniqueness
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    
    /**
     * Clerk user ID who owns this usage record
     * Links to Clerk's user management system
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
    
    /**
     * Usage period identifier in YYYY-MM or YYYY-MM-DD format
     * Example: "2025-01" for calendar month, "2025-01-15" for billing anniversaries
     * Allows alignment with either calendar or subscription billing cycles
     */
    period: varchar("period", { length: 10 }).notNull(),
    
    /**
     * Count of non-premium messages used in this period
     * Free users get 1000 non-premium messages per month
     * Plus users also get 1000 non-premium messages per month
     */
    nonPremiumMessages: int("non_premium_messages").default(0).notNull(),
    
    /**
     * Count of premium messages used in this period
     * Free users get 0 premium messages per month
     * Plus users get 100 premium messages per month
     */
    premiumMessages: int("premium_messages").default(0).notNull(),

    /**
     * Count of file attachments uploaded during the period
     * Helps enforce storage or attachment-based quotas.
     */
    attachmentCount: int("attachment_count").default(0).notNull(),
    /**
     * Timestamp when the usage record was created
     */
    createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    
    /**
     * Timestamp when the usage record was last updated
     * Automatically updates on any modification
     */
    updatedAt: datetime("updated_at", { mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    // Unique constraint on clerkUserId + period combination
    // Ensures one usage record per user per month
    userPeriodIdx: uniqueIndex("user_period_idx").on(table.clerkUserId, table.period),
  })
);

// Type exports for Usage
export type LightfastChatUsage = typeof LightfastChatUsage.$inferSelect;
export type InsertLightfastChatUsage = typeof LightfastChatUsage.$inferInsert;

// Zod Schema exports for validation
export const insertLightfastChatUsageSchema = createInsertSchema(LightfastChatUsage);
export const selectLightfastChatUsageSchema = createSelectSchema(LightfastChatUsage);
