import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { clerkClient } from "@clerk/nextjs/server";

export const billingRouter = {
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