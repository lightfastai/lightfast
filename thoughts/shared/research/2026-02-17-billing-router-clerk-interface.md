---
date: 2026-02-17T14:19:17Z
researcher: jeevan
git_commit: 42806fceb62de0cf6d43d0299579ed6bc2cae74e
branch: fix/lint-api-chat
repository: lightfast-search-perf-improvements
topic: "Billing Router structure, Clerk getUserBillingSubscription interface, and custom type conversion analysis"
tags: [research, codebase, billing, clerk, api-chat, trpc, types]
status: complete
last_updated: 2026-02-17
last_updated_by: jeevan
---

# Research: Billing Router + Clerk Interface

**Date**: 2026-02-17T14:19:17Z
**Git Commit**: `42806fceb62de0cf6d43d0299579ed6bc2cae74e`
**Branch**: `fix/lint-api-chat`
**Repository**: lightfast-search-perf-improvements

## Research Question

> The billing router (`@api/chat/src/router/billing/billing.ts`) is structured weirdly. There is deep re-parsing via `JSON.parse(JSON.stringify(...))` and custom types that shadow Clerk's own types. Does `getUserBillingSubscription` have a real native interface that could replace all the custom types and conversions?

---

## Summary

The router performs `JSON.parse(JSON.stringify(...))` to strip Clerk's **class instances** (`BillingSubscription`, `BillingSubscriptionItem`) into plain objects before returning over tRPC. The custom types in `types.ts` were written to match the shape of those plain objects. However, the custom types are **not an accurate mirror** of Clerk's native types — there are field name mismatches (`value` vs `amount`) and missing fields (`amountFormatted`, `currencySymbol`). Clerk exposes full TypeScript class types that can be used directly via `@clerk/backend`. The `@repo/chat-billing` package also maintains its own parallel `SubscriptionData` interface (with Clerk class types), introducing three competing definitions of the same concept.

---

## Detailed Findings

### 1. Clerk's Native Types (`@clerk/backend@2.18.3`)

All billing types live in `@clerk/backend`. The billing API is marked `@experimental`.

#### `BillingAPI.getUserBillingSubscription`
- **File**: `node_modules/.pnpm/@clerk+backend@2.18.3_.../BillingApi.d.ts:44`
- **Signature**: `getUserBillingSubscription(userId: string): Promise<BillingSubscription>`
- Returns the class instance directly. No nullability — throws on not-found.

#### `BillingSubscription` class
- **File**: `node_modules/.pnpm/@clerk+backend@2.18.3_.../CommerceSubscription.d.ts:9`

```typescript
class BillingSubscription {
  readonly id: string;
  readonly status: 'active' | 'past_due' | 'canceled' | 'ended' | 'abandoned' | 'incomplete';
  readonly payerId: string;
  readonly createdAt: number;       // Unix ms
  readonly updatedAt: number;       // Unix ms
  readonly activeAt: number | null;
  readonly pastDueAt: number | null;
  readonly subscriptionItems: BillingSubscriptionItem[];
  readonly nextPayment: {
    date: number;               // Unix ms
    amount: BillingMoneyAmount; // { amount, amountFormatted, currency, currencySymbol }
  } | null;
  readonly eligibleForFreeTrial: boolean;
}
```

#### `BillingSubscriptionItem` class
- **File**: `node_modules/.pnpm/@clerk+backend@2.18.3_.../CommerceSubscriptionItem.d.ts:9`

```typescript
class BillingSubscriptionItem {
  readonly id: string;
  readonly status: 'abandoned' | 'active' | 'canceled' | 'ended' | 'expired' | 'incomplete' | 'past_due' | 'upcoming';
  readonly planPeriod: 'month' | 'annual';
  readonly periodStart: number;
  readonly periodEnd: number | null;
  readonly nextPayment: { amount: number; date: number } | null;
  readonly amount: BillingMoneyAmount | null | undefined;
  readonly plan: BillingPlan | null;
  readonly planId: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly canceledAt: number | null;
  readonly pastDueAt: number | null;
  readonly endedAt: number | null;
  readonly payerId: string;
  readonly isFreeTrial?: boolean;
  readonly lifetimePaid?: BillingMoneyAmount | null;
}
```

#### `BillingMoneyAmount` interface
- **File**: `node_modules/.pnpm/@clerk+types@4.95.0/.../index.d.ts:748`

```typescript
interface BillingMoneyAmount {
  amount: number;           // raw smallest-unit integer (e.g. cents)
  amountFormatted: string;  // e.g. "10.00"
  currency: string;         // e.g. "USD"
  currencySymbol: string;   // e.g. "$"
}
```

