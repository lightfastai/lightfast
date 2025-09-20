import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { clerkClient } from "@clerk/nextjs/server";

export const billingRouter = {
  /**
   * Get user's subscription data with computed state
   * Replicates useSubscriptionState logic server-side for unified data fetching
   */
  getSubscription: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const client = await clerkClient();
        
        // Get the subscription data from Clerk
        const subscription = await client.billing.getUserBillingSubscription(ctx.session.userId);

        // Convert Clerk class instances to plain objects using JSON serialization
        // This handles all nested objects and class instances automatically
        const subscriptionData = subscription ? JSON.parse(JSON.stringify(subscription)) : null;

        // Separate free tier and paid subscription items instead of filtering completely
        const freeTierPlanIds = ["cplan_free", "free-tier"];
        const allSubscriptionItems = subscriptionData?.subscriptionItems ?? [];
        
        const paidSubscriptionItems = allSubscriptionItems.filter(
          (item: any) => !freeTierPlanIds.includes(item?.plan?.id ?? "") && 
                        !freeTierPlanIds.includes(item?.plan?.name ?? "")
        );
        
        const freeTierSubscriptionItems = allSubscriptionItems.filter(
          (item: any) => freeTierPlanIds.includes(item?.plan?.id ?? "") || 
                        freeTierPlanIds.includes(item?.plan?.name ?? "")
        );

        // Compute derived state (matching useSubscriptionState logic)
        const isCanceled = paidSubscriptionItems[0]?.canceledAt != null;
        const hasActiveSubscription = subscriptionData?.status === "active" && paidSubscriptionItems.length > 0;
        const nextBillingDate = subscriptionData?.nextPayment?.date;
        
        // Get billing interval from subscription
        const billingInterval = paidSubscriptionItems.length > 0 && paidSubscriptionItems[0]?.planPeriod === "annual"
          ? "annual" as const
          : "month" as const;

        return {
          // Raw data (now plain objects)
          subscription: subscriptionData,
          paidSubscriptionItems,
          freeTierSubscriptionItems,
          allSubscriptionItems,
          
          // Computed state
          isCanceled,
          hasActiveSubscription,
          nextBillingDate: nextBillingDate ? new Date(nextBillingDate).toISOString() : null,
          billingInterval,
        };
      } catch (error) {
        console.error(`Failed to get subscription for user ${ctx.session.userId}:`, error);
        
        // Handle specific Clerk errors
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            // Return null subscription data instead of throwing
            return {
              subscription: null,
              paidSubscriptionItems: [],
              freeTierSubscriptionItems: [],
              allSubscriptionItems: [],
              isCanceled: false,
              hasActiveSubscription: false,
              nextBillingDate: null,
              billingInterval: "month" as const,
            };
          }
          
          if (error.message.includes("unauthorized") || error.message.includes("forbidden")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have permission to access billing information",
            });
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve subscription information. Please try again later.",
        });
      }
    }),

  /**
   * Cancel a subscription item
   */
  cancelSubscriptionItem: protectedProcedure
    .input(
      z.object({
        subscriptionItemId: z.string().min(1, "Subscription item ID is required"),
        endNow: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const client = await clerkClient();
        
        // Cancel the subscription item using Clerk's billing API
        const result = await client.billing.cancelSubscriptionItem(
          input.subscriptionItemId,
          { endNow: input.endNow }
        );

        return {
          success: true,
          subscriptionItem: result,
        } as const;
      } catch (error) {
        console.error(`Failed to cancel subscription item ${input.subscriptionItemId}:`, error);
        
        // Handle specific Clerk errors
        if (error instanceof Error) {
          if (error.message.includes("not found")) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Subscription item not found",
            });
          }
          
          if (error.message.includes("unauthorized") || error.message.includes("forbidden")) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You don't have permission to cancel this subscription",
            });
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription. Please try again later.",
        });
      }
    }),
} satisfies TRPCRouterRecord;