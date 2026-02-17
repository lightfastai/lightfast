# Subscription.ts Cleanup: Remove Redundant Abstractions

## Overview

Strip `packages/chat-billing/src/subscription.ts` of its unnecessary interfaces and indirection. The file currently wraps Clerk's billing API behind custom types (`BillingLogger`, `BillingSubscriptionFetcher`, `SubscriptionData`) that add complexity without value. Replace with direct Clerk usage and simple functions.

## Current State Analysis

### The Problem

`subscription.ts` exports 5 interfaces and 4 functions for what amounts to: filter paid items, check status, calculate billing period. Every consumer already has `clerkClient()` access and wraps the functions in local helpers anyway.

### What Consumers Actually Use

| Consumer | What it calls | What it needs |
|---|---|---|
| `usage.ts:getUserSubscriptionData` | `fetchSubscriptionData(userId, fetcher, opts)` | `planKey`, `hasActiveSubscription`, `subscription.status`, `subscription.pastDueAt`, `billingInterval` |
| `usage.ts:calculateBillingPeriod` | `calculateBillingPeriodForUser({...})` | billing period string (e.g. `"2026-02"` or `"2026-02-15"`) |
| `session.ts:create` | `getUserSubscriptionData(userId)` (via usage.ts) | `planKey`, `hasActiveSubscription` |
| `chat-api-services/usage.ts` | `calculateBillingPeriod(userId, tz)` (via @api/chat re-export) | billing period string |

### The Redundancy

1. **`BillingLogger`** — Every caller creates the same `console.log/warn/error` wrapper. Just use `console` directly.
2. **`BillingSubscriptionFetcher`** — An interface wrapping `clerkClient().billing.getUserBillingSubscription()`. Every caller constructs the same object: `{ getUserBillingSubscription: (id) => client.billing.getUserBillingSubscription(id) }`.
3. **`SubscriptionData`** — Custom wrapper mixing raw `BillingSubscription` with derived fields. Consumers destructure what they need and ignore the rest.
4. **`fetchSubscriptionData`** — Fetch + derive + error-handle in one. The error handling silently returns free-tier defaults, hiding Clerk failures.
5. **`deriveSubscriptionData`** — Still has the `[0]` bug (uses `paidSubscriptionItems[0]` instead of `activePaidItem` like the frontend hook).

### Code References

| File | Lines | Role |
|---|---|---|
| `packages/chat-billing/src/subscription.ts` | 1-185 | The file to rewrite |
| `api/chat/src/router/chat/usage.ts` | 29-71 | `billingLogger`, `calculateBillingPeriod`, `getUserSubscriptionData` wrappers |
| `api/chat/src/router/chat/session.ts` | 12, 187-188 | Imports `getUserSubscriptionData` for plan check |
| `api/chat/src/index.ts` | 23 | Re-exports `calculateBillingPeriod` |
| `packages/chat-api-services/src/usage.ts` | 1, 18 | Uses `calculateBillingPeriod` from `@api/chat` |

## Desired End State

**`subscription.ts`** exports two simple functions:

1. `getSubscriptionState(subscription)` — pure function, takes `BillingSubscription | null`, returns derived state (`planKey`, `hasActiveSubscription`, `activePaidItem`, `billingInterval`). No fetching, no logging, no error handling.
2. `calculateBillingPeriod(subscription, options?)` — pure function, takes `BillingSubscription | null` + optional `{ timezone, now }`, returns billing period string.

**`usage.ts`** calls `clerkClient()` directly, passes the result to these functions. No more `BillingSubscriptionFetcher` wrapper. Error handling stays in `usage.ts` where it belongs (the tRPC layer).

**Deleted**: `BillingLogger`, `BillingSubscriptionFetcher`, `SubscriptionData`, `DeriveSubscriptionOptions`, `CalculateBillingPeriodOptions`, `fetchSubscriptionData`, `calculateBillingPeriodForUser`.

### Verification

- `pnpm --filter @repo/chat-billing typecheck` passes
- `pnpm --filter @api/chat typecheck` passes
- `pnpm --filter @lightfast/chat typecheck` passes
- `pnpm build:chat` succeeds

## What We're NOT Doing

- **Not changing the billing router** (`billing.ts`) — already cleaned up
- **Not changing the frontend hook** (`use-billing-data.ts`) — already cleaned up
- **Not changing billing period calculation logic** — same algorithm, just simpler inputs
- **Not changing `chat-api-services/usage.ts`** — it consumes `calculateBillingPeriod` from `@api/chat` which stays the same signature

## Implementation Approach

Single phase: rewrite `subscription.ts`, update `usage.ts` consumers, verify.

---

## Phase 1: Rewrite subscription.ts and Update Consumers

### Overview

