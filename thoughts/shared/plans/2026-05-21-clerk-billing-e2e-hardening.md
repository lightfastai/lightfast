# Clerk Billing E2E Test & Hardening Plan

## Overview

The `feat/clerk-members-billing` branch shipped a complete Clerk-backed
organization billing settings page (`/[slug]/settings/billing`). This plan
exercises every billing surface end-to-end against the **live dev app** with a
**real Clerk test organization**, walking a real org through its whole billing
lifecycle (free → paid → canceled → downgraded). It is a test-debug-fix plan:
each phase exercises one surface, records findings in a running Debug Log, fixes
the functional and UX issues found, then re-verifies the same surface before the
phase boundary halt.

## Current State Analysis

### Clerk configuration (verified live, 2026-05-21)

`clerk config pull --keys billing` against the dev instance returns:

- `billing.organization_enabled: true` — org billing is on (the 2026-05-11
  `clerk-dashboard-inventory.md` snapshot saying it was disabled is **stale**).
- `billing.user_enabled: false` — B2C billing off; this is a B2B-only system.
- Plans: `free_org` (name "Starter", `amount: 0`, `payer_type: org`,
  `is_recurring: true`) and `team` (name "Team", `amount: 6000` = $60.00 USD,
  `payer_type: org`).
- `billing.features: {}` — **no entitlement features defined**, and both plans
  carry empty `features` arrays.
- `free_trial_requires_payment_method: true`, but `free_trial_enabled: false`
  on both plans — no trials are offered.
- **Prod billing is NOT enabled** (`organization_enabled: false`, `plans: {}`) —
  this plan is dev-only.

### Implementation surface

- **tRPC** — `api/app/src/router/(pending-not-allowed)/org-billing.ts`:
  - `orgBilling.overview` (`orgProcedure`) — `Promise.all` of
    `clerk.billing.getPlanList({ payerType: "org" })`,
    `clerk.billing.getOrganizationBillingSubscription(orgId)`, then returns
    Clerk-shaped plain objects for RSC hydration.
  - `orgBilling.cancelSubscriptionItem` (`orgAdminProcedure`) — inherits the
    admin check from the procedure, confirms the item belongs to the org's
    subscription, refuses non-`team` items, then
    `cancelSubscriptionItem(id, { endNow: false })`.
- **Page** — `.../settings/billing/page.tsx`: `force-dynamic`, RSC
  `fetchQuery(orgBilling.overview)` then `<HydrateClient><BillingSettingsClient/>`.
  `loading.tsx` exists; the billing segment now also has its own `error.tsx`.
- **Client** — `billing-settings-client.tsx` drives four sections
  (`PlanSection`, `PaymentSection`, `InvoicesSection`, `CancellationSection`)
  plus dialogs: `PlanSelectionDialog`, `Confirm{Downgrade,Upgrade,Business}Dialog`,
  `BillingCheckoutDialog` (→ `CheckoutProvider` → `SavedPaymentCheckout` /
  `NewPaymentCheckout`), `PaymentMethodDialog` (→ `NewPaymentMethodForm`),
  `StatementDetailsDialog`. Client-side billing data (`usePaymentMethods`,
  `useStatements`) comes from `@vendor/clerk/client/experimental`.
- **Vendor** — `vendor/clerk/src/client/experimental.ts` re-exports Clerk's
  experimental billing hooks/components; `vendor/clerk/src/server.ts` adds
  `BillingPlan`, `BillingSubscription`, `BillingSubscriptionItem`,
  `BillingMoneyAmount` types.
- **Tests** — `org-billing-router.test.ts` (router unit tests, all mocked) and
  `settings-billing-{page,client,loading}.test.tsx` (app-layer, ~680 lines)
  already exist. They mock Clerk entirely; **no test exercises real Clerk
  billing**.

### Issues already identified from code review (to confirm/fix during execution)

1. **No `error.tsx`** — `page.tsx` calls `clerk.billing.*` in an RSC
   `fetchQuery`. Any Clerk API failure (network, rate limit, an org with no
   subscription) throws past `loading.tsx` and crashes the route. Only the
   billing segment should fail soft; the settings shell must survive.
2. **Seat copy mismatch** — `PlanSelectionDialog` hardcodes `"3 seats included"`
   on both the Starter and Team cards. The dev Clerk org cap is
   `max_allowed_memberships: 5`; the billing plans carry no seat entitlement at
   all. The claim is both wrong and not plan-specific.
3. **Dead `onComplete()`** — `new-payment-checkout.tsx` and
   `saved-payment-checkout.tsx` call `onComplete()` immediately after
   `checkout.finalize({ navigate })` sets `window.location.href`. The full-page
   navigation makes `onComplete()` (dialog close + query invalidation) dead
   code, and the hard reload is a heavier UX than the rest of the app.
4. **No billing webhook consumer** — no `subscription.*` / `subscriptionItem.*`
   / `paymentAttempt.*` handler exists. Display is unaffected (reads are live
   from Clerk), but nothing reacts to lifecycle events. Out of scope per the
   plan decision; documented in Phase 5.

### Key Discoveries

- Billing lives under the `(pending-not-allowed)` route group. The overview
  read uses `orgProcedure` and is reachable by any **active-org member**;
  cancellation uses `orgAdminProcedure`. No `(bound)` gate applies on this
  branch. `[slug]/layout.tsx` is the route access gate (org membership).
- `tierForPlan` lives in `@repo/app-billing` and maps `slug === "team"` →
  `team`, and `slug === "starter" | "free_org"` or `isDefault` → `starter`.
  The live dev slugs are `team` and `free_org` — both handled.
- `cancelSubscriptionItem` only ever schedules cancellation (`endNow: false`).
  An org stays on Team until period end; there is no in-product immediate
  downgrade. Resetting a test org to Starter mid-plan therefore requires a
  direct Clerk API call (`endNow: true`).
- Clerk's dev billing uses the shared development gateway — no Stripe account
  needed. Standard Stripe test cards apply: `4242 4242 4242 4242` (success),
  `4000 0000 0000 0002` (generic decline). Any future expiry, any CVC, any ZIP.

## Desired End State

Every billing surface has been exercised end-to-end against a real Clerk
subscription lifecycle on the dev instance; every functional and UX/copy bug
found is fixed and re-verified; the automated suite, typecheck, lint, and
`build:app` all pass; all Clerk test data is deleted; the Debug Log records each
finding and its resolution; the billing-webhook gap is documented as future
work.

**Verification:** the Phase 7 success criteria all pass, and the Debug Log shows
every Phase 1–6 finding marked `fixed` or `accepted (no change)` with a reason.

## What We're NOT Doing

- **No Clerk billing webhook handler.** Out of scope per decision; reads are
  live so display correctness does not depend on it. Phase 5 documents the gap
  and recommends a follow-up plan.
- **No production billing.** Prod Clerk billing is not enabled; this plan does
  not enable it or test against prod.
- **No B2C / user billing.** `user_enabled` is false; only org billing.
- **No new plans, features, or pricing changes** in the Clerk dashboard. The
  `free_org` + `team` catalog is taken as given.
- **No entitlement gating work** (`has({ feature })` / `has({ plan })` product
  gates). No features are defined and no surface gates on them today.
- **No redesign** of the billing UI — only bug fixes and copy corrections to
  the shipped implementation.

## Implementation Approach

The plan reuses a **single Clerk test org** across Phases 1–6 and advances its
billing state deliberately (free → +payment methods → Team → canceled →
downgraded), mirroring a real org's lifecycle. Three skills drive execution:

- **`lightfast-clerk`** — provision the test user(s) + org, sign in via browser.
- **`agent-browser`** — drive the live dev app, screenshot, assert DOM/state.
- **`clerk-cli` / `clerk-backend-api`** — read Clerk-side billing truth
  (subscription, plan, payment methods, statements) to confirm the UI, and
  perform mid-plan resets (`endNow: true`) the product UI cannot.

Each phase follows the same loop: **exercise → record findings → fix →
re-verify**. Fixes land as commits during the phase. Functional and UX/copy
issues are both in scope. Findings are appended to the Debug Log at the bottom
of this file.

The dev app base URL is worktree-dependent — resolve it once with
`node scripts/with-desktop-env.mjs --print` (the app host is the `app.` sibling,
e.g. `https://app.lightfast.localhost`).

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not
sufficient — the next phase starts only on user go-ahead. Every code change in a
phase must keep `pnpm typecheck`, `pnpm check` (no new errors), and the billing
test suites green before the phase boundary.

---

## Phase 0: Harness & baseline smoke

### Overview

Stand up the test environment, confirm the billing page loads at all, and
establish the Debug Log convention.

### Steps

1. **Start the dev app** in the background:
   ```bash
   pnpm dev:app > /tmp/console-dev.log 2>&1 &
   ```
   Resolve the app URL with `node scripts/with-desktop-env.mjs --print`. Tail
   `/tmp/console-dev.log` until the app is ready.

2. **Provision the test org** via the `lightfast-clerk` skill:
   - One admin user (org creator → `org:admin` per `creator_role`).
   - One organization (fresh → auto-subscribed to the `free_org` default plan).
   - Record the Clerk user id, org id, and org slug in the Debug Log.
   - Note: `block_email_subaddresses: true` on the dev instance — the skill's
     Backend-API provisioning path handles this; do not use `+alias` emails.

3. **Sign in** to the live dev app as the admin user via `agent-browser` (the
   `lightfast-clerk` skill covers browser sign-in). Navigate to
   `/<org-slug>/settings/billing`.

4. **Baseline smoke** — confirm the page renders *something* (the four billing
   sections or an error). Screenshot it. Capture any console errors from
   `/tmp/console-dev.log` and the browser console.

5. **Initialize the Debug Log** section at the bottom of this file with the
   test-org identifiers and a Phase 0 entry.