---

### 2. Custom Types in `api/chat/src/router/billing/types.ts`

- **File**: `api/chat/src/router/billing/types.ts`
- **Purpose**: Plain-object interfaces matching the JSON-serialized shape of Clerk's class instances.

#### `SubscriptionData` (lines 6–23) — mirrors `BillingSubscription` after `JSON.stringify`

```typescript
interface SubscriptionData {
  id: string;
  status: string;               // ← weakened; Clerk has a literal union
  payerId: string;
  createdAt: number;
  updatedAt: number;
  activeAt: number | null;
  pastDueAt: number | null;
  subscriptionItems: SubscriptionItemData[];
  nextPayment: {
    date: number;
    amount: {
      value: number;            // ← MISMATCH: Clerk uses `amount`, not `value`
      currency: string;         // ← PARTIAL: missing `amountFormatted`, `currencySymbol`
    };
  } | null;
  eligibleForFreeTrial: boolean;
}
```

#### `SubscriptionItemData` (lines 25–55) — mirrors `BillingSubscriptionItem`

```typescript
interface SubscriptionItemData {
  id: string;
  status: string;               // ← weakened; Clerk has a literal union
  planPeriod: 'month' | 'annual';
  periodStart: number;
  periodEnd: number | null;
  nextPayment: { amount: number; date: number } | null;
  amount?: { value: number; currency: string } | null; // ← MISMATCH: `value` not `amount`
  plan?: { id: string; name: string } | null;          // ← PARTIAL: missing slug, etc.
  planId: string | null;
  createdAt: number;
  updatedAt: number;
  canceledAt: number | null;
  pastDueAt: number | null;
  endedAt: number | null;
  payerId: string;
  isFreeTrial?: boolean;
  lifetimePaid?: { value: number; currency: string } | null; // ← MISMATCH
}
```

**Key mismatches vs Clerk native types:**
| Field | Custom type | Clerk native |
|---|---|---|
| `SubscriptionData.nextPayment.amount` | `{ value, currency }` | `BillingMoneyAmount` (`{ amount, amountFormatted, currency, currencySymbol }`) |
| `SubscriptionItemData.amount` | `{ value, currency }` | `BillingMoneyAmount` |
| `SubscriptionItemData.lifetimePaid` | `{ value, currency }` | `BillingMoneyAmount` |
| `status` fields | `string` | literal union |
| `plan` | `{ id, name }` | `BillingPlan` (full class: `id, productId, name, slug, description, fee, annualFee, features...`) |

---

### 3. `@repo/chat-billing` Package

- **Location**: `packages/chat-billing/`
- **Main files**: `src/types.ts`, `src/subscription.ts`, `src/pricing.ts`, `src/index.ts`

#### Third `SubscriptionData` definition — `packages/chat-billing/src/subscription.ts:14`

This package defines its **own** `SubscriptionData` (different from both the router's and Clerk's):

```typescript
// packages/chat-billing/src/subscription.ts:14
interface SubscriptionData {
  subscription: BillingSubscription | null;         // Clerk class type
  paidSubscriptionItems: BillingSubscriptionItem[]; // Clerk class type
  planKey: ClerkPlanKey;
  hasActiveSubscription: boolean;
  billingInterval: BillingInterval;
  error?: string;
}
```

This is the return type of `deriveSubscriptionData`.

#### `deriveSubscriptionData` function — `packages/chat-billing/src/subscription.ts:28`

```typescript
function deriveSubscriptionData({
  userId,
  subscription,
  options,
}: {
  userId: string;
  subscription: BillingSubscription | null;
  options?: { logger?: BillingLogger; freePlanIds?: string[] };
}): SubscriptionData
```

Internal logic:
1. Defaults `freePlanIds` to `["cplan_free", "free-tier"]`
2. Returns free-tier default when `subscription` is `null`
3. Filters `subscription.subscriptionItems` → `paidSubscriptionItems` (items whose `plan.id`/`plan.name` not in `freePlanIds`)
4. Derives `planKey`: `PLUS_TIER` if paid items exist, else `FREE_TIER`
5. Derives `billingInterval`: `"annual"` if `paidSubscriptionItems[0]?.planPeriod === "annual"`, else `"month"`
6. Derives `hasActiveSubscription`: `subscription.status === "active"` AND `paidSubscriptionItems.length > 0`

The return object holds **Clerk class instances**, not plain objects.

---

### 4. The Router's Serialization Chain

`api/chat/src/router/billing/billing.ts` — `getSubscription` procedure:

