import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { clerkClient } from "@clerk/nextjs/server";

export const billingRouter = {
  /**
   * Get user's billing subscription from Clerk
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      const client = await clerkClient();
      const subscription = await client.billing.getUserBillingSubscription(
        ctx.session.userId,
      );
      return subscription;
    } catch (error) {
      // Preserve intentional TRPCErrors (e.g. ownership checks)
      if (error instanceof TRPCError) throw error;

      console.error(
        `Failed to get subscription for user ${ctx.session.userId}:`,
        error,
      );

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return null;
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
  }),

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
    .mutation(async ({ ctx, input }) => {
      try {
        const client = await clerkClient();

        // Verify ownership: item must belong to requesting user
        const subscription =
          await client.billing.getUserBillingSubscription(
            ctx.session.userId,
          );
        const ownsItem = subscription.subscriptionItems.some(
          (item) => item.id === input.subscriptionItemId,
        );
        if (!ownsItem) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "You don't have permission to cancel this subscription",
          });
        }

        await client.billing.cancelSubscriptionItem(
          input.subscriptionItemId,
          { endNow: input.endNow },
        );

        return { success: true as const };
      } catch (error) {
        // Preserve intentional TRPCErrors (e.g. ownership checks)
        if (error instanceof TRPCError) throw error;

        console.error(
          `Failed to cancel subscription item ${input.subscriptionItemId}:`,
          error,
        );

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
    }),
} satisfies TRPCRouterRecord;