### Success Criteria

#### Automated Verification

- [x] Dev app responds: `curl -sk <app-url>/api/health` (or the app root)
      returns 200. — `https://app.lightfast.localhost/api/health` → 200.
- [x] `clerk` CLI reads the test org and confirms it has a `free_org`
      subscription. — `GET /organizations/org_3E0pFH9zzdDhqCVRMl8WdC26Fsc/billing/subscription`
      → active subscription, item plan slug `free_org`.
- [x] `agent-browser` reaches `/<org-slug>/settings/billing` without a redirect
      to sign-in or a 404. — landed on `/billing-e2e-test/settings/billing`,
      all four sections rendered.

#### Human Review

- [ ] Open the Phase 0 screenshot → the billing page (or its error state) is
      visibly rendered inside the settings shell with the sidebar.
      — screenshot `/tmp/billing-e2e/phase0-billing-baseline.png` captured;
      awaiting user confirmation.

---

## Phase 1: Read path (free-plan org) + error boundary

### Overview

Verify `orgBilling.overview` and all four read-only sections on a fresh
`free_org` org, for both an admin and a non-admin member. Add the missing
`error.tsx` so a Clerk API failure degrades gracefully.

### Changes Required

#### 1. Add a billing error boundary

**File**: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/error.tsx` *(new)*
**Changes**: Client error boundary scoped to the billing segment so the settings
shell + sidebar survive a Clerk billing API failure. Wire it to the repo's
observability capture (grep `apps/app/src` for an existing Sentry/observability
client-error pattern; if none, `console.error` + a comment).

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useEffect } from "react";

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO: route through the repo observability client if one exists.
    console.error("Billing settings failed to load", error);
  }, [error]);

  return (
    <div className="space-y-4 rounded-lg border border-border/60 px-4 py-6">
      <div>
        <h2 className="font-medium text-foreground text-lg">
          Billing is temporarily unavailable
        </h2>
        <p className="mt-1 text-muted-foreground text-sm">
          We couldn't load billing details for this organization. This is
          usually a temporary issue with the billing provider.
        </p>
      </div>
      <Button onClick={reset} size="sm" variant="secondary">
        Try again
      </Button>
    </div>
  );
}
```

#### 2. Confirm the no-subscription path

Establish what `clerk.billing.getOrganizationBillingSubscription` returns for an
org with no subscription (older orgs predating billing). If it throws, the
`error.tsx` above is the safety net; if a graceful "no subscription" UI state is
warranted, record it as a finding and decide the fix in-phase.

### Manual / browser test steps

1. **Admin read path** — as the admin, load `/<org-slug>/settings/billing`:
   - `PlanSection` shows "Starter", a status badge, "Free", and the free-plan
     renewal copy. "Adjust plan" button visible.
   - `PaymentSection` shows "No payment method". "Update" button visible.
   - `InvoicesSection` shows "No invoices yet."
   - `CancellationSection` shows "No paid plan is active for this organization."
2. **Non-admin read path** — add a second user as `org:member`, sign in as them,
   load the page:
   - All four sections render read-only; "Adjust plan", "Update", and
     "Cancel plan" buttons are **absent**.
   - The "Billing is managed by organization admins." notice is shown.
3. **Error boundary** — temporarily force `orgBilling.overview` to throw (e.g.
   point `CLERK_SECRET_KEY` at an invalid value in a throwaway shell, or stub
   the Clerk call) and confirm `error.tsx` renders inside the settings shell
   instead of a full crash. Revert.
4. Cross-check the rendered `overview` values against `clerk` CLI billing data.

### Success Criteria

#### Automated Verification

- [x] `pnpm test --filter @api/app` passes (`org-billing-router.test.ts`).
      — 89 tests passed (11 files).
- [x] `pnpm test --filter @lightfast/app` passes (billing app-layer tests).
      — 227 tests passed (37 files).
- [x] `pnpm typecheck` passes; `pnpm check` adds no new errors. — 36 packages
      typecheck clean; `check` 836 files, no fixes applied.
- [x] `agent-browser` DOM assertions: admin view exposes "Adjust plan" /
      "Update"; non-admin view does not and shows the admin-managed notice.
      — admin snapshot has `button "Adjust plan"` + `button "Update"`; member
      snapshot has neither (nor "Cancel plan") and shows "Billing is managed
      by organization admins."
- [x] Forced-error run renders the `error.tsx` heading "Billing is temporarily
      unavailable" with the sidebar still present. — temporary `throw` in
      `page.tsx` produced `heading "Billing is temporarily unavailable"` +
      "Try again" button with the Settings sidebar (General/Members/Billing/
      API Keys) intact; `throw` reverted, page recovers.

#### Human Review

- [ ] Admin and non-admin screenshots → sections read correctly; the free-plan
      copy is accurate; no layout breakage.
      — `/tmp/billing-e2e/phase1-admin-read.png`,
      `/tmp/billing-e2e/phase1-nonadmin-read.png`; awaiting user confirmation.
- [ ] Error-state screenshot → degraded billing panel sits cleanly inside the
      settings shell.
      — `/tmp/billing-e2e/phase1-error-boundary.png`; awaiting user
      confirmation.

---

## Phase 2: Payment methods management

### Overview

Exercise `PaymentMethodDialog` and `NewPaymentMethodForm` on the free org: add a
card (Clerk `PaymentElement` iframe), add a second, make it default, remove one.

### Manual / browser test steps

As the admin on `/<org-slug>/settings/billing`:

1. **Add first card** — "Update" → `PaymentMethodDialog` → "Add new card" →
   `NewPaymentMethodForm`. Fill the Clerk `PaymentElement` iframe with
   `4242 4242 4242 4242`, a future expiry, any CVC, any ZIP → "Save card".
   Confirm the dialog returns to the saved list and the card appears.
2. **Add second card** — repeat with a second test card (e.g.
   `5555 5555 5555 4444`, Mastercard test).
3. **Make default** — on the non-default card, click "Make default"; confirm
   the `Default` badge moves and `PaymentSection` reflects the new default.
4. **Remove** — remove a non-default, removable card; confirm it disappears.
5. **Error path** — attempt a card that fails validation; confirm
   `paymentErrorMessage` surfaces a readable error in the dialog `Alert`.
6. Cross-check the org's payment methods via `clerk` CLI / Backend API after
   each mutation.

### Changes Required

Fixes are determined by findings. Likely candidates to confirm:

- `method.makeDefault({ orgId })` / `method.remove({ orgId })` receive a defined
  `orgId` — `billing-settings-client.tsx` passes `auth.orgId ?? undefined`
  from Clerk's `useAuth()`; verify it is populated.
- `revalidate()` after add/default/remove actually refreshes `usePaymentMethods`
  (the `onUpdated` → `paymentMethodsQuery.revalidate()` path).

### Success Criteria

#### Automated Verification

- [x] `clerk` CLI confirms 2 payment methods on the org after step 2, the
      correct default after step 3, and 1 after step 4. — cross-checked via the
      in-page Clerk client `organization.getPaymentMethods()` (the Backend API
      exposes no org payment-method list endpoint — `clerk api ls billing`
      confirms): step 2 → 2 (visa 4242 + mastercard 4444); step 3 → default =
      mastercard 4444; step 4 → 1 (mastercard 4444).
- [x] `pnpm test --filter @lightfast/app` and `--filter @api/app` pass. — 227
      passed / 37 files (incl. `proxy.test.ts`, 11) and 89 passed / 11 files.
- [x] `pnpm typecheck` passes; `pnpm check` adds no new errors. — 36/36
      typecheck clean; `check` 837 files, the only 2 errors predate this branch
      (`apps/www/.../mdx-components.tsx`, `packages/ui/.../thinking-message.tsx`)
      and touch no file changed in this phase.
- [x] `agent-browser` asserts the `Default` badge position after step 3. —
      after "Make default" on the Mastercard, the `Default` label moved from the
      Visa row to the Mastercard row and "Current payment method" switched to
      "Mastercard •••• 4444".

#### Human Review

- [x] Screenshots of the payment-method dialog across add / make-default /
      remove → state transitions are correct and the dialog copy is accurate.
      — `/tmp/billing-e2e/phase2-card1-saved.png`, `phase2-card2-saved.png`,
      `phase2-makedefault.png`, `phase2-removed.png`; confirmed by user.
- [x] Error-path screenshot → the failure message is human-readable.
      — `/tmp/billing-e2e/phase2-error-path.png`; confirmed by user.

---

## Phase 3: Upgrade checkout E2E (paid)

### Overview

Drive the full Starter → Team upgrade through Clerk checkout, both the
saved-card and new-card paths, plus a decline-card error state. This is the core
paid E2E.

### Manual / browser test steps

1. **Open checkout** — "Adjust plan" → `PlanSelectionDialog` → "Switch to Team"
   → `ConfirmUpgradeDialog` → "Confirm" → `BillingCheckoutDialog`.
2. **Initialize** — `CheckoutFlow` shows `needs_initialization`; click "Start
   checkout"; confirm `CheckoutSummary` renders the Team plan and "Due now"
   total.
3. **Saved-card path** — keep "Use saved card", pick a card from Phase 2,
   "Complete Purchase" → `checkout.confirm` → `checkout.finalize`. Confirm the
   org is on Team afterward (`PlanSection` shows "Team", renewal copy, next
   payment date).
4. **Reset to Starter** — via Clerk API, cancel the Team subscription item with
   `endNow: true` (the product UI only schedules; a hard reset is needed to
   re-test). Confirm the org is back on `free_org`.
5. **New-card path** — repeat the upgrade, this time "Use new card" →
   `PaymentElementProvider` → `NewPaymentCheckout`: fill the `PaymentElement`
   with a fresh `4242…` card → "Pay with new card". Confirm Team again.
