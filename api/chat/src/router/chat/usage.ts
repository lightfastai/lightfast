import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import { 
  LightfastChatUsage,
  insertLightfastChatUsageSchema
} from "@db/chat";
import { eq, and } from "drizzle-orm";

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
      
      // Check if usage record exists
      const existingUsage = await db
        .select()
        .from(LightfastChatUsage)
        .where(
          and(
            eq(LightfastChatUsage.clerkUserId, userId),
            eq(LightfastChatUsage.period, input.period)
          )
        )
        .limit(1);

      if (existingUsage[0]) {
        // Update existing record
        await db
          .update(LightfastChatUsage)
          .set({ 
            nonPremiumMessages: existingUsage[0].nonPremiumMessages + input.count 
          })
          .where(eq(LightfastChatUsage.id, existingUsage[0].id));

        return { success: true, created: false };
      } else {
        // Create new record
        await db.insert(LightfastChatUsage).values({
          clerkUserId: userId,
          period: input.period,
          nonPremiumMessages: input.count,
          premiumMessages: 0,
        });

        return { success: true, created: true };
      }
    }),

  /**
   * Increment premium message usage
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
      
      // Check if usage record exists
      const existingUsage = await db
        .select()
        .from(LightfastChatUsage)
        .where(
          and(
            eq(LightfastChatUsage.clerkUserId, userId),
            eq(LightfastChatUsage.period, input.period)
          )
        )
        .limit(1);

      if (existingUsage[0]) {
        // Update existing record
        await db
          .update(LightfastChatUsage)
          .set({ 
            premiumMessages: existingUsage[0].premiumMessages + input.count 
          })
          .where(eq(LightfastChatUsage.id, existingUsage[0].id));

        return { success: true, created: false };
      } else {
        // Create new record
        await db.insert(LightfastChatUsage).values({
          clerkUserId: userId,
          period: input.period,
          nonPremiumMessages: 0,
          premiumMessages: input.count,
        });

        return { success: true, created: true };
      }
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
} satisfies TRPCRouterRecord;