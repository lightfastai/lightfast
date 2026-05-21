import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { z } from "zod";

import { orgAdminProcedure, orgProcedure } from "../../trpc";

function stripClerkResourcePrototypes<T>(value: T): T {
  return stripClerkResourcePrototypesInner(value, new WeakMap()) as T;
}

function stripClerkResourcePrototypesInner(
  value: unknown,
  seen: WeakMap<object, unknown>
): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (Array.isArray(value)) {
    const array: unknown[] = [];
    seen.set(value, array);
    for (const item of value) {
      array.push(stripClerkResourcePrototypesInner(item, seen));
    }
    return array;
  }

  const plain: Record<string, unknown> = {};
  seen.set(value, plain);
  for (const [key, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue !== "function") {
      plain[key] = stripClerkResourcePrototypesInner(nestedValue, seen);
    }
  }
  return plain;
}

export const orgBillingRouter = {
  overview: orgProcedure.query(async ({ ctx }) => {
    const clerk = await clerkClient();
    const [plans, subscription] = await Promise.all([
      clerk.billing.getPlanList({ limit: 100, payerType: "org" }),
      clerk.billing.getOrganizationBillingSubscription(ctx.auth.identity.orgId),
    ]);

    return {
      plans: stripClerkResourcePrototypes(plans.data),
      subscription: stripClerkResourcePrototypes(subscription),
    };
  }),

  cancelSubscriptionItem: orgAdminProcedure
    .input(z.object({ subscriptionItemId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const clerk = await clerkClient();
      const subscription =
        await clerk.billing.getOrganizationBillingSubscription(
          ctx.auth.identity.orgId
        );
      const item = subscription.subscriptionItems.find(
        (subscriptionItem) => subscriptionItem.id === input.subscriptionItemId
      );
      if (!item) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Subscription item does not belong to this organization",
        });
      }
      if (item.plan?.slug !== "team") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only the Team plan can be canceled",
        });
      }

      const canceledItem = await clerk.billing.cancelSubscriptionItem(
        input.subscriptionItemId,
        {
          endNow: false,
        }
      );
      return stripClerkResourcePrototypes(canceledItem);
    }),
} satisfies TRPCRouterRecord;
