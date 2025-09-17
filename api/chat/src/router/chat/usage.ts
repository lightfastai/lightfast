import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import { 
  LightfastChatUsage,
  insertLightfastChatUsageSchema,
  LightfastChatQuotaReservation,
  RESERVATION_STATUS
} from "@db/chat";
import { eq, and, sql, lt } from "drizzle-orm";

// Helper function to get usage by period (shared logic)
async function getUsageByPeriod(userId: string, period: string) {
  const usage = await db
    .select()
    .from(LightfastChatUsage)
    .where(
      and(
        eq(LightfastChatUsage.clerkUserId, userId),
        eq(LightfastChatUsage.period, period)
      )
    )
    .limit(1);

  if (usage[0]) {
    return usage[0];
  } else {
    return {
      id: null,
      clerkUserId: userId,
      period,
      nonPremiumMessages: 0,
      premiumMessages: 0,
      createdAt: null,
      updatedAt: null,
    };
  }
}

// Helper function to increment premium usage (extracted for reuse in transactions)
async function incrementPremiumUsage(tx: any, userId: string, period: string, count: number = 1) {
  try {
    // Attempt to insert new record
    await tx.insert(LightfastChatUsage).values({
      clerkUserId: userId,
      period: period,
      nonPremiumMessages: 0,
      premiumMessages: count,
    });
  } catch (error) {
    // If insert fails due to unique constraint, update existing record
    if (error instanceof Error && 
        (error.message.includes('Duplicate entry') || 
         error.message.includes('unique constraint'))) {
      
      await tx
        .update(LightfastChatUsage)
        .set({
          premiumMessages: sql`${LightfastChatUsage.premiumMessages} + ${count}`
        })
        .where(
          and(
            eq(LightfastChatUsage.clerkUserId, userId),
            eq(LightfastChatUsage.period, period)
          )
        );
    } else {
      throw error;
    }
  }
}

// Helper function to increment non-premium usage (extracted for reuse in transactions)
async function incrementNonPremiumUsage(tx: any, userId: string, period: string, count: number = 1) {
  try {
    // Attempt to insert new record
    await tx.insert(LightfastChatUsage).values({
      clerkUserId: userId,
      period: period,
      nonPremiumMessages: count,
      premiumMessages: 0,
    });
  } catch (error) {
    // If insert fails due to unique constraint, update existing record
    if (error instanceof Error && 
        (error.message.includes('Duplicate entry') || 
         error.message.includes('unique constraint'))) {
      
      await tx
        .update(LightfastChatUsage)
        .set({
          nonPremiumMessages: sql`${LightfastChatUsage.nonPremiumMessages} + ${count}`
        })
        .where(
          and(
            eq(LightfastChatUsage.clerkUserId, userId),
            eq(LightfastChatUsage.period, period)
          )
        );
    } else {
      throw error;
    }
  }
}