Replace the over-abstracted `subscription.ts` with two pure functions. Update `usage.ts` to call Clerk directly and use the new functions.

### Changes Required

#### 1. Rewrite `subscription.ts`

**File**: `packages/chat-billing/src/subscription.ts`

The entire file becomes:

```typescript
import type { BillingSubscription, BillingSubscriptionItem } from "@clerk/backend";
import { format, toZonedTime } from "date-fns-tz";
import { isWithinInterval } from "date-fns";

import type { BillingInterval } from "./types";
import { ClerkPlanKey, getClerkPlanId } from "./types";

export interface SubscriptionState {
  planKey: ClerkPlanKey;
  hasActiveSubscription: boolean;
  activePaidItem: BillingSubscriptionItem | null;
  paidSubscriptionItems: BillingSubscriptionItem[];
  billingInterval: BillingInterval;
}

/**
 * Derive billing state from a raw Clerk subscription.
 * Pure function — no fetching, no logging, no side effects.
 */
export function getSubscriptionState(
  subscription: BillingSubscription | null,
): SubscriptionState {
  const freePlanId = getClerkPlanId(ClerkPlanKey.FREE_TIER);

  if (!subscription) {
    return {
      planKey: ClerkPlanKey.FREE_TIER,
      hasActiveSubscription: false,
      activePaidItem: null,
      paidSubscriptionItems: [],
      billingInterval: "month",
    };
  }

  const paidSubscriptionItems = subscription.subscriptionItems.filter(
    (item) => item.plan?.id !== freePlanId,
  );

  const activePaidItem =
    paidSubscriptionItems.find((item) => item.status === "active") ?? null;

  const planKey =
    paidSubscriptionItems.length > 0
      ? ClerkPlanKey.PLUS_TIER
      : ClerkPlanKey.FREE_TIER;

  const hasActiveSubscription =
    subscription.status === "active" && activePaidItem != null;

  const billingInterval: BillingInterval =
    (activePaidItem ?? paidSubscriptionItems[0])?.planPeriod === "annual"
      ? "annual"
      : "month";

  return {
    planKey,
    hasActiveSubscription,
    activePaidItem,
    paidSubscriptionItems,
    billingInterval,
  };
}

/**
 * Calculate the billing period identifier for a subscription.
 * Returns "YYYY-MM-DD" for active paid subscriptions (based on period start),
 * or "YYYY-MM" for free/inactive users.
 */
export function calculateBillingPeriodFromSubscription(
  subscription: BillingSubscription | null,
  options: { timezone?: string; now?: Date } = {},
): string {
  const { timezone = "UTC", now = new Date() } = options;
  const zonedNow = toZonedTime(now, timezone);

  if (!subscription) {
    return format(zonedNow, "yyyy-MM");
  }

  const { hasActiveSubscription, paidSubscriptionItems } =
    getSubscriptionState(subscription);

  if (!hasActiveSubscription) {
    return format(zonedNow, "yyyy-MM");
  }

  const activePaidItem = paidSubscriptionItems.find((item) =>
    Boolean(item.periodStart && item.periodEnd),
  );

  if (activePaidItem?.periodStart && activePaidItem.periodEnd) {
    const periodStart = toZonedTime(
      new Date(activePaidItem.periodStart),
      timezone,
    );
    const periodEnd = toZonedTime(
      new Date(activePaidItem.periodEnd),
      timezone,
    );

    if (isWithinInterval(zonedNow, { start: periodStart, end: periodEnd })) {
      return format(periodStart, "yyyy-MM-dd");
    }
  }

  return format(zonedNow, "yyyy-MM");
}
```

**What changed vs current**:
- Deleted: `BillingLogger`, `BillingSubscriptionFetcher`, `SubscriptionData`, `DeriveSubscriptionOptions`, `CalculateBillingPeriodOptions`, `fetchSubscriptionData`, `deriveSubscriptionData`, `calculateBillingPeriodForUser`
- `getSubscriptionState` replaces `deriveSubscriptionData` — pure function, no `userId`/`logger`/`fetcher` params, returns `activePaidItem` (fixes `[0]` bug), drops the dead `typeof status === "string"` check
- `calculateBillingPeriodFromSubscription` simplified — takes `BillingSubscription | null` directly instead of `SubscriptionData`
- Removed unused `BillingPlan` import

#### 2. Update `usage.ts`

**File**: `api/chat/src/router/chat/usage.ts`

Replace the wrapper functions (lines 29-71):

