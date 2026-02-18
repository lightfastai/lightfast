# Billing Router: Pure Clerk Data + Frontend Derivation

## Overview

Make the billing router a thin Clerk proxy — return only the raw `BillingSubscription` from Clerk and move all state derivation (`hasActiveSubscription`, `isCanceled`, `nextBillingDate`, `billingInterval`, `paidSubscriptionItems`) to the frontend hook. Delete the custom `types.ts` and all `JSON.parse(JSON.stringify(...))` serialization.

## Current State Analysis

### The Problem

The billing router fetches a `BillingSubscription` from Clerk, derives computed state server-side (`isCanceled`, `nextBillingDate`, etc.), and returns a bloated response mixing raw data with computed fields. The custom `types.ts` has field mismatches (`value` vs `amount`) and is dead code.

### Key Discoveries

- **SuperJSON configured**: `api/chat/src/trpc.ts:77` — tRPC handles class-to-JSON serialization automatically
- **4 frontend consumers** — none access money amounts; only use derived booleans/strings and `paidSubscriptionItems[0]?.id`
- **Cancel mutation result unused** — `onSuccess` just calls `refreshSubscription()` and `revalidatePayments()`
- **`deriveSubscriptionData`** is a pure function; its logic (filter paid items, check status) is trivial to inline in the frontend hook
- **`@repo/chat-billing` already used client-side** — `billing-management.tsx`, `cancellation-section.tsx`, `plan-header-section.tsx` all import `ClerkPlanKey`

### Code References

| File | Lines | Role |
|---|---|---|
| `api/chat/src/router/billing/billing.ts` | 1–215 | tRPC billing router |
| `api/chat/src/router/billing/types.ts` | 1–55 | Custom types (to delete) |
| `apps/chat/src/hooks/use-billing-data.ts` | 1–63 | Frontend hook (gets derivation logic) |
| `apps/chat/src/components/billing-management.tsx` | 1–45 | Uses `subscription.hasActiveSubscription` |
| `apps/chat/src/components/cancellation-section.tsx` | 1–142 | Uses `subscription.billingInterval`, `subscription.paidSubscriptionItems` |
| `apps/chat/src/components/plan-header-section.tsx` | 1–111 | Uses `hasActiveSubscription`, `isCanceled`, `nextBillingDate` from hook |
| `packages/chat-billing/src/subscription.ts` | 28–93 | `deriveSubscriptionData` (unchanged, still used by other server-side consumers) |

## Desired End State

**Backend** returns pure Clerk data:
- `getSubscription` → `BillingSubscription | null`
- `cancelSubscriptionItem` → `{ success: true }`

**Frontend hook** (`use-billing-data.ts`) derives all state from the raw subscription:
- `paidSubscriptionItems` — filtered from `subscription.subscriptionItems`
- `hasActiveSubscription` — `subscription.status === "active" && paidItems.length > 0`
- `isCanceled` — `paidItems[0]?.canceledAt != null`
- `nextBillingDate` — `subscription.nextPayment?.date` formatted as ISO string
- `billingInterval` — `paidItems[0]?.planPeriod === "annual" ? "annual" : "month"`

**Consumer components** — minimal changes to destructure from hook instead of `subscription` object.

### Verification

- `pnpm --filter @api/chat typecheck` passes
- `pnpm --filter @lightfast/chat typecheck` passes
- `pnpm --filter @lightfast/chat lint` passes
- `pnpm build:chat` succeeds

## What We're NOT Doing

- **Not refactoring `@repo/chat-billing`** — `deriveSubscriptionData` stays for other server-side consumers
- **Not adding Zod output schemas** — tRPC infers return types
- **Not restructuring the frontend component tree** — just moving derivation to the hook

## Implementation Approach

Two phases: (1) slim down the backend to pure Clerk data, (2) move derivation to the frontend hook and update consumers.

---

## Phase 1: Backend — Pure Clerk Proxy