6. **Decline-card error state** — reset to Starter again; start checkout, new
   card, use `4000 0000 0000 0002` (generic decline); confirm `NewPaymentCheckout`
   surfaces the decline through `CheckoutErrors` without finalizing.
7. After each successful upgrade, cross-check the subscription via `clerk` CLI.

### Changes Required

Fixes from findings. Pre-identified candidate (issue #3):

- **Dead `onComplete()` after `window.location.href`** in
  `new-payment-checkout.tsx` and `saved-payment-checkout.tsx`. Decide in-phase
  between (a) removing the dead `onComplete()` call and keeping the hard reload,
  or (b) replacing the `window.location.href` navigation in
  `checkout.finalize({ navigate })` with a Next router soft navigation
  (`router.replace(decorateUrl(pathname))`) so `onComplete()` (dialog close +
  `overview` invalidation) becomes meaningful and the white-flash reload is
  removed. Verify the chosen approach with a real finalize — Clerk's checkout
  state must settle correctly. Prefer (b) if the soft nav settles cleanly.
- Confirm `BillingCheckoutDialog`'s `onComplete` (`setCheckoutPlan(null)` +
  `invalidateQueries`) reflects the post-checkout Team state in the UI.

### Success Criteria

#### Automated Verification

- [x] `clerk` CLI confirms the org subscription is `team` after steps 3 and 5,
      and back to `free_org` after each reset (step 4). — `team` after the
      saved-card checkout and after the new-card checkout; `free_org` after each
      `?end_now=true` reset (3 resets).
- [x] The decline run leaves the org on `free_org` (no subscription created).
      — `4000 0000 0000 0002` → checkout did not finalize; subscription stayed
      `free_org`.
- [x] `pnpm test --filter @lightfast/app` and `--filter @api/app` pass. — 231
      passed / 37 files and 89 passed / 11 files
      (`settings-billing-client.test.tsx` gained a `next/navigation` mock for
      the new `useRouter` calls).
- [x] `pnpm typecheck` passes; `pnpm check` adds no new errors. — 36/36
      typecheck clean; `check` 838 files — the 4 errors are all in files not
      touched by this phase (`apps/www/.../mdx-components.tsx`,
      `packages/ui/.../thinking-message.tsx`, `apps/app/src/components/user-menu.tsx`
      ×2 — the latter pre-existing worktree WIP).
- [x] `agent-browser` asserts `PlanSection` shows "Team" after a successful
      checkout and the decline `Alert` after step 6. — PlanSection "Team /
      Active" after both saved-card and new-card checkouts; "Your card has been
      declined." `Alert` rendered after the decline run.

#### Human Review

- [x] Checkout-drawer screenshots (init → summary → saved card → new card) →
      layout and totals render correctly.
      — `/tmp/billing-e2e/phase3-checkout-init.png`, `phase3-checkout-summary.png`,
      `phase3-team-saved-card.png`, `phase3-newcard-fixed.png`; confirmed by user.
- [x] Post-upgrade screenshot → `PlanSection` reflects Team with a sensible
      next-payment date and renewal copy.
      — `/tmp/billing-e2e/phase3-newcard-team.png`; confirmed by user.
- [x] Decline-state screenshot → the error is clear and the dialog stays open.
      — `/tmp/billing-e2e/phase3-decline-error.png`; confirmed by user.

---

## Phase 4: Invoices & cancellation / downgrade

### Overview

Verify invoices produced by the Phase 3 checkout, then walk the cancellation and
downgrade flows. Leave the org on Team (with a real subscription) entering this
phase.

### Manual / browser test steps

1. **Invoices** — with the org on Team, confirm `InvoicesSection` lists the
   statement(s) from the Phase 3 checkout (date, total, "Paid"/status). Open
   `StatementDetailsDialog` via "View"; confirm totals and line items, and the
   "No line-item detail" fallback path if a statement has no groups.
2. **Cancel (schedule)** — `CancellationSection` → "Cancel plan" →
   `ConfirmDowngradeDialog` → "Confirm" → `cancelSubscriptionItem`. Verify:
   - The optimistic update sets `canceledAt` immediately.
   - On success, copy switches to "Team plan is scheduled to end on <date>."
   - `clerk` CLI shows the item `canceledAt` set, `endNow: false` (period-end).
3. **Downgrade via plan dialog** — re-open `PlanSelectionDialog`; confirm the
   Starter card is disabled / labelled "Scheduled" (`isStarterSelectionDisabled`
   when a canceled Team item exists), and Team shows "Your current plan".
4. **Non-admin** — as the `org:member`, confirm no cancel control is available
   and `cancelSubscriptionItem` called directly is rejected `FORBIDDEN`.
5. **Post-downgrade state** — via Clerk API, force the cancellation to complete
   (`endNow: true`); reload and confirm the org reads as Starter again
   (`PlanSection`, `CancellationSection` "No paid plan is active").
6. **Cancel-mutation error path** — force `cancelSubscriptionItem` to fail and
   confirm the optimistic update rolls back (`onError` restores
   `previousOverview`).

### Changes Required

Fixes from findings. Watch specifically:

- `getCurrentSubscriptionItem` selecting the right item when both a canceled
  Team item and the `free_org` item coexist.
- Renewal vs. canceled copy in `PlanSection` / `CancellationSection` matching
  the actual subscription state and dates (`formatDate` UTC rendering).

### Success Criteria

#### Automated Verification

- [x] `clerk` CLI confirms the Team item `canceledAt` is set with period-end
      semantics after step 2, and the org is `free_org` after step 5. — after
      the in-product cancel, the Team item (`csub_item_3E0z7QP7BD1YTBuJE9QTiJh7nHZ`)
      had `canceled_at` set, `ended_at: null`, `period_end` unchanged
      (`2026-06-21`) and a new `upcoming` `free_org` item queued at that date —
      period-end (`endNow: false`) semantics. After step 5's
      `DELETE …?end_now=true`, the Team item `ended_at` was set and the org's
      only item is `free_org` / `active`.
- [x] `org-billing-router.test.ts` cancellation cases still pass. — included in
      the `@api/app` run (11 files / 89 tests passed).
- [x] `pnpm test --filter @lightfast/app` and `--filter @api/app` pass. — 231
      passed / 37 files and 89 passed / 11 files.
- [x] `pnpm typecheck` passes; `pnpm check` adds no new errors. — 36/36
      typecheck clean; `check` 838 files, 5 errors — all in files **not touched
      by this phase** (Phase 4 made zero code changes): `user-menu.tsx`,
      `thinking-message.tsx`, `mdx-components.tsx`, `org-api-key-list.tsx`,
      `members/page.tsx` — concurrent worktree WIP, no billing file among them.
- [x] `agent-browser` asserts the scheduled-end copy after step 2 and the
      rolled-back state after step 6. — after the cancel, `PlanSection` and
      `CancellationSection` both read "…scheduled to end on Jun 21, 2026."; in
      the forced-error run the optimistic `canceledAt` rolled back to the
      un-canceled "Cancel plan" state with a "Failed to schedule cancellation"
      toast.

#### Human Review

- [ ] Invoice list + `StatementDetailsDialog` screenshots → amounts, dates, and
      statuses are correct and readable.
      — `/tmp/billing-e2e/phase4-invoices-list.png`,
      `/tmp/billing-e2e/phase4-statement-details.png`; awaiting user
      confirmation.
- [ ] Cancellation-flow screenshots → scheduled-end copy and dates read
      correctly; the plan dialog reflects the scheduled downgrade.
      — `/tmp/billing-e2e/phase4-confirm-downgrade-dialog.png`,
      `/tmp/billing-e2e/phase4-cancel-scheduled.png`,
      `/tmp/billing-e2e/phase4-plan-dialog-scheduled.png`,
      `/tmp/billing-e2e/phase4-cancel-error-rollback.png`,
      `/tmp/billing-e2e/phase4-nonadmin-canceled.png`,
      `/tmp/billing-e2e/phase4-post-downgrade-starter.png`; awaiting user
      confirmation.

---

## Phase 5: Hardening & copy pass

### Overview

Sweep the non-functional issues surfaced across Phases 1–4 plus the
pre-identified copy/UX defects, and document the webhook gap.

### Changes Required

#### 1. Seat-count copy (issue #2)

**File**: `.../settings/billing/_components/plan-selection-dialog.tsx`
**Changes**: The hardcoded `"3 seats included"` on both plan cards is wrong (dev
org cap is `max_allowed_memberships: 5`) and not plan-specific. Either remove the
seat line from both cards (plans carry no seat entitlement) or replace it with
copy sourced from a single shared constant matching the real Clerk org
membership cap. Do not leave the mismatched `"3 seats included"` string.

#### 2. Other findings

Apply remaining UX/copy fixes recorded in the Debug Log from Phases 1–4
(loading/empty-state wording, dialog copy, the `onComplete` decision if deferred
from Phase 3, etc.).

#### 3. Non-admin defense-in-depth audit

Confirm every privileged action is enforced server-side, not just hidden in the
UI: `cancelSubscriptionItem` (re-checks admin — verified by tests), and the
Clerk-SDK-direct mutations (`organization.addPaymentMethod`, `makeDefault`,
`remove`, `CheckoutProvider` checkout) which Clerk enforces by org role. Record
the audit result in the Debug Log; fix any gap found.

#### 4. Document the webhook gap

Add a short "Billing webhooks — future work" note (in this plan's Debug Log and,
if a billing README/section exists, there). State: no `subscription.*` /
`subscriptionItem.*` / `paymentAttempt.*` consumer exists; display is unaffected
because reads are live from Clerk; lifecycle side-effects (in-app dunning on
`pastDue`, audit trail, reacting to period-end downgrade) are unbuilt; recommend
a dedicated follow-up plan referencing the `clerk-webhooks` skill's billing
event catalog.

### Success Criteria

#### Automated Verification

