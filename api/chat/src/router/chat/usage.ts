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
import { toZonedTime, format } from "date-fns-tz";
import { differenceInDays } from "date-fns";
import { isWithinInterval } from "date-fns";
import { clerkClient } from "@clerk/nextjs/server";
import type { CommerceSubscription, CommerceSubscriptionItem } from "@clerk/backend";

// Shared period calculation function for consistent billing logic across the system
export async function calculateBillingPeriod(userId: string, timezone: string = 'UTC'): Promise<string> {
  const subscriptionData = await getUserSubscriptionData(userId);
  const { subscription, hasActiveSubscription } = subscriptionData;

  if (!subscription || !hasActiveSubscription) {
    // Free users: use calendar month in user timezone
    const now = toZonedTime(new Date(), timezone);
    return format(now, 'yyyy-MM');
  } else {
    // Paid users: use actual billing anniversary periods based on subscription cycles
    const activePaidItem = subscription.subscriptionItems?.find(item => 
      !['cplan_free', 'free-tier'].includes(item?.plan?.id ?? "") &&
      !['cplan_free', 'free-tier'].includes(item?.plan?.name ?? "")
    );
    
    if (activePaidItem?.periodStart && activePaidItem.periodEnd) {
      const now = toZonedTime(new Date(), timezone);
      const periodStart = toZonedTime(new Date(activePaidItem.periodStart), timezone);
      const periodEnd = toZonedTime(new Date(activePaidItem.periodEnd), timezone);
      
      // Check if we're within the current subscription period
      if (isWithinInterval(now, { start: periodStart, end: periodEnd })) {
        // Use billing anniversary date as period identifier (YYYY-MM-DD format)
        // This ensures quotas reset on billing anniversary, not calendar month
        const billingPeriodId = format(periodStart, 'yyyy-MM-dd');
        
        console.log(`[Billing] User ${userId} in billing period ${billingPeriodId} (${activePaidItem.planPeriod} plan)`);
        return billingPeriodId;
      }
    }
    
    // Fallback to calendar month if subscription data is incomplete
    const now = toZonedTime(new Date(), timezone);
    return format(now, 'yyyy-MM');
  }
}

// Shared subscription data interface
interface SubscriptionData {
  subscription: CommerceSubscription | null;
  planKey: 'free' | 'plus';
  hasActiveSubscription: boolean;
  billingInterval: 'month' | 'annual';
  error?: string; // Track if there was an error fetching subscription
}