export const usageRouter = {
  /**
   * Get usage statistics for a user in a specific period
   */
  getByPeriod: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format"),
      })
    )
    .query(async ({ ctx, input }) => {
      return await getUsageByPeriod(ctx.session.userId, input.period);
    }),

  /**
   * Get current month usage for the authenticated user
   */
  getCurrentMonth: protectedProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      return await getUsageByPeriod(ctx.session.userId, period);
    }),

  /**
   * Increment non-premium message usage
   * Uses atomic upsert within transaction to prevent race conditions
   */
  incrementNonPremium: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format"),
        count: z.number().positive().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      
      // Use transaction for atomic upsert to prevent race conditions
      return await db.transaction(async (tx) => {
        try {
          // Attempt to insert new record
          await tx.insert(LightfastChatUsage).values({
            clerkUserId: userId,
            period: input.period,
            nonPremiumMessages: input.count,
            premiumMessages: 0,
          });
          
          return { success: true, created: true };
        } catch (error) {
          // If insert fails due to unique constraint (record exists),
          // update the existing record atomically
          if (error instanceof Error && 
              (error.message.includes('Duplicate entry') || 
               error.message.includes('unique constraint'))) {
            
            // Use UPDATE with WHERE clause for atomic increment
            const result = await tx
              .update(LightfastChatUsage)
              .set({
                nonPremiumMessages: sql`${LightfastChatUsage.nonPremiumMessages} + ${input.count}`
              })
              .where(
                and(
                  eq(LightfastChatUsage.clerkUserId, userId),
                  eq(LightfastChatUsage.period, input.period)
                )
              );
            
            return { success: true, created: false };
          }
          
          // Re-throw unexpected errors
          throw error;
        }
      });
    }),

  /**
   * Increment premium message usage
   * Uses atomic upsert within transaction to prevent race conditions
   */
  incrementPremium: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format"),
        count: z.number().positive().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      
      // Use transaction for atomic upsert to prevent race conditions
      return await db.transaction(async (tx) => {
        try {
          // Attempt to insert new record
          await tx.insert(LightfastChatUsage).values({
            clerkUserId: userId,
            period: input.period,
            nonPremiumMessages: 0,
            premiumMessages: input.count,
          });
          
          return { success: true, created: true };
        } catch (error) {
          // If insert fails due to unique constraint (record exists),
          // update the existing record atomically
          if (error instanceof Error && 
              (error.message.includes('Duplicate entry') || 
               error.message.includes('unique constraint'))) {
            
            // Use UPDATE with WHERE clause for atomic increment
            const result = await tx
              .update(LightfastChatUsage)
              .set({
                premiumMessages: sql`${LightfastChatUsage.premiumMessages} + ${input.count}`
              })
              .where(
                and(
                  eq(LightfastChatUsage.clerkUserId, userId),
                  eq(LightfastChatUsage.period, input.period)
                )
              );
            
            return { success: true, created: false };
          }
          
          // Re-throw unexpected errors
          throw error;
        }
      });
    }),

  /**
   * Check if user has exceeded usage limits
   */
  checkLimits: protectedProcedure
    .input(
      z.object({
        period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format").optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const period = input.period || (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      })();

      const usage = await getUsageByPeriod(ctx.session.userId, period);

      // Define limits based on user plan
      // These could come from user subscription data in the future
      const limits = {
        free: {
          nonPremiumMessages: 1000,
          premiumMessages: 0,
        },
        plus: {
          nonPremiumMessages: 1000,
          premiumMessages: 100,
        },
      };

      // For now, assume all users are on free plan
      // In the future, fetch actual user plan from subscription data
      const userPlan = 'free';
      const planLimits = limits[userPlan];

      return {
        period,
        usage,
        limits: planLimits,
        exceeded: {
          nonPremiumMessages: usage.nonPremiumMessages > planLimits.nonPremiumMessages,
          premiumMessages: usage.premiumMessages > planLimits.premiumMessages,
        },
        remainingQuota: {
          nonPremiumMessages: Math.max(0, planLimits.nonPremiumMessages - usage.nonPremiumMessages),
          premiumMessages: Math.max(0, planLimits.premiumMessages - usage.premiumMessages),
        },
      };
    }),

  /**
   * Get usage history for multiple periods
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        months: z.number().min(1).max(12).default(6), // Get last N months
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      const results = [];
      
      // Generate periods for the last N months
      for (let i = 0; i < input.months; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const usage = await getUsageByPeriod(userId, period);
        
        results.push(usage);
      }
      
      return results.sort((a, b) => a.period.localeCompare(b.period));
    }),

  /**
   * Reserve quota atomically - prevents race conditions
   * This replaces the separate check + track pattern with atomic reservation
   */
  reserveQuota: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        modelId: z.string(),
        messageId: z.string(), // For idempotency
        messageType: z.enum(['premium', 'standard']),
        period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.transaction(async (tx) => {
        // Check if reservation already exists for this message (idempotency)
        const existingReservation = await tx
          .select()
          .from(LightfastChatQuotaReservation)
          .where(eq(LightfastChatQuotaReservation.messageId, input.messageId))
          .limit(1);

        if (existingReservation[0]) {
          if (existingReservation[0].status === RESERVATION_STATUS.RESERVED) {
            // Return existing reservation
            return { id: existingReservation[0].id, alreadyReserved: true };
          } else {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Message already processed",
            });
          }
        }

        // Get current usage and calculate limits
        const usage = await getUsageByPeriod(input.userId, input.period);
        
        // Count active reservations
        const activeReservations = await tx
          .select({
            premium: sql<number>`SUM(CASE WHEN message_type = 'premium' THEN 1 ELSE 0 END)`,
            standard: sql<number>`SUM(CASE WHEN message_type = 'standard' THEN 1 ELSE 0 END)`,
          })
          .from(LightfastChatQuotaReservation)
          .where(
            and(
              eq(LightfastChatQuotaReservation.clerkUserId, input.userId),
              eq(LightfastChatQuotaReservation.period, input.period),
              eq(LightfastChatQuotaReservation.status, RESERVATION_STATUS.RESERVED)
            )
          );

        // Define limits (should come from user subscription in future)
        const limits = {
          free: { nonPremiumMessages: 1000, premiumMessages: 0 },
          plus: { nonPremiumMessages: 1000, premiumMessages: 100 },
        };
        const userPlan = 'free'; // TODO: Get actual user plan
        const planLimits = limits[userPlan];

        // Calculate effective usage including active reservations
        const reservedPremium = Number(activeReservations[0]?.premium) || 0;
        const reservedStandard = Number(activeReservations[0]?.standard) || 0;

        const effectiveUsage = {
          premium: usage.premiumMessages + reservedPremium,
          standard: usage.nonPremiumMessages + reservedStandard,
        };

        // Check quota limits
        const requestedType = input.messageType === 'premium' ? 'premium' : 'standard';
        const currentUsage = requestedType === 'premium' ? effectiveUsage.premium : effectiveUsage.standard;
        const limit = requestedType === 'premium' ? planLimits.premiumMessages : planLimits.nonPremiumMessages;

        if (currentUsage >= limit) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Quota exceeded for ${requestedType} messages`,
            cause: {
              type: 'quota_exceeded',
              currentUsage,
              limit,
              remainingQuota: Math.max(0, limit - currentUsage),
            },
          });
        }

        // Create reservation
        const reservation = await tx.insert(LightfastChatQuotaReservation).values({
          clerkUserId: input.userId,
          messageId: input.messageId,
          modelId: input.modelId,
          messageType: input.messageType,
          period: input.period,
          status: RESERVATION_STATUS.RESERVED,
        });

        return { 
          id: reservation.insertId.toString(),
          alreadyReserved: false,
          remainingQuota: Math.max(0, limit - currentUsage - 1),
        };
      });
    }),

  /**
   * Confirm quota reservation - converts reservation to actual usage
   */
  confirmReservation: protectedProcedure
    .input(
      z.object({
        reservationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.transaction(async (tx) => {
        // Get reservation details
        const reservation = await tx
          .select()
          .from(LightfastChatQuotaReservation)
          .where(eq(LightfastChatQuotaReservation.id, input.reservationId))
          .limit(1);

        if (!reservation[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Reservation not found",
          });
        }

        if (reservation[0].status !== RESERVATION_STATUS.RESERVED) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Reservation already ${reservation[0].status}`,
          });
        }

        // Mark reservation as confirmed
        await tx
          .update(LightfastChatQuotaReservation)
          .set({
            status: RESERVATION_STATUS.CONFIRMED,
            completedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(LightfastChatQuotaReservation.id, input.reservationId));

        // Convert to actual usage using existing increment logic
        if (reservation[0].messageType === 'premium') {
          await incrementPremiumUsage(tx, reservation[0].clerkUserId, reservation[0].period);
        } else {
          await incrementNonPremiumUsage(tx, reservation[0].clerkUserId, reservation[0].period);
        }

        return { success: true };
      });
    }),

  /**
   * Release quota reservation - returns quota to user
   */
  releaseReservation: protectedProcedure
    .input(
      z.object({
        reservationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.transaction(async (tx) => {
        // Get reservation details
        const reservation = await tx
          .select()
          .from(LightfastChatQuotaReservation)
          .where(eq(LightfastChatQuotaReservation.id, input.reservationId))
          .limit(1);

        if (!reservation[0]) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Reservation not found",
          });
        }

        if (reservation[0].status !== RESERVATION_STATUS.RESERVED) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Reservation already ${reservation[0].status}`,
          });
        }

        // Mark reservation as released
        await tx
          .update(LightfastChatQuotaReservation)
          .set({
            status: RESERVATION_STATUS.RELEASED,
            completedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(LightfastChatQuotaReservation.id, input.reservationId));

        return { success: true };
      });
    }),

  /**
   * Cleanup expired reservations - background job
   */
  cleanupExpiredReservations: protectedProcedure
    .input(
      z.object({
        expiredBefore: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.transaction(async (tx) => {
        // Find expired reservations
        const expiredReservations = await tx
          .select()
          .from(LightfastChatQuotaReservation)
          .where(
            and(
              eq(LightfastChatQuotaReservation.status, RESERVATION_STATUS.RESERVED),
              lt(LightfastChatQuotaReservation.createdAt, input.expiredBefore)
            )
          );

        if (expiredReservations.length === 0) {
          return { cleaned: 0 };
        }

        // Mark them as expired
        const expiredIds = expiredReservations.map(r => r.id);
        await tx
          .update(LightfastChatQuotaReservation)
          .set({
            status: RESERVATION_STATUS.EXPIRED,
            completedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(LightfastChatQuotaReservation.status, RESERVATION_STATUS.RESERVED),
              lt(LightfastChatQuotaReservation.createdAt, input.expiredBefore)
            )
          );

        return { cleaned: expiredReservations.length };
      });
    }),
} satisfies TRPCRouterRecord;