### Overview

Strip the billing router to return only raw Clerk types. Delete `types.ts`, remove `deriveSubscriptionData`, remove `JSON.parse(JSON.stringify(...))`.

### Changes Required

#### 1. Delete `types.ts`

**File**: `api/chat/src/router/billing/types.ts`
**Action**: Delete the entire file

#### 2. Simplify `billing.ts`

**File**: `api/chat/src/router/billing/billing.ts`

The entire file becomes:

```typescript
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
```

**What changed vs current**:
- Removed `import { deriveSubscriptionData } from "@repo/chat-billing"`
- Removed `import type { SubscriptionData, SubscriptionItemData } from "./types"`
- Removed `billingLogger` (only used by `deriveSubscriptionData`)
- `getSubscription`: returns `subscription` directly (or `null` on not-found) — no derivation, no serialization
- `cancelSubscriptionItem`: drops `subscriptionItem` from return (unused by consumers), returns `{ success: true }`

### Success Criteria (Phase 1)

#### Automated Verification
- [x] `pnpm --filter @api/chat typecheck` — passes (backend types clean)

---

## Phase 2: Frontend — Derive State from Raw Subscription

### Overview

Move all computed billing state into `use-billing-data.ts`. Update the two consumer components that destructure from `subscription` to destructure from the hook instead.

### Changes Required

#### 1. Update `use-billing-data.ts`

**File**: `apps/chat/src/hooks/use-billing-data.ts`

```typescript
"use client";

import { useMemo } from "react";
import { usePaymentAttempts } from "@clerk/nextjs/experimental";
import { useTRPC } from "@repo/chat-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

const FREE_PLAN_IDS = ["cplan_free", "free-tier"];

export function useBillingData() {
  const trpc = useTRPC();

  const { data: subscription, refetch: refetchSubscription } =
    useSuspenseQuery({
      ...trpc.billing.getSubscription.queryOptions(),
      staleTime: 2 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });

  const {
    data: paymentAttempts,
    isLoading: paymentsLoading,
    error: paymentsError,
    revalidate: revalidatePaymentAttempts,
  } = usePaymentAttempts();

  // Derive billing state from raw Clerk subscription
  const derived = useMemo(() => {
    if (!subscription) {
      return {
        paidSubscriptionItems: [] as typeof subscription extends null
          ? never[]
          : never,
        hasActiveSubscription: false,
        isCanceled: false,
        nextBillingDate: null as string | null,
        billingInterval: "month" as const,
      };
    }

    const allItems = subscription.subscriptionItems ?? [];
    const paidSubscriptionItems = allItems.filter((item) => {
      const planId = item?.plan?.id ?? "";
      const planName = item?.plan?.name ?? "";
      return (
        !FREE_PLAN_IDS.includes(planId) && !FREE_PLAN_IDS.includes(planName)
      );
    });

    const hasActiveSubscription =
      subscription.status === "active" && paidSubscriptionItems.length > 0;
    const isCanceled = paidSubscriptionItems[0]?.canceledAt != null;
    const nextPaymentDate = subscription.nextPayment?.date;
    const nextBillingDate = nextPaymentDate
      ? new Date(nextPaymentDate).toISOString()
      : null;
    const billingInterval =
      paidSubscriptionItems[0]?.planPeriod === "annual"
        ? ("annual" as const)
        : ("month" as const);

    return {
      paidSubscriptionItems,
      hasActiveSubscription,
      isCanceled,
      nextBillingDate,
      billingInterval,
    };
  }, [subscription]);

  const sortedPayments = useMemo(() => {
    if (!paymentAttempts) return [];
    return [...paymentAttempts].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [paymentAttempts]);

  const failedPayments = useMemo(() => {
    return sortedPayments.filter((attempt) => attempt.status === "failed");
  }, [sortedPayments]);

  return {
    // Raw Clerk subscription
    subscription,
    refreshSubscription: () =>
      refetchSubscription().catch(() => undefined),

    // Derived billing state
    ...derived,

    // Payment data
    payments: sortedPayments,
    failedPayments,
    paymentsLoading,
    paymentsError,
    revalidatePayments: () =>
      revalidatePaymentAttempts().catch(() => undefined),
  };
}
```