```diff
 import {
 	BILLING_LIMITS,
 	ClerkPlanKey,
-	calculateBillingPeriodForUser,
-	fetchSubscriptionData,
+	getSubscriptionState,
+	calculateBillingPeriodFromSubscription,
 	GRACE_PERIOD_DAYS,
 } from "@repo/chat-billing";

-const billingLogger = {
-	info: (message: string, metadata?: Record<string, unknown>) =>
-		console.log(message, metadata ?? {}),
-	warn: (message: string, metadata?: Record<string, unknown>) =>
-		console.warn(message, metadata ?? {}),
-	error: (message: string, metadata?: Record<string, unknown>) =>
-		console.error(message, metadata ?? {}),
-};

 // ... getMessageLimitsForPlan stays unchanged ...

-// Shared period calculation function for consistent billing logic across the system
 export async function calculateBillingPeriod(
 	userId: string,
 	timezone = "UTC",
 ): Promise<string> {
 	const client = await clerkClient();
-	return calculateBillingPeriodForUser({
-		userId,
-		timezone,
-		fetcher: {
-			getUserBillingSubscription: (id: string) =>
-				client.billing.getUserBillingSubscription(id),
-		},
-		logger: billingLogger,
-	});
+	try {
+		const subscription = await client.billing.getUserBillingSubscription(userId);
+		return calculateBillingPeriodFromSubscription(subscription, { timezone });
+	} catch {
+		return calculateBillingPeriodFromSubscription(null, { timezone });
+	}
 }

-// Shared function to get user subscription data from Clerk
 export async function getUserSubscriptionData(userId: string) {
 	const client = await clerkClient();
-	return fetchSubscriptionData(userId, {
-		getUserBillingSubscription: (id: string) =>
-			client.billing.getUserBillingSubscription(id),
-	}, { logger: billingLogger });
+	try {
+		const subscription = await client.billing.getUserBillingSubscription(userId);
+		return { subscription, ...getSubscriptionState(subscription) };
+	} catch (error) {
+		console.error(`[Billing] Failed to fetch subscription for user ${userId}:`, error);
+		return { subscription: null, ...getSubscriptionState(null) };
+	}
 }
```

**What changed**:
- Calls `clerkClient()` directly — no `BillingSubscriptionFetcher` wrapper
- Error handling is explicit and local — no hidden fallback inside `fetchSubscriptionData`
- Deleted `billingLogger` — was just wrapping `console`
- `getUserSubscriptionData` returns `{ subscription, ...getSubscriptionState(subscription) }` — same shape consumers expect

#### 3. Verify `session.ts` — No Changes

`session.ts` imports `getUserSubscriptionData` from `./usage` and destructures `{ planKey, hasActiveSubscription }`. The return shape is unchanged, so no changes needed.

#### 4. Verify `chat-api-services/usage.ts` — No Changes

Imports `calculateBillingPeriod` from `@api/chat`. The function signature is unchanged (`(userId, timezone) => Promise<string>`), so no changes needed.

#### 5. Verify `checkLimits` and `reserveQuota` in `usage.ts`

Both destructure from `getUserSubscriptionData`:
- `checkLimits` (line 343): `{ subscription, planKey, hasActiveSubscription, billingInterval }` — all present in new return shape
- `reserveQuota` (line 509-513): `{ planKey: userPlan, hasActiveSubscription, subscription }` — all present

No changes needed to these consumers.

### Success Criteria

#### Automated Verification
- [x] `pnpm --filter @repo/chat-billing typecheck` passes
- [x] `pnpm --filter @api/chat typecheck` passes
- [x] `pnpm --filter @lightfast/chat typecheck` passes
- [x] `pnpm build:chat` succeeds

#### Manual Verification
- [ ] Billing page loads correctly (subscription state derived properly)
- [ ] Usage limits check works (checkLimits endpoint returns correct data)
- [ ] Temporary chat creation gated by plan check (session.create with isTemporary)

**Implementation Note**: After automated verification passes, pause for manual confirmation before considering the task complete.

---

## Testing Strategy

### Type Safety
- TypeScript compilation confirms all consumer access patterns are valid
- `getSubscriptionState` return type (`SubscriptionState`) is explicit — any missing field breaks consumers at compile time

### Runtime Safety
- `getSubscriptionState` mirrors the frontend `useBillingData` derivation exactly — same `activePaidItem` logic, same `getClerkPlanId` filter
- Error handling moved to `usage.ts` where it's visible and explicit, not hidden inside a utility function

### No New Tests Needed
- Pure refactor — same derived values, computed with fewer layers of indirection
- Existing behavior preserved: Clerk API errors still fall back to free-tier defaults

## References

- Previous cleanup: `thoughts/shared/plans/2026-02-18-billing-router-clerk-types-cleanup.md`
- Frontend hook (reference implementation): `apps/chat/src/hooks/use-billing-data.ts`
- Clerk type definitions: `@clerk/backend` `BillingSubscription`, `BillingSubscriptionItem`
