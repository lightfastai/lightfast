import { sql } from "drizzle-orm";
import { datetime, varchar, mysqlTable, uniqueIndex, index } from "drizzle-orm/mysql-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { uuidv4 } from "@repo/lib/uuid";

/**
 * QuotaReservation table tracks temporary quota reservations
 * to prevent race conditions in billing.
 * 
 * Flow:
 * 1. Reserve quota (atomic check + decrement)
 * 2. Process request
 * 3. Confirm reservation (convert to usage) OR release (return quota)
 * 
 * This ensures billing integrity and prevents quota bypass attacks.
 */
export const LightfastChatQuotaReservation = mysqlTable(
  "lightfast_chat_quota_reservation",
  {
    /**
     * Unique identifier for the reservation
     * Generated using uuidv4 for global uniqueness
     */
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => uuidv4()),
    
    /**
     * Clerk user ID who owns this reservation
     * Links to Clerk's user management system
     */
    clerkUserId: varchar("clerk_user_id", { length: 191 }).notNull(),
    
    /**
     * Message ID for idempotency
     * Prevents duplicate reservations for the same message
     */
    messageId: varchar("message_id", { length: 191 }).notNull(),
    
    /**
     * Model ID that triggered this reservation
     * Used for billing categorization and audit trails
     */
    modelId: varchar("model_id", { length: 191 }).notNull(),
    
    /**
     * Message type: 'premium' or 'standard'
     * Determines which quota pool this reservation affects
     */
    messageType: varchar("message_type", { length: 10 }).notNull(),
    
    /**
     * Billing period identifier in YYYY-MM or YYYY-MM-DD format
     * Example: "2025-01" for calendar month, "2025-01-15" for billing anniversaries
     */
    period: varchar("period", { length: 10 }).notNull(),
    
    /**
     * Reservation status
     * - 'reserved': Quota reserved, awaiting confirmation
     * - 'confirmed': Converted to actual usage
     * - 'released': Quota returned to user
     * - 'expired': Auto-released by cleanup job
     */
    status: varchar("status", { length: 10 }).notNull().default('reserved'),
    
    /**
     * Timestamp when the reservation was created
     */
    createdAt: datetime("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    
    /**
     * Timestamp when the reservation status was last updated
     */
    updatedAt: datetime("updated_at", { mode: 'string' })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull()
      .$onUpdateFn(() => sql`CURRENT_TIMESTAMP`),
    
    /**
     * Timestamp when the reservation was confirmed or released
     * Used for audit trails and cleanup
     */
    completedAt: datetime("completed_at", { mode: 'string' }),
  },
  (table) => ({
    // Unique constraint on messageId to prevent duplicate reservations
    messageIdIdx: uniqueIndex("message_id_idx").on(table.messageId),
    
    // Index for efficient queries by user and period
    userPeriodIdx: index("user_period_idx").on(table.clerkUserId, table.period),
    
    // Index for cleanup jobs to find expired reservations
    statusCreatedIdx: index("status_created_idx").on(table.status, table.createdAt),
    
    // Index for audit queries by model
    modelIdIdx: index("model_id_idx").on(table.modelId),
  })
);

// Type exports for QuotaReservation
export type LightfastChatQuotaReservation = typeof LightfastChatQuotaReservation.$inferSelect;
export type InsertLightfastChatQuotaReservation = typeof LightfastChatQuotaReservation.$inferInsert;

// Zod Schema exports for validation
export const insertLightfastChatQuotaReservationSchema = createInsertSchema(LightfastChatQuotaReservation);
export const selectLightfastChatQuotaReservationSchema = createSelectSchema(LightfastChatQuotaReservation);

// Status enum for type safety
export const RESERVATION_STATUS = {
  RESERVED: 'reserved' as const,
  CONFIRMED: 'confirmed' as const,
  RELEASED: 'released' as const,
  EXPIRED: 'expired' as const,
} as const;

export type ReservationStatus = typeof RESERVATION_STATUS[keyof typeof RESERVATION_STATUS];
