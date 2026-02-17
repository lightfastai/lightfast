import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { clerkClient } from "@clerk/nextjs/server";
import { deriveSubscriptionData } from "@repo/chat-billing";
import type { SubscriptionData, SubscriptionItemData } from "./types";

const billingLogger = {
  info: (message: string, metadata?: Record<string, unknown>) =>
    console.log(message, metadata ?? {}),
  warn: (message: string, metadata?: Record<string, unknown>) =>
    console.warn(message, metadata ?? {}),
  error: (message: string, metadata?: Record<string, unknown>) =>
    console.error(message, metadata ?? {}),
};

export const billingRouter = {
  /**
   * Get user's subscription data with computed state
   * Replicates useSubscriptionState logic server-side for unified data fetching
   */
  getSubscription: protectedProcedure.query(
    async ({
      ctx,
    }): Promise<{
      subscription: SubscriptionData | null;
      paidSubscriptionItems: SubscriptionItemData[];
      freeTierSubscriptionItems: SubscriptionItemData[];
      allSubscriptionItems: SubscriptionItemData[];
      isCanceled: boolean;
      hasActiveSubscription: boolean;
      nextBillingDate: string | null;
      billingInterval: "month" | "annual";
    }> => {
      try {
        const client = await clerkClient();

        // Get the subscription data from Clerk
        const subscription = await client.billing.getUserBillingSubscription(
          ctx.session.userId,
        );
        const derived = deriveSubscriptionData({
          userId: ctx.session.userId,
          subscription,
          options: { logger: billingLogger },
        });

        const subscriptionData: SubscriptionData =
          JSON.parse(JSON.stringify(subscription)) as SubscriptionData;
        const allSubscriptionItems: SubscriptionItemData[] =
          subscriptionData.subscriptionItems;

        const freeTierPlanIds = ["cplan_free", "free-tier"];
        const paidSubscriptionItems = allSubscriptionItems.filter(
          (item) =>
            !freeTierPlanIds.includes(item.plan?.id ?? "") &&
            !freeTierPlanIds.includes(item.plan?.name ?? ""),
        );

        const freeTierSubscriptionItems = allSubscriptionItems.filter(
          (item) =>
            freeTierPlanIds.includes(item.plan?.id ?? "") ||
            freeTierPlanIds.includes(item.plan?.name ?? ""),
        );

        const isCanceled = paidSubscriptionItems[0]?.canceledAt != null;
        const nextBillingDate = subscriptionData.nextPayment?.date;
        const billingInterval = derived.billingInterval;

        return {
          // Raw data (now plain objects)
          subscription: subscriptionData,
          paidSubscriptionItems,
          freeTierSubscriptionItems,
          allSubscriptionItems,

          // Computed state
          isCanceled,
          hasActiveSubscription: derived.hasActiveSubscription,
          nextBillingDate: nextBillingDate
            ? new Date(nextBillingDate).toISOString()
            : null,
          billingInterval,
        };
      } catch (error) {
        console.error(
          `Failed to get subscription for user ${ctx.session.userId}:`,
          error,
        );

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
              billingInterval: "month",
            };
          }

          if (
            error.message.includes("unauthorized") ||
            error.message.includes("forbidden")
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "You don't have permission to access billing information",
            });
          }
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Failed to retrieve subscription information. Please try again later.",
        });
      }
    },
  ),

  /**
   * Cancel a subscription item
   */
  cancelSubscriptionItem: protectedProcedure
    .input(
      z.object({
        subscriptionItemId: z
          .string()
          .min(1, "Subscription item ID is required"),
        endNow: z.boolean().default(false),
      }),
    )
    .mutation(
      async ({
        ctx: _ctx,
        input,
      }): Promise<{
        success: boolean;
        subscriptionItem: SubscriptionItemData;
      }> => {
        try {
          const client = await clerkClient();

          // Cancel the subscription item using Clerk's billing API
          const result = await client.billing.cancelSubscriptionItem(
            input.subscriptionItemId,
            { endNow: input.endNow },
          );

          return {
            success: true,
            subscriptionItem: JSON.parse(
              JSON.stringify(result),
            ) as SubscriptionItemData,
          };
        } catch (error) {
          console.error(
            `Failed to cancel subscription item ${input.subscriptionItemId}:`,
            error,
          );

          // Handle specific Clerk errors
          if (error instanceof Error) {
            if (error.message.includes("not found")) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Subscription item not found",
              });
            }

            if (
              error.message.includes("unauthorized") ||
              error.message.includes("forbidden")
            ) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message:
                  "You don't have permission to cancel this subscription",
              });
            }
          }

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to cancel subscription. Please try again later.",
          });
        }
      },
    ),
} satisfies TRPCRouterRecord;