- [x] `grep -r "3 seats" apps/app/src` returns nothing (copy fixed). —
      `grep -rn "3 seats" apps/app/src` exits 1 with no output; the only two
      `plan-selection-dialog.tsx` matches are gone.
- [x] `pnpm test --filter @lightfast/app` and `--filter @api/app` pass
      (update billing component tests if they assert the old seat copy). — 231
      passed / 37 files and 89 passed / 11 files. No test asserted the old seat
      copy, so no test change was needed.
- [x] `pnpm typecheck` passes; `pnpm check` adds no new errors. — 36/36
      typecheck clean; `check` 838 files, 5 errors — all in files **not touched
      by this phase** (`user-menu.tsx`, `thinking-message.tsx`,
      `mdx-components.tsx`, `org-api-key-list.tsx`, `members/page.tsx` —
      concurrent worktree WIP; the only file Phase 5 edited,
      `plan-selection-dialog.tsx`, is clean).

#### Human Review

- [ ] `PlanSelectionDialog` screenshot → plan-card copy is accurate and
      consistent with the real Clerk plan/seat model.
      — `/tmp/billing-e2e/phase5-plan-dialog-copy.png` captured (Starter:
      "Free organization workspace" / "Basic access"; Team: "Priority product
      limits" / "Email support" / "Team workspace billing"; no "3 seats"
      anywhere); awaiting user confirmation.
- [ ] Debug Log contains the webhook-gap note and the non-admin audit result.
      — both written into the Phase 5 Debug Log entry above; awaiting user
      confirmation.

---

## Phase 6: Clerk-native serialization retest

### Overview

Re-run the billing page after the `@repo/app-billing` cleanup and the
Clerk-native router change. The specific regression under test is the Next.js
Server Component → Client Component serialization boundary: Clerk backend
billing resources are class-backed SDK objects, so `orgBilling.overview` must
return Clerk-shaped **plain objects** before the RSC-prefetched tRPC cache is
passed into `<HydrateClient>`.

### Context

This phase exists because the app-billing cleanup intentionally removed custom
DTOs and schema-backed remappers, then returned Clerk billing SDK objects
directly. That preserved Clerk resource prototypes through the server-prefetched
query and produced:

```text
Only plain objects, and a few built-ins, can be passed to Client Components
from Server Components. Classes or null prototypes are not supported.
```

The fix keeps the public shape Clerk-native, but strips SDK prototypes
generically in `api/app/src/router/(pending-not-allowed)/org-billing.ts` before
returning `plans`, `subscription`, and canceled subscription items.

### Manual / browser test steps

1. **Reuse the Phase 0 test org if it still exists.** If the org/users were
   already deleted, recreate the Phase 0 harness first, then start this phase
   from a fresh `free_org` org.
2. **Start or reuse the dev app.** Prefer the existing `pnpm dev:app` process if
   one is already registered with Portless; otherwise start it and resolve the
   app URL with `node scripts/with-desktop-env.mjs --print`.
3. **Admin page load regression.** Sign in as the org admin and load
   `/<org-slug>/settings/billing`. Confirm the page renders inside the settings
   shell and the browser/server logs contain no "Only plain objects" /
   `stringify` serialization error.
4. **Read-state cross-check.** Cross-check the rendered plan, status,
   next-payment/cancellation copy, payment method, and invoice state against
   Clerk billing truth for the org. Preserve whatever lifecycle state the org is
   currently in; do not reset just to make the page "Starter" unless needed for
   a later step.
5. **Client interaction smoke.** Open and close the plan selection dialog,
   payment method dialog, and statement details dialog (when statements exist).
   If the org is on active Team, open the cancellation confirmation and cancel
   the dialog without confirming. The goal is to verify the hydrated Clerk-shaped
   data still works across helper functions and component state.
6. **Non-admin page load regression.** Sign in as the `org:member`, load the
   same billing URL, and confirm the read-only state still renders without the
   serialization error. Verify "Adjust plan", "Update", and "Cancel plan" remain
   absent.
7. **Router regression evidence.** Run the focused router test that constructs
   class-backed Clerk fixture objects and asserts the tRPC return is plain at
   every hydrated billing level.

### Success Criteria

#### Automated Verification

- [x] `pnpm --filter @api/app test src/__tests__/org-billing-router.test.ts`
      passes, including the class-backed Clerk resource regression test. — 10
      tests passed (1 file); the `strips Clerk resource prototypes before SSR
      hydration` case and the `Object.getPrototypeOf(...) === Object.prototype`
      assertions in `schedules team cancellation` are green.
- [x] `pnpm --filter @repo/app-billing test` passes. — 5 tests passed (1 file).
- [x] `pnpm --filter @vendor/lib test` passes. — 2 tests passed (1 file,
      `src/time.test.ts`).
- [x] `pnpm --filter @lightfast/app test 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-billing-client.test.tsx' 'src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-billing-page.test.tsx'`
      passes. — 14 tests passed (2 files).
- [x] `pnpm typecheck` passes. — 37/37 turbo tasks successful (FULL TURBO, all
      cache hits, no errors).
- [x] `pnpm build:app` succeeds. — 1/1 task, 21.983s; `/[slug]/settings/billing`
      builds as a dynamic (`ƒ`) route.
- [x] Live browser/server logs for `/<org-slug>/settings/billing` contain no
      "Only plain objects", "Classes or null prototypes", or billing
      hydration/stringify error. — admin + non-admin live loads:
      `org.settings.orgBilling.overview` → `ok: true` in the browser console,
      `GET /billing-e2e-test/settings/billing 200` in the server log, and a
      grep of both the browser console and the `/tmp/console-dev.log` slice for
      `only plain object` / `null prototype` / `classes or null` /
      `cannot be passed to client` / `stringify` returned **nothing**.

#### Human Review

- [x] Admin screenshot after the serialization fix → billing page renders in
      the settings shell with the correct current Clerk billing state.
      — `/tmp/billing-e2e/phase6-admin-read.png` (Starter / Active / $0.00/month
      / Visa •••• 4242 / $180.00 invoice; "Adjust plan" + "Update" present) and
      `/tmp/billing-e2e/phase6-statement-dialog.png` (the `StatementDetailsDialog`
      — Invoice details, $180.00 / Open, 3× "Team — $60.00").
- [x] Non-admin screenshot after the serialization fix → read-only billing page
      renders with no privileged controls.
      — `/tmp/billing-e2e/phase6-nonadmin-read.png` (same four sections, **no**
      "Adjust plan" / "Update" / "Cancel plan", admin-managed notice shown).
- [x] Debug Log contains the serialization finding, the code/test resolution,
      and whether any stale Phase 5 security-audit wording was updated to match
      the current `orgProcedure` / `orgAdminProcedure` implementation. — see the
      Phase 6 Debug Log entry: P6-1 (serialization finding + `stripClerkResourcePrototypes`
      + regression test) and P6-2 (Phase 5 audit wording confirmed **not** stale,
      no update needed).

---

## Phase 7: Regression & teardown

### Overview

Full automated regression, then delete every piece of Clerk test data created.

### Steps

1. Run the full automated suite (see below).
2. **Teardown** via `clerk` CLI / `lightfast-clerk` skill:
   - Cancel any remaining subscription on the test org.
   - Delete the test org (cascades subscription + payment methods).
   - Delete the test user(s).
   - Remove the `agent-browser` profile/session.
   - Verify deletion: `clerk` CLI `GET` on the org id returns 404.
3. Write the final Debug Log summary: every Phase 1–6 finding marked `fixed` or
   `accepted (no change)` with a reason; list the commits made.

### Success Criteria

#### Automated Verification

- [x] `pnpm test --filter @api/app` passes. — 104 tests passed (11 files).
- [x] `pnpm test --filter @lightfast/app` passes. — 249 tests passed (37 files).
- [x] `pnpm typecheck` passes (all turbo tasks). — 37/37 turbo tasks successful.
- [x] `pnpm check` reports no new errors versus the branch baseline. — 844
      files, 15 FIXABLE biome nits, **all in concurrent worktree WIP**; the two
      billing-touched files that flag (`proxy.ts`, `plan-selection-dialog.tsx`)
      flag on concurrent-refactor lines, not this plan's edits (see Phase 7
      Debug Log). No new errors from this plan's billing work.
- [x] `pnpm build:app` succeeds. — 20.96s; `/[slug]/settings/billing` builds as
      a dynamic (`ƒ`) route.
- [x] `clerk` CLI confirms the test org and user(s) are deleted (404). — `GET`
      on the org and both user ids all return HTTP 404.

#### Human Review

- [ ] Debug Log final summary → every finding is resolved or consciously
      accepted; the commit list matches the fixes.
      — Phase 7 Debug Log entry below records all 13 findings (6 fixed, 7
      accepted) and the change inventory; awaiting user confirmation.

---

## Testing Strategy

### Unit / component tests

- The existing `org-billing-router.test.ts` and
  `settings-billing-{page,client,loading}.test.tsx` are the regression net —
  they must stay green after every fix.
- When a fix changes observable behavior (e.g. the seat copy, the `onComplete`
  path), update the corresponding component test in the same commit. Do not
  weaken an assertion to make it pass — change it to match the corrected
  behavior.
- New regression tests are added only where a Phase 1–6 finding exposes an
  untested branch (e.g. the no-subscription path, the `error.tsx` boundary).

### Integration / E2E

- The live-app walkthrough in Phases 1–4 is the integration coverage. It is
  driven by `agent-browser` against a real Clerk test org and is not part of
  CI — it is the manual verification performed at execution time, with
  screenshots and `clerk` CLI cross-checks as evidence in the Debug Log.

## Performance Considerations

- `orgBilling.overview` issues two Clerk billing calls (`getPlanList`,
  `getOrganizationBillingSubscription`) per page load on a `force-dynamic`
  route. Acceptable for a settings page; note in the Debug Log if either call
  is observably slow, but do not optimize speculatively.