**What changed vs current**:
- `subscription` is now the raw Clerk type (or `null`), not the enriched tRPC response object
- Added `useMemo` derivation block that computes `paidSubscriptionItems`, `hasActiveSubscription`, `isCanceled`, `nextBillingDate`, `billingInterval`
- All derived fields returned as top-level properties (same as before for `hasActiveSubscription`, `isCanceled`, `nextBillingDate`; newly promoted for `paidSubscriptionItems`, `billingInterval`)

#### 2. Update `billing-management.tsx`

**File**: `apps/chat/src/components/billing-management.tsx`

```diff
  export function BillingManagement({ currentPlan }: BillingManagementProps) {
- 	const { subscription } = useBillingData();
-
- 	// Determine plan state from subscription data
- 	const isPaidPlan = subscription.hasActiveSubscription || currentPlan === ClerkPlanKey.PLUS_TIER;
+ 	const { hasActiveSubscription } = useBillingData();
+
+ 	const isPaidPlan = hasActiveSubscription || currentPlan === ClerkPlanKey.PLUS_TIER;
  	const isFreePlan = !isPaidPlan;
```

#### 3. Update `cancellation-section.tsx`

**File**: `apps/chat/src/components/cancellation-section.tsx`

```diff
  export function CancellationSection({ currentPlan }: CancellationSectionProps) {
  	const trpc = useTRPC();
  	const {
- 		subscription,
  		hasActiveSubscription,
  		isCanceled,
  		refreshSubscription,
  		revalidatePayments,
+ 		billingInterval,
+ 		paidSubscriptionItems,
  	} = useBillingData();
-
- 	// Extract subscription state from query data
- 	const {
- 		billingInterval = "month" as const,
- 		paidSubscriptionItems = [],
- 	} = subscription;
  	const router = useRouter();
```

#### 4. `plan-header-section.tsx` — No Changes

This component already destructures `hasActiveSubscription`, `isCanceled`, `nextBillingDate` from `useBillingData()` directly. No change needed.

### Success Criteria (Phase 2)

#### Automated Verification
- [x] `pnpm --filter @lightfast/chat typecheck` — frontend types resolve
- [x] `pnpm --filter @lightfast/chat lint` — no lint errors (pre-existing billing.test.ts + artifacts/index.ts issues excluded)
- [x] `pnpm build:chat` — full build succeeds

#### Manual Verification
- [x] Billing page loads and displays correct subscription status
- [x] Cancel subscription flow works (mutation fires, page redirects to `/billing/cancelled`)
- [x] Free tier users see free plan features section
- [x] Cancelled users see "Upgrade Plan" button

**Implementation Note**: After automated verification passes, pause for manual confirmation before considering the task complete.

---

## Testing Strategy

### Type Safety
- TypeScript compilation confirms all consumer access patterns are valid
- tRPC infers the return type from `BillingSubscription | null`, so the client-side type updates automatically

### Runtime Safety
- SuperJSON serializes Clerk class instances (data-only properties) identically to `JSON.parse(JSON.stringify(...))`
- Frontend derivation logic mirrors `deriveSubscriptionData` exactly (same filter, same checks)

### No New Tests Needed
- Pure refactor — behavior is identical. Same derived values, computed in a different location.

## References

- Research: `thoughts/shared/research/2026-02-17-billing-router-clerk-interface.md`
- SuperJSON transformer: `api/chat/src/trpc.ts:77`
- Clerk type definitions: `node_modules/.pnpm/@clerk+backend@2.18.3_.../dist/api/resources/CommerceSubscription.d.ts`