// Shared function to get user subscription data from Clerk
async function getUserSubscriptionData(userId: string): Promise<SubscriptionData> {
  let subscription: CommerceSubscription | null = null;
  let billingInterval: 'month' | 'annual' = 'month';
  let hasActiveSubscription = false;
  let planKey: 'free' | 'plus' = 'free';
  
  try {
    const client = await clerkClient();
    const billingData = await client.billing.getUserBillingSubscription(userId);
    
    if (billingData) {
      subscription = billingData;
      
      // Extract billing interval from subscription items with validation
      // Match exact logic from billing.ts router
      let paidItems: CommerceSubscriptionItem[] = [];
      try {
        const freeTierPlanIds = ["cplan_free", "free-tier"];
        const allSubscriptionItems = billingData.subscriptionItems ?? [];
        
        paidItems = allSubscriptionItems.filter((item: CommerceSubscriptionItem) => 
          !freeTierPlanIds.includes(item?.plan?.id ?? "") && 
          !freeTierPlanIds.includes(item?.plan?.name ?? "")
        );
        
        if (paidItems.length > 0) {
          planKey = 'plus';
          // Extract billing interval following billing.ts pattern
          billingInterval = paidItems[0]?.planPeriod === "annual" ? "annual" : "month";
          
          console.log(`[Billing] User ${userId} has plus plan with ${paidItems.length} paid items`);
        } else {
          console.log(`[Billing] User ${userId} has free plan`);
        }
      } catch (itemError) {
        console.error('Error parsing subscription items:', itemError, { userId });
        // Default to free tier if subscription items can't be parsed
        planKey = 'free';
        paidItems = [];
      }
      
      // Enhanced active subscription detection matching billing.ts exactly:
      // status === "active" AND paidSubscriptionItems.length > 0
      if (typeof billingData.status === 'string') {
        hasActiveSubscription = billingData.status === 'active' && paidItems.length > 0;
      } else {
        console.warn(`Unexpected subscription status format: ${typeof billingData.status}`, { userId, status: billingData.status });
        hasActiveSubscription = false;
      }
    } else {
      console.log(`[Billing] No billing data found for user ${userId}, defaulting to free tier`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Billing] Failed to fetch subscription for user ${userId}:`, errorMessage, error);
    
    // For production: might want to differentiate between network errors vs auth errors
    // Network errors: retry or allow with free tier
    // Auth errors: might need to block or alert
    
    return {
      subscription: null,
      planKey: 'free',
      hasActiveSubscription: false,
      billingInterval: 'month',
      error: `Clerk API error: ${errorMessage}`,
    };
  }
  
  return {
    subscription,
    planKey,
    hasActiveSubscription,
    billingInterval,
  };
}

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
        period: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Period must be in YYYY-MM or YYYY-MM-DD format"),
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
        period: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Period must be in YYYY-MM or YYYY-MM-DD format"),
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
        period: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Period must be in YYYY-MM or YYYY-MM-DD format"),
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
   * Enhanced with real subscription data and grace period logic
   */
  checkLimits: protectedProcedure
    .input(
      z.object({
        period: z.string().optional(), // Flexible format: YYYY-MM or YYYY-MM-DD
        timezone: z.string().default('UTC'), // User timezone for period calculation
      })
    )
    .query(async ({ ctx, input }) => {
      // Get subscription data using shared function
      const { subscription, planKey, hasActiveSubscription, billingInterval } = await getUserSubscriptionData(ctx.session.userId);
      
      // Calculate billing period using shared function for consistency
      const period = input.period || await calculateBillingPeriod(ctx.session.userId, input.timezone);
      
      const usage = await getUsageByPeriod(ctx.session.userId, period);

      // Define limits based on actual plan
      const limits = {
        free: { nonPremiumMessages: 1000, premiumMessages: 0 },
        plus: { nonPremiumMessages: 1000, premiumMessages: 100 },
      };
      
      const planLimits = limits[planKey as keyof typeof limits] || limits.free;
      
      // Enhanced grace period logic with real date calculation
      const inGracePeriod = subscription?.status === 'past_due';
      let graceDaysRemaining = 0;
      
      if (inGracePeriod && subscription?.pastDueAt) {
        // Calculate days since payment failure using pastDueAt timestamp
        const failureDate = toZonedTime(new Date(subscription.pastDueAt), input.timezone);
        const now = toZonedTime(new Date(), input.timezone);
        const daysSinceFailure = differenceInDays(now, failureDate);
        
        // 7-day grace period
        graceDaysRemaining = Math.max(0, 7 - daysSinceFailure);
      }
      
      // Apply grace period restrictions
      const effectiveLimits = inGracePeriod 
        ? { ...planLimits, premiumMessages: 0 } // Restrict premium in grace period
        : planLimits;

      return {
        period,
        usage,
        limits: effectiveLimits,
        exceeded: {
          nonPremiumMessages: usage.nonPremiumMessages >= effectiveLimits.nonPremiumMessages,
          premiumMessages: usage.premiumMessages >= effectiveLimits.premiumMessages,
        },
        remainingQuota: {
          nonPremiumMessages: Math.max(0, effectiveLimits.nonPremiumMessages - usage.nonPremiumMessages),
          premiumMessages: Math.max(0, effectiveLimits.premiumMessages - usage.premiumMessages),
        },
        // Enhanced information
        subscription: {
          planKey,
          status: subscription?.status,
          hasActiveSubscription,
          billingInterval,
        },
        gracePeriod: {
          active: inGracePeriod,
          daysRemaining: graceDaysRemaining,
          originalLimits: inGracePeriod ? planLimits : undefined,
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
        period: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Period must be in YYYY-MM or YYYY-MM-DD format"),
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

        // Get real user subscription data for quota limits
        const { planKey: userPlan } = await getUserSubscriptionData(input.userId);
        
        // Define limits based on actual subscription
        const limits = {
          free: { nonPremiumMessages: 1000, premiumMessages: 0 },
          plus: { nonPremiumMessages: 1000, premiumMessages: 100 },
        };
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