## Migration Notes

None — no schema or data migration. The only persistent state touched is on the
Clerk dev instance (the test org's subscription and payment methods), fully torn
down in Phase 7.

## References

- Command: `/create_plan` — "end to end test the billing … iteratively debug +
  making update driven"
- Clerk billing config (live, dev): `clerk config pull --keys billing`
- Implementation: `api/app/src/router/(pending-not-allowed)/org-billing.ts`,
  `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/`
- Related: `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md`
  (stale on `billing.enabled`; current on org settings / `max_allowed_memberships`)
- Related: `thoughts/shared/plans/2026-05-20-clerk-billing-task-gating.md`
  (why Billing is not the org-setup gate — billing remains the substrate for
  paid entitlements only)
- Skills: `lightfast-clerk`, `agent-browser`, `clerk-cli`, `clerk-backend-api`,
  `clerk-billing`, `clerk-webhooks`

## Debug Log

> Appended during execution. One entry per phase; each finding gets an id,
> a description, and a resolution (`fixed` + commit, or `accepted (no change)`
> + reason).

### Test org identifiers

| Entity | Value |
|---|---|
| Clerk dev instance | `ins_33UPJBWgqyHb8Ptt6mIJKoBs2BB` |
| Admin user | `user_3E0pBwq0GTv5jUcHbkPJHmvBTit` — `billing-e2e-admin+clerk_test@lightfast.ai` |
| Organization | `org_3E0pFH9zzdDhqCVRMl8WdC26Fsc` — name "Billing E2E Test Org", slug `billing-e2e-test` |
| Subscription (Phase 0) | `csub_3E0pFKURP4IISQJzaNFTJR2GIkt` — status `active` |
| Subscription item (Phase 0) | `csub_item_3E0pFMOMOCKuCkVPyyYvlX1YLDC` → plan `cplan_3DyXa8euH5qwuyEXWX4APW8jpja` (`free_org` / "Starter", default, $0) |
| Billing page URL | `https://lightfast.localhost/billing-e2e-test/settings/billing` |
| agent-browser profile / session | `billing-admin` / `lf-billing-admin` |

### Phase 0 — Harness & baseline smoke

**Harness:** `pnpm dev:app` running; app health `https://app.lightfast.localhost/api/health`
→ 200. Dev URL is the portless aggregate `https://lightfast.localhost` — the
`lightfast-clerk` sign-in playbook's legacy `http://localhost:3024` origin is
**dead** (connection refused); used `https://lightfast.localhost/sign-in`
instead. Admin user provisioned via `clerk-backend.mjs ensure-user`; org created
via `clerk api POST /organizations` with `created_by` (→ creator gets
`org:admin`). Clerk auto-subscribed the new org to the `free_org` default plan
(`GET /organizations/{id}/billing/subscription` → active `free_org`). Browser
sign-in via the playbook (OTP `424242`) succeeded; `window.Clerk.user.id`
matches the provisioned admin and the org is auto-active on the billing page.

**Baseline smoke:** `/billing-e2e-test/settings/billing` renders all four
sections inside the settings shell + sidebar — Plan ("Starter" / "Active" badge
/ "$0.00/month" / "Your organization is on the free Starter plan." / "Adjust
plan"), Payment ("No payment method" / "Update"), Invoices ("No invoices yet."),
Cancellation ("No paid plan is active for this organization."). tRPC
`orgBilling.overview` query returned `ok: true` (905 ms). No page errors; only
dev-mode console noise (Vercel analytics blocked, Clerk dev-keys warning).
Screenshot: `/tmp/billing-e2e/phase0-billing-baseline.png`.

**Findings:**

- **P0-1** — New org auto-provisioned with `max_allowed_memberships: 3`, not the
  `5` the plan's Phase 5 issue #2 assumed (the `2026-05-11` dashboard inventory
  said 5). The hardcoded `"3 seats included"` copy therefore happens to *match*
  the new-org cap — but the value is the instance default for new orgs, not a
  per-plan billing entitlement, so the copy is still misleading (it implies a
  plan feature). Resolution: **accepted (no change) in Phase 0** — full analysis
  and fix deferred to Phase 5 (issue #2).
- No functional defects observed in Phase 0.

### Phase 1 — Read path + error boundary

**Member user:** `user_3E0s1tw53r45fsKQtu3DjQELvsv` —
`billing-e2e-member+clerk_test@lightfast.ai`, added to the test org as
`org:member` (`POST /organizations/{id}/memberships`, role `org:member`).
agent-browser profile / session `billing-member` / `lf-billing-member`.

**Admin read path:** as the admin on `/billing-e2e-test/settings/billing`, all
four sections render inside the settings shell — Plan ("Starter" / "Active" /
"$0.00/month" / "Your organization is on the free Starter plan." / "Adjust
plan"), Payment ("No payment method" / "Update"), Invoices ("No invoices
yet."), Cancellation ("No paid plan is active for this organization."). No
admin-managed notice. Screenshot `/tmp/billing-e2e/phase1-admin-read.png`.

**Non-admin read path:** as the `org:member`, the same four sections render
read-only — no "Adjust plan", no "Update", no "Cancel plan" button — and the
"Billing is managed by organization admins." / "Ask an organization admin to
make subscription or payment changes." notice is shown. Screenshot
`/tmp/billing-e2e/phase1-nonadmin-read.png`.

**Clerk cross-check:** `GET /organizations/{id}/billing/subscription` → status
`active`, one item `free_org` / "Starter" / amount `0` / `canceled_at: null` —
matches the rendered Plan section exactly.

**Error boundary:** a temporary `throw` at the top of `BillingPage`
(`page.tsx`) — simulating any `clerk.billing.*` RSC failure — was caught by the
new `error.tsx`, which rendered the "Billing is temporarily unavailable" panel
with a "Try again" button **inside** the settings shell (sidebar General/
Members/Billing/API Keys intact). The `throw` was reverted; the page recovers.
Screenshot `/tmp/billing-e2e/phase1-error-boundary.png`.

**Findings:**

- **P1-1** — *No `error.tsx` for the billing segment* (pre-identified issue
  #1). Before this phase, any `clerk.billing.*` failure in the RSC `page.tsx`
  threw past `loading.tsx` with no segment-level boundary (only
  `global-error.tsx` / route-group `(auth)`,`(early-access)` boundaries
  existed), crashing the whole settings route. Resolution: **fixed** — added
  `.../settings/billing/error.tsx`, a client error boundary scoped to the
  billing segment. It degrades to an inline panel and survives the settings
  shell, and reports to Sentry via `captureException` with
  `tags.location: "org-billing-settings"` (matching the existing
  `(auth)`/`(early-access)` `error.tsx` observability pattern — the plan's
  `console.error` fallback was unnecessary since the pattern already exists).
- **P1-2** — *No-subscription path not reproducible on this dev instance.*
  Phase 1 change #2 asked what `getOrganizationBillingSubscription` returns for
  an org with no subscription. Confirmed (Phase 0 + this phase's member-org
  cross-check) that Clerk auto-subscribes **every** new org to the `free_org`
  default plan — a literal no-subscription org cannot be produced through
  normal flows here ("older orgs predating billing" do not exist on this
  instance). Resolution: **accepted (no change)** — no graceful "no
  subscription" UI state is warranted because the state is unreachable; the
  `error.tsx` boundary (P1-1) is the safety net if `getOrganizationBillingSubscription`
  ever throws, and the forced-error run exercised exactly that path.
- No functional defects observed in the read path for admin or non-admin.

### Phase 2 — Payment methods management

**Exercise (admin, `/billing-e2e-test/settings/billing`):** drove
`PaymentMethodDialog` / `NewPaymentMethodForm` end to end — add card 1 (Visa
`4242 4242 4242 4242`), add card 2 (Mastercard `5555 5555 5555 4444`), make the
Mastercard default, remove the non-default Visa, error path with the decline
card (`4000 0000 0000 0002`). The Stripe `PaymentElement` is an out-of-process
iframe that `agent-browser`'s `frame`/snapshot cannot enter — fields were filled
by coordinate-driven mouse focus + `keyboard type`. After every mutation the
org's methods were cross-checked against Clerk via the in-page
`organization.getPaymentMethods()` (the Backend API has no org payment-method
list endpoint).

**Results:** all five steps behaved correctly. `makeDefault({ orgId })` and
`remove({ orgId })` both succeeded — confirming `orgId` (`useAuth().orgId` →
`PaymentMethodDialog`) is populated, the plan's pre-identified wiring risk.
`onUpdated()` → `paymentMethodsQuery.revalidate()` refreshed the saved list
after every add/default/remove. The decline card surfaced "Your card has been
declined." in the dialog's destructive `Alert` via `paymentErrorMessage`, the
dialog stayed open, and no method was added. Final org state: 1 method
(Mastercard 4444, default).

**Findings:**

- **P2-1** — *Clerk billing's Stripe `PaymentElement` is blocked by the app's
  CSP + COEP — the entire payment-method/checkout flow was non-functional.* The
  `PaymentElement` was stuck on "Loading payment element..."; the console showed
  `Failed to load Stripe.js`. Root cause in `apps/app/src/proxy.ts`: the
  composed CSP (`@vendor/security` `composeCspOptions`) allows `clerk.accounts.dev`
  but no Stripe domains — `script-src` refused `js.stripe.com` and `frame-src`
  would have refused the Stripe iframe — and `composeCspOptions` inherits
  Nosecone's default `Cross-Origin-Embedder-Policy: require-corp`, which blocks
  every cross-origin subresource lacking a `Cross-Origin-Resource-Policy` header
  (`js.stripe.com` sends none). Not an app defect that's visible from the
  signed-out 307 — the security headers are added by middleware on the rendered
  200 response. Confirmed against Clerk's published billing CSP and Stripe's CSP
  guide. Resolution: **fixed** — added `vendor/security/src/csp/stripe.ts`
  (`createStripeCspDirectives()`: `script-src`/`frame-src` `https://js.stripe.com
  https://*.js.stripe.com`, `frame-src` also `https://hooks.stripe.com`,
  `connect-src https://api.stripe.com`), exported it from `csp/index.ts`,
  composed it in `proxy.ts`, and set `crossOriginEmbedderPolicy: false` there
  (the app uses no cross-origin-isolation-only APIs, so disabling COEP is safe;
  Stripe Elements is fundamentally incompatible with `require-corp`).
  `proxy.test.ts`'s `@vendor/security/csp` mock was extended with
  `createStripeCspDirectives`. Verified live: after the fix `window.Stripe` is
  defined, the Stripe card iframe renders, and all five Phase 2 steps complete.
  (Pre-existing, harmless, not changed: the merged `frame-src` carries a dead
  `'none'` alongside host sources — browsers ignore `'none'` when other sources
  are present.)
- **P2-2** — *Removing the default payment method does not promote a remaining
  card to default.* A removal that left the org with one card produced
  `isDefault: false` on that card; the UI still displays it via
  `getDefaultPaymentMethod`'s `paymentMethods[0]` fallback, so the surface
  degrades gracefully. Adding a card while the org has no default does
  auto-assign the new card as default. Resolution: **accepted (no change)** —
  Clerk-side behavior, display unaffected by the client fallback. Flagged for
  the Phase 5 hardening pass as a possible UX guard (block removing the default
  while other cards exist, or auto-promote) — not a functional defect.
- No defect in the add / make-default / remove / error paths themselves.

### Phase 3 — Upgrade checkout E2E

**Exercise (admin, `/billing-e2e-test/settings/billing`):** drove the full
Starter→Team upgrade — `PlanSelectionDialog` → `ConfirmUpgradeDialog` →
`BillingCheckoutDialog` → `CheckoutProvider`/`CheckoutFlow`. Ran the saved-card
path, the new-card path, and a decline-card error path; reset the org to
`free_org` between runs via `DELETE /billing/subscription_items/{id}?end_now=true`
(the in-product cancel only schedules period-end — `end_now` is the immediate
reset). Each successful upgrade was cross-checked against Clerk.

**Results:** saved-card and new-card checkouts both upgrade the org to `team`
(Clerk-confirmed); the decline card (`4000 0000 0000 0002`) surfaces "Your card
has been declined." through `CheckoutErrors` and leaves the org on `free_org`.
Org left on **Team** for Phase 4.

**Findings:**

- **P3-1** — *Dead `onComplete()` after a hard-reload `finalize` navigate*
  (pre-identified issue #3). `new-payment-checkout.tsx` and
  `saved-payment-checkout.tsx` both ran
  `checkout.finalize({ navigate: () => { window.location.href = decorateUrl(...) } })`
  then `onComplete()` — the full-page reload made `onComplete()` (dialog close +
  `overview` invalidation) dead code and white-flashed the page. Resolution:
  **fixed** — plan option (b): `navigate` now does a Next soft navigation
  (`router.replace(decorateUrl(pathname) as Route)`), so `onComplete()` is
  meaningful. Verified on both paths — a `window` marker set before checkout
  *survived* completion (no hard reload), the dialog closed, and `PlanSection`
  updated to Team in place. (`router.replace` needs the `Route` cast under the
  app's `typedRoutes`; `settings-billing-client.test.tsx` gained a
  `next/navigation` mock for the new `useRouter` calls.)
- **P3-2** — *New-card checkout `PaymentElement` never rendered.* The checkout's
  new-card form sat on "Loading payment element..." indefinitely
  (`isFormReady` never true, no Stripe card iframe, **no console error**) —
  reproducible on a fully clean browser + dev server. Root cause:
  `billing-checkout-dialog.tsx` rendered `<PaymentElementProvider checkout={checkout}>`
  **without `for`**. Clerk's provider derives its resource as
  `for === "organization" ? organization : user`, so it defaulted to
  `for: "user"` and tried to initialize **B2C user billing** — disabled on this
  instance (`billing.user_enabled: false`) — never obtaining an
  `externalClientSecret`, so `PaymentElement` stayed on its fallback. (Phase 2's
  working `NewPaymentMethodForm` passes `for="organization"`.) Resolution:
  **fixed** — added `for="organization"` to the checkout's
  `PaymentElementProvider`. Verified: the Stripe card iframe renders and both
  the new-card success and decline paths complete. (Two console errors chased
  during diagnosis — `shouldShowCloseButton is not defined` and a Stripe
  "stripe prop change" warning — were both **stale Chrome-cached chunks**,
  cleared by a cache wipe; not real bugs.)
- No defect in `BillingCheckoutDialog`'s `onComplete` — post-checkout it
  correctly closes the dialog (`setCheckoutPlan(null)`) and the UI reflects Team
  via `invalidateQueries`.

### Phase 4 — Invoices & cancellation / downgrade

**Exercise (admin, `/billing-e2e-test/settings/billing`, org entering on Team):**
walked invoices → cancel-mutation error path → in-product cancel → plan-dialog
post-cancel state → non-admin checks → forced post-downgrade reset. The order
was deliberately resequenced from the plan: the error-path test (plan step 6)
ran **before** the real cancel because exercising the optimistic-update
rollback requires a non-canceled, cancelable Team item — once the plan is
canceled the "Cancel plan" control is gone.

**Results — all surfaces behaved correctly; no functional defects.**

- **Invoices** — `InvoicesSection` listed one statement (date "May 21, 2026",
  total `$180.00`, status "Open"). `StatementDetailsDialog` ("View") rendered
  total `$180.00` / status "Open" and three "Team — $60.00" line items (the
  three Phase 3 test checkouts in the open billing period). The line-item path
  (`statement.groups.some(g => g.items.length > 0)`) rendered correctly.
- **Cancel (schedule)** — "Cancel plan" → `ConfirmDowngradeDialog` ("Your
  current Team subscription will remain active until Jun 21, 2026, when it will
  change to Starter.") → "Confirm". `PlanSection` and `CancellationSection` both
  switched to "…scheduled to end on Jun 21, 2026." and the "Cancel plan" button
  disappeared. Clerk cross-check: Team item `canceled_at` set, `ended_at: null`,
  `period_end` unchanged — period-end (`endNow: false`) semantics — plus a new
  `upcoming` `free_org` item queued at the Team `period_end`.
- **Downgrade plan dialog** — re-opening `PlanSelectionDialog` with a canceled
  Team item: Starter card button "Scheduled" + disabled (`isStarterSelectionDisabled`),
  Team card button "Your current plan" + disabled, Business "Contact Sales".
- **Non-admin** — as `org:member`: no "Cancel plan" / "Adjust plan" / "Update"
  controls, the "Billing is managed by organization admins." notice shown, and
  `CancellationSection` shows the scheduled-end copy read-only. A direct tRPC
  call to `pendingNotAllowed.orgBilling.cancelSubscriptionItem` from the
  member's authenticated browser returned **HTTP 403 / `FORBIDDEN`** ("Only
  administrators can perform this action") — server-side admin enforcement
  confirmed, not just UI hiding.
- **Post-downgrade** — forced `DELETE /billing/subscription_items/{teamItemId}?end_now=true`
  (the in-product cancel only schedules period-end). Team item `ended_at` set;
  the org's only item became `free_org` / `active`. Reload: `PlanSection`
  "Starter / $0.00/month / Your organization is on the free Starter plan.",
  `CancellationSection` "No paid plan is active for this organization."

**Findings:**

- **P4-1** — *`getCurrentSubscriptionItem` coexistence (pre-identified
  watch-item).* After a period-end cancel the subscription holds two items: the
  `active` canceled Team item and an `upcoming` `free_org` downgrade item.
  `getCurrentSubscriptionItem` filters to `status === "active" | "past_due"`, so
  the `upcoming` `free_org` item is excluded and the `active` Team item is
  selected — the UI correctly keeps showing Team ("scheduled to end") until the
  period actually ends. Resolution: **accepted (no change)** — works as
  intended; the `upcoming` status is what disambiguates the two items.
- **P4-2** — *Cancel-mutation error path (plan step 6).* Forced
  `cancelSubscriptionItem` to fail (temporary `throw new TRPCError` in
  `org-billing.ts`, **reverted** before the phase boundary — `git diff` on that
  file is empty). Triggered "Cancel plan" → "Confirm": the optimistic
  `canceledAt` was applied, the server 500'd, and the UI rolled back to the
  un-canceled "Cancel plan" state with a "Failed to schedule cancellation"
  toast; Clerk cross-check confirmed the subscription was untouched
  (`canceled_at: null`). `onError` (restore `previousOverview`) + `onSettled`
  (invalidate) both drive to the correct rolled-back end-state. Resolution:
  **accepted (no change)** — rollback behaves correctly; the throw was a test
  instrument only.
- **P4-3** — *`StatementDetailsDialog` empty-groups fallback not reproducible.*
  The plan asked to also exercise the "No line-item detail is available"
  fallback (a statement with no line-item groups). The only statement on the
  test org has line items, and Clerk produces a line item per charge — an
  empty-groups statement cannot be produced through normal flows here (cf.
  P1-2). Resolution: **accepted (no change)** — the fallback is a defensive
  branch for a state unreachable on this instance; the populated path is
  verified.
- No functional defect in invoices, cancellation, the downgrade plan dialog,
  non-admin enforcement, or the post-downgrade state. **Phase 4 made no code
  changes.**

### Phase 5 — Hardening & copy pass

**Changes:** one code change (the seat-copy fix below); the rest of the phase is
the non-admin audit and the webhook-gap note, both recorded here. No functional
defects remained from Phases 1–4 — every functional finding (P1-1, P2-1, P3-1,
P3-2) was already fixed in its own phase.

**Findings:**

- **P5-1** — *Hardcoded `"3 seats included"` plan-card copy* (pre-identified
  issue #2; deferred from P0-1). `plan-selection-dialog.tsx` listed
  `"3 seats included"` as the first feature on **both** the Starter and Team
  cards. It is wrong as a plan entitlement: the dev plans (`free_org`, `team`)
  carry empty `features` arrays and no seat entitlement — the only "3" in the
  system is the new-org instance default `max_allowed_memberships: 3` (P0-1), an
  org setting, not a per-plan billing feature. It was also non-differentiating
  (identical on two cards) and would silently rot if the org cap changed.
  Resolution: **fixed** — removed the seat line from both cards (the plan's
  preferred option: "plans carry no seat entitlement"). Starter now lists
  `["Free organization workspace", "Basic access"]`; Team lists
  `["Priority product limits", "Email support", "Team workspace billing"]`;
  Business unchanged. No shared seat constant was introduced because there is no
  real per-plan seat entitlement to source it from. `grep -r "3 seats"
  apps/app/src` is now empty. No test asserted the old copy, so no test change
  was needed. Verified live — `PlanSelectionDialog` renders the corrected cards
  (screenshot `/tmp/billing-e2e/phase5-plan-dialog-copy.png`).
- **P2-2 revisited** — *Removing the default payment method does not promote a
  remaining card.* Flagged in Phase 2 for the Phase 5 hardening pass as a
  possible UX guard. Re-evaluated: kept **accepted (no change)**. It is
  Clerk-side behavior (the `isDefault` flag is owned by Clerk) and the display
  degrades gracefully — `getDefaultPaymentMethod`'s `paymentMethods[0]` fallback
  means no surface ever shows "No payment method" while a card exists. Both
  candidate guards add risk for a non-defect: a "block removing the default"
  guard would block a legitimate action (Clerk already marks a
  genuinely-irreplaceable method non-removable via `isRemovable`), and an
  "auto-promote after remove" guard would chain a second Clerk mutation onto the
  remove, adding a new partial-failure mode. The plan's "What We're NOT Doing"
  scopes this phase to "bug fixes and copy corrections" — P2-2 is neither.

**Non-admin defense-in-depth audit (change #3):** every privileged billing
action is enforced server-side, not merely hidden in the UI. **No gap found.**

- `orgBilling.cancelSubscriptionItem` — the tRPC procedure
  uses `orgAdminProcedure`, so the shared tRPC procedure enforces an active org
  admin before the resolver runs. The resolver also re-verifies the target item
  belongs to the org's subscription and rejects non-`team` items. The client
  `isAdmin` flag is **not** trusted — it only hides controls. Phase 4 proved
  this live: a direct tRPC call from the member's authenticated browser returned
  **HTTP 403 / `FORBIDDEN`**.
- `orgBilling.overview` — read-only; `orgProcedure` requires an active-org
  member. Admin state is now derived on the client via Clerk `useAuth().has({
  role: "org:admin" })`, and privileged mutations still re-check server-side
  through `orgAdminProcedure`.
- Clerk-SDK-direct mutations — `organization.addPaymentMethod`
  (`NewPaymentMethodForm`), `method.makeDefault({ orgId })`,
  `method.remove({ orgId })`, and the `CheckoutProvider` checkout
  (`checkout.confirm` / `checkout.finalize`). These call Clerk's Backend
  directly from the browser under the signed-in user's Clerk session. Clerk
  enforces the organization billing-manage permission (default `org:admin`
  role) server-side on those endpoints — a non-admin's call is rejected by
  Clerk regardless of UI state. The `orgId` we pass only scopes the resource;
  it does not confer permission. Result: **no gap** — the UI's `isAdmin`
  gating is a UX layer; the security boundary is `orgAdminProcedure` (cancel)
  plus Clerk's org-role model (payment methods, checkout).

**Billing webhooks — future work (change #4):** no Clerk billing webhook
consumer exists — there is no handler for `subscription.*`,
`subscriptionItem.*`, or `paymentAttempt.*` events anywhere in `api/app`.
Display correctness is **unaffected**: every billing surface reads live from
Clerk (`orgBilling.overview` server-side, and `usePaymentMethods` /
`useStatements` from `@vendor/clerk/client/experimental` client-side). What is
unbuilt is every lifecycle *side-effect*: in-app dunning when a subscription
goes `past_due`, an audit trail of subscription changes, reacting to a
period-end downgrade actually landing (notifying the org, adjusting
entitlements), and payment-failure notifications. Recommendation: a dedicated
follow-up plan scoped against the `clerk-webhooks` skill's billing event
catalog, undertaken when lifecycle reactions are actually needed. Out of scope
here by the original plan decision (see "What We're NOT Doing"). No billing
README/section exists under `.../settings/billing/`, so this note lives only in
this Debug Log.

### Phase 6 — Clerk-native serialization retest

**Code state entering the phase:** the `@repo/app-billing` cleanup and the
Clerk-native `org-billing.ts` rewrite were already in the working tree (both
files `M` in `git status`, uncommitted branch WIP). Phase 6 made **no new code
changes** — it is the retest of that change. `git diff` confirms:

- `org-billing.ts` — the per-DTO remappers (`toPlanDto`, `toSubscriptionDto`,
  `toSubscriptionItemDto`, `toFeatureDto`, `tierForPlan`) and the `BillingPlan`/
  `BillingSubscription`/`BillingSubscriptionItem` imports were deleted; the
  `overview` and `cancelSubscriptionItem` resolvers now return Clerk-native
  shapes passed through one generic `stripClerkResourcePrototypes` helper.
- `org-billing-router.test.ts` — gained the `ClerkResourceFixture` class +
  `clerkResource()` factory and the `strips Clerk resource prototypes before
  SSR hydration` regression test.

**Findings:**

- **P6-1** — *Clerk billing SDK objects are class-backed; returning them
  directly through the RSC-prefetched tRPC cache crashed the route.* The
  app-billing cleanup intentionally dropped the custom DTOs and returned Clerk
  billing SDK resources directly from `orgBilling.overview`. Clerk's Backend SDK
  hands back class instances (non-`Object.prototype` prototypes), and
  `page.tsx`'s `fetchQuery(orgBilling.overview)` → `<HydrateClient>` carries the
  prefetched tRPC cache across the Server→Client Component boundary, where
  Next.js rejects non-plain objects:
  `Only plain objects, and a few built-ins, can be passed to Client Components
  from Server Components. Classes or null prototypes are not supported.`
  Resolution: **fixed** (in the working-tree branch WIP this phase retests) —
  `org-billing.ts` adds `stripClerkResourcePrototypes`, a generic recursive
  prototype-stripper that rebuilds every nested object onto `Object.prototype`,
  preserves `Date` instances, drops function-valued keys (Clerk resource
  methods), and is cycle-safe via a `WeakMap`. It wraps `plans`, `subscription`,
  and the canceled subscription item before return — keeping the public shape
  fully Clerk-native, no DTO layer reintroduced. The regression net is the
  `org-billing-router.test.ts` `strips Clerk resource prototypes before SSR
  hydration` test, which builds class-backed `ClerkResourceFixture` plans /
  subscription / nested items and asserts `Object.getPrototypeOf(...)` is
  `Object.prototype` at every hydrated level (plans, subscription,
  `subscriptionItems[]`, nested `plan`); `schedules team cancellation` asserts
  the same on the mutation return.

- **P6-2** — *Phase 5 security-audit wording — not stale.* Phase 6 human-review
  asks whether any Phase 5 audit text needed updating for the current
  `orgProcedure` / `orgAdminProcedure` model. Re-checked: the Phase 5 Debug Log
  audit already describes the current implementation exactly — `orgBilling.overview`
  on `orgProcedure` (active-org member), `cancelSubscriptionItem` on
  `orgAdminProcedure` (server-side admin re-check), admin state derived on the
  client via Clerk `useAuth().has({ role: "org:admin" })`, and the overview
  response no longer carrying `isAdmin` / `orgId`. The current `org-billing.ts`
  matches that wording line-for-line (`overview: orgProcedure.query`,
  `cancelSubscriptionItem: orgAdminProcedure`, return is `{ plans, subscription }`
  only). Resolution: **accepted (no change)** — no stale wording; the
  `org-billing-router.test.ts` `does not derive client admin state in the
  overview response` test (asserts `not.toHaveProperty("isAdmin"/"orgId")`)
  pins it.

**Automated retest:** all 6 automated checks green — `org-billing-router.test.ts`
10/10 (incl. the P6-1 regression test), `@repo/app-billing` 5/5, `@vendor/lib`
2/2, billing client + page app-layer 14/14, `pnpm typecheck` 37/37 (FULL TURBO,
no errors), `pnpm build:app` succeeds (21.98s). The live-log check (no "Only
plain objects" / serialization error on a real billing page load) is
browser-driven and deferred to manual verification.

**Manual / browser verification (executed):** the Phase 0 test org
(`org_3E0pFH9zzdDhqCVRMl8WdC26Fsc`, slug `billing-e2e-test`) and both
`agent-browser` profiles (`billing-admin`, `billing-member`, still
`SIGNED_IN_LOCAL`) were reused — no recreation needed. The org sits on
`free_org` / Starter (Clerk Backend API: subscription `csub_3E0pFKURP4IISQJzaNFTJR2GIkt`
`active`, one item plan `Starter` / `free_org`, amount 0), the post-Phase-4
downgrade state.

- **Admin page-load regression** — signed in as `user_3E0pBwq0GTv5jUcHbkPJHmvBTit`
  on `/billing-e2e-test/settings/billing`: all four sections render inside the
  settings shell. `org.settings.orgBilling.overview` returned `ok: true`
  (~362 ms); `GET …/settings/billing → 200`. **No serialization error** in the
  browser console or the `/tmp/console-dev.log` slice (grepped `only plain
  object` / `null prototype` / `classes or null` / `cannot be passed to
  client` / `stringify` — empty). Screenshot `/tmp/billing-e2e/phase6-admin-read.png`.
- **Read-state cross-check** — rendered vs. Clerk truth, all consistent: Plan
  "Starter / Active / $0.00/month / Your organization is on the free Starter
  plan." = subscription `free_org` `active` $0; Payment "Visa •••• 4242" = the
  org's default payment method (Clerk client `getPaymentMethods()` → Visa 4242
  `isDefault: true`, Mastercard 4444 non-default); Invoices "May 21, 2026 /
  $180.00 / Open" = the Phase 3 statement; Cancellation "No paid plan is active
  for this organization." = no Team item.
- **Client-interaction smoke** — `PlanSelectionDialog` (Starter "Your current
  plan" disabled, Team "Switch to Team", Business "Contact Sales"),
  `PaymentMethodDialog` (current Visa 4242 + both saved cards), and
  `StatementDetailsDialog` (Invoice details, $180.00 / Open, 3× "Team —
  $60.00") all opened and closed cleanly — the hydrated Clerk-shaped data flows
  through the helper functions and dialog component state with no error.
  Cancellation-confirm was N/A (org on Starter, not active Team). Screenshot
  `/tmp/billing-e2e/phase6-statement-dialog.png`.
- **Non-admin page-load regression** — signed in as
  `user_3E0s1tw53r45fsKQtu3DjQELvsv` on the same URL: all four sections render
  read-only, `orgBilling.overview` → `ok: true`, `GET → 200`, **no
  serialization error** (console + server-log slice both clean). "Adjust
  plan", "Update", and "Cancel plan" are all **absent**; the "Billing is
  managed by organization admins." notice is shown. Screenshot
  `/tmp/billing-e2e/phase6-nonadmin-read.png`.

**Side observation (not a Phase 6 finding):** the `PlanSelectionDialog` plan-card
copy has been revised again since Phase 5 — it now renders a richer hardcoded
marketing feature list ("Up to 3 users", "2 sources included", "2,500
searches/month total", …) rather than the `["Free organization workspace",
"Basic access"]` lists the Phase 5 Debug Log recorded. This is concurrent
branch WIP on `plan-selection-dialog.tsx` (`M` in `git status`), outside Phase
6's serialization scope. The Phase 5 defect — the literal `"3 seats included"`
string — is still gone (`grep -r "3 seats"` clean; the new copy says "Up to 3
users"/"Minimum 3 users", sourced as marketing copy, not as a Clerk plan
entitlement). Flag for whoever owns the plan-card copy; no action taken here.

**Result:** all 6 automated checks and all 7 manual/browser steps pass. The
Clerk-native serialization fix (`stripClerkResourcePrototypes`) holds end-to-end
on a live billing page for both admin and non-admin. **Phase 6 made no code
changes** — it is a clean retest of the working-tree branch WIP.

### Phase 7 — Regression & teardown

**Full automated regression — all green:**

- `pnpm test --filter @api/app` — 104 passed / 11 files.
- `pnpm test --filter @lightfast/app` — 249 passed / 37 files.
- `pnpm typecheck` — 37/37 turbo tasks successful.
- `pnpm check` — 844 files, 15 errors, **all FIXABLE biome nits in concurrent
  worktree WIP**, none introduced by this plan's billing work. The two
  billing-touched files that now flag do so on concurrent-refactor lines, not
  this plan's edits: `proxy.ts`'s `organizeImports` + `noUselessUndefined` are
  in the `@rescale/nemo` NEMO middleware refactor — entirely new on-branch
  (`git show main:apps/app/src/proxy.ts | grep rescale/nemo` → 0), separate from
  the Phase 2 Stripe-CSP edit (which only added `createStripeCspDirectives()` to
  an existing import block + `crossOriginEmbedderPolicy: false`);
  `plan-selection-dialog.tsx:88`'s `useSortedAttributes` is the concurrent
  `addOns` prop (Phase 5's edit had no `addOns` — see the Phase 6 side
  observation). The remaining 11 errors are in files this plan never touched
  (`auth/identity.ts`, three layout/menu files, `thinking-message.tsx`).
- `pnpm build:app` — succeeds (20.96s); `/[slug]/settings/billing` builds as a
  dynamic (`ƒ`) route.

**Teardown — all Clerk test data deleted:**

- `DELETE /organizations/org_3E0pFH9zzdDhqCVRMl8WdC26Fsc` → `deleted: true`.
  The org was on the free default plan (`free_org` / Starter, subscription
  `csub_3E0pFKURP4IISQJzaNFTJR2GIkt` `active`) — no paid subscription needed
  separate cancellation; the org delete cascades the subscription + payment
  methods.
- `DELETE /users/user_3E0pBwq0GTv5jUcHbkPJHmvBTit` (admin) → `deleted: true`.
- `DELETE /users/user_3E0s1tw53r45fsKQtu3DjQELvsv` (member) → `deleted: true`.
- Deletion verified: `GET` on the org and both user ids all return **HTTP 404**.
- `agent-browser` profiles removed — `.agent-browser/profiles/{billing-admin,billing-member}`
  plus their `.meta.json` sidecars (4 entries; the meta files were inspected
  first and confirmed to reference exactly the two now-deleted test users). The
  62 unrelated profiles in that directory were left untouched. No active
  `agent-browser` sessions (`close --all` → "No active sessions").

**Findings summary — all 13 Phase 0–6 findings resolved (6 fixed, 7 accepted):**

| ID | Finding | Resolution |
|---|---|---|
| P0-1 | New-org `max_allowed_memberships: 3` ≠ assumed 5; "3 seats" copy misleading | accepted (no change) in P0 — deferred to P5-1 |
| P1-1 | No `error.tsx` for the billing segment — a Clerk RSC failure crashed the settings route | **fixed** — added `.../settings/billing/error.tsx` (segment client error boundary → Sentry) |
| P1-2 | Literal no-subscription org unreachable (Clerk auto-subscribes every new org to `free_org`) | accepted (no change) — state unreachable; `error.tsx` is the safety net |
| P2-1 | Stripe `PaymentElement` blocked by the app CSP + COEP — payment/checkout non-functional | **fixed** — added `vendor/security/src/csp/stripe.ts`, composed in `proxy.ts`, `crossOriginEmbedderPolicy: false` |
| P2-2 | Removing the default payment method does not promote a remaining card | accepted (no change) — Clerk-side behavior; display degrades gracefully (re-evaluated in P5) |
| P3-1 | Dead `onComplete()` after a hard-reload `finalize` navigate | **fixed** — `navigate` now does a Next soft nav (`router.replace`); `onComplete()` is meaningful |
| P3-2 | New-card checkout `PaymentElement` never rendered (defaulted to disabled B2C billing) | **fixed** — added `for="organization"` to the checkout `PaymentElementProvider` |
| P4-1 | `getCurrentSubscriptionItem` with a canceled Team + `upcoming` `free_org` item coexisting | accepted (no change) — works as intended; `upcoming` status disambiguates |
| P4-2 | Cancel-mutation optimistic-update rollback | accepted (no change) — rollback behaves correctly; the throw was a test instrument |
| P4-3 | `StatementDetailsDialog` empty-groups fallback not reproducible | accepted (no change) — defensive branch for a state unreachable on this instance |
| P5-1 | Hardcoded `"3 seats included"` plan-card copy (from P0-1) | **fixed** — removed the seat line from both plan cards |
| P6-1 | Clerk billing SDK class-backed objects crash the RSC→Client serialization boundary | **fixed** — `stripClerkResourcePrototypes` in `org-billing.ts` + class-backed-fixture regression test |
| P6-2 | Phase 5 security-audit wording possibly stale | accepted (no change) — audit text matches the current `orgProcedure`/`orgAdminProcedure` model |

**Change inventory — uncommitted working-tree WIP, not dedicated commits.**
This plan's fixes were not landed as separate commits; they live as uncommitted
changes on `feat/clerk-members-billing`, intermixed with the broader branch WIP
(the `@repo/app-billing` cleanup + Clerk-native router rewrite) and concurrent
worktree changes. The branch's 11 commits (`fc8c43479` … `e4870df83`) are the
feature-build commits — none corresponds to a Phase 1–6 fix. Files carrying the
plan's fixes (`M` / `??` versus `main`):

- P1-1 — `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/billing/error.tsx` *(new)*
- P2-1 — `vendor/security/src/csp/stripe.ts` *(new)*, `vendor/security/src/csp/index.ts`, `apps/app/src/proxy.ts`
- P3-1 — `.../settings/billing/_components/new-payment-checkout.tsx`, `saved-payment-checkout.tsx`; `api/app/src/__tests__/org-billing-router.test.ts` (`next/navigation` mock)
- P3-2 — `.../settings/billing/_components/billing-checkout-dialog.tsx`
- P5-1 — `.../settings/billing/_components/plan-selection-dialog.tsx`
- P6-1 — `api/app/src/router/(pending-not-allowed)/org-billing.ts`; `org-billing-router.test.ts` (prototype-strip regression test)

**Result:** every billing surface was exercised end-to-end against a real Clerk
subscription lifecycle (free → +payment methods → Team → canceled → downgraded
→ serialization retest); every functional defect found (P1-1, P2-1, P3-1, P3-2,
P6-1) is fixed and re-verified; the copy/UX defect (P5-1) is fixed; the
automated suite, typecheck, and `build:app` all pass; `pnpm check` carries no
new errors from this plan's work; all Clerk test data and `agent-browser`
profiles are deleted. The billing-webhook gap is documented (Phase 5) as
recommended future work. **Plan complete.**