```
clerkClient().billing.getUserBillingSubscription(userId)
  → BillingSubscription (Clerk class instance)
    ↓
deriveSubscriptionData({ userId, subscription, options })
  → { subscription: BillingSubscription, paidSubscriptionItems: BillingSubscriptionItem[], ... }
    ↓ JSON.parse(JSON.stringify(subscription))
  → SubscriptionData (local plain object type)
    ↓ JSON.parse(JSON.stringify(item)) per paidSubscriptionItem
  → SubscriptionItemData[] (local plain object type)
    ↓
returned over tRPC
```

**Why the double-parse exists**: tRPC serializes return values to JSON. Clerk's `BillingSubscription` and `BillingSubscriptionItem` are class instances with prototype methods. `JSON.stringify` of a class instance drops methods and non-enumerable properties, producing a plain object. The cast to the local interface types provides TypeScript coverage over that shape.

---

### 5. `fetchSubscriptionData` in `@repo/chat-billing`

`packages/chat-billing/src/subscription.ts:99` — an alternative async wrapper already exists:

```typescript
async function fetchSubscriptionData(
  userId: string,
  fetcher: BillingSubscriptionFetcher,
  options?: DeriveSubscriptionOptions,
): Promise<SubscriptionData>
```

The router does **not** use this function; it calls `getUserBillingSubscription` and `deriveSubscriptionData` separately.

---

## Code References

| File | Line | Description |
|---|---|---|
| `api/chat/src/router/billing/billing.ts` | 1–215 | tRPC billing router |
| `api/chat/src/router/billing/types.ts` | 6–23 | `SubscriptionData` plain-object interface |
| `api/chat/src/router/billing/types.ts` | 25–55 | `SubscriptionItemData` plain-object interface |
| `packages/chat-billing/src/subscription.ts` | 14–21 | Package-internal `SubscriptionData` (holds Clerk types) |
| `packages/chat-billing/src/subscription.ts` | 28–93 | `deriveSubscriptionData` function |
| `packages/chat-billing/src/subscription.ts` | 99–124 | `fetchSubscriptionData` async wrapper |
| `packages/chat-billing/src/types.ts` | 1–140 | Enums, plan IDs, limits, error classes |
| `node_modules/.pnpm/@clerk+backend@2.18.3_.../BillingApi.d.ts` | 24–45 | `BillingAPI` class with `getUserBillingSubscription` |
| `node_modules/.pnpm/@clerk+backend@2.18.3_.../CommerceSubscription.d.ts` | 9–97 | `BillingSubscription` class definition |
| `node_modules/.pnpm/@clerk+backend@2.18.3_.../CommerceSubscriptionItem.d.ts` | 9–165 | `BillingSubscriptionItem` class definition |
| `node_modules/.pnpm/@clerk+types@4.95.0/.../index.d.ts` | 748–766 | `BillingMoneyAmount` interface |

---

## Architecture Documentation

### Three competing `SubscriptionData` definitions

| Location | Type | Contains |
|---|---|---|
| `api/chat/src/router/billing/types.ts` | Plain-object interface | Serialized shape for tRPC response |
| `packages/chat-billing/src/subscription.ts` | Interface | Clerk class instances + derived fields |
| `@clerk/backend` | Class | Native Clerk resource with `fromJSON` deserializer |

### Serialization boundary

The `JSON.parse(JSON.stringify(...))` pattern exists at the tRPC router boundary because Clerk returns class instances which cannot be passed directly through tRPC's JSON serialization without losing prototype references. The cast to local interface types is the TypeScript layer on top of this runtime stripping.

### Field name mismatches

The `value` field in the local `types.ts` does not exist in Clerk's native types. Clerk uses `amount` (a raw integer in smallest currency unit). The custom types are partially wrong relative to what `JSON.stringify` of a `BillingMoneyAmount` would actually produce — `JSON.stringify` of `{ amount: 1000, amountFormatted: "10.00", currency: "USD", currencySymbol: "$" }` produces `amount`, not `value`.

### `status` type weakening

Clerk's `BillingSubscription.status` is a narrow literal union. The custom `SubscriptionData.status` widens it to `string`, losing type safety at the tRPC output boundary.

---

## Open Questions

- What does `JSON.stringify` of a `BillingMoneyAmount` actually produce at runtime — does it produce `value` or `amount`? If `amount`, then the custom `types.ts` `value` fields are incorrect.
- Does the `@repo/chat-billing` `fetchSubscriptionData` function handle all the error cases that the router currently handles manually?
- Are there any consumers of `SubscriptionData` or `SubscriptionItemData` from `types.ts` elsewhere that depend on the `value` field name?
