# Auth — Clerk Ticket Integration Bugfixes Implementation Plan

## Overview

Fix the two latent pre-existing Clerk Future API bugs that the auth unified-hook refactor's Phase 4 E2E verification surfaced, then deep-test the whole auth surface to surface any other bugs. Both known bugs live in `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` and predate the refactor, which preserved them verbatim. They block 2 of the 4 manual-review paths in `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`.

- **Bug B** — `signUp.create({ ticket, emailAddress, legalAccepted })` rejects with `form_identifier_exists` because the invitation pre-claims the email identifier. **Fix**: drop `emailAddress` only — match the OAuth-ticket branch at `use-auth-flow.ts:130-134` which already calls `signUp.create({ ticket })` cleanly.
- **Bug A** — `signIn.ticket({ ticket })` Future API silently no-ops on sign-in tokens; status stays at `"needs_identifier"`. **Fix (preferred)**: swap `signIn.ticket()` for `signIn.create({ strategy: "ticket", ticket })`, which is the canonical Future API call for ticket-based sign-in per `SignInFutureCreateParams`. **Fallback if that still no-ops**: legacy escape hatch `window.Clerk.client.signIn.create({ strategy: "ticket", ticket })` with a TODO comment. No CDP-research-doc gate — we try the simple fix first and only escalate if runtime shows it fails.

Direct local edits — no feature branch, no PR, no merge queue. Changes are dev-only until the user explicitly asks to commit/ship.

## Current State Analysis

The unified-hook refactor (plan `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`) consolidated all Clerk Future API interactions into `useAuthFlow`. There is now exactly one call site for both bugs:

- **Bug B call site**: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:253-271` — the init effect's sign-up-with-ticket branch:
  ```ts
  if (mode === "sign-up" && ticket) {
    const { error: createError } = await signUp.create({
      ticket,
      emailAddress: email ?? undefined,   // ← bug: collides with invitation's pre-claimed identifier
      legalAccepted: true,
    });
    // ...
  }
  ```
- **Bug A call site**: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:505-543` — the activate effect:
  ```ts
  const { error: ticketError } = await authSpan(
    "auth.session.activate",
    { mode },
    () => signIn.ticket({ ticket: ticketToken }),  // ← bug: resolves { error: null } but status stays "needs_identifier"
  );
  // ...
  if (signIn.status === "complete") {
    // ...finalize
  } else {
    setActivateError("Sign-in failed. Please try again.");  // ← reached every time today
  }
  ```

**Grep-confirmed**: `grep -rn "signIn\.ticket\|signUp\.create" apps/app/src apps/platform/src` finds these two as the only Future API call sites for ticket-based sign-in/sign-up in app code. The OAuth ticket-create branch at `use-auth-flow.ts:130-134` already uses the correct shape (`signUp.create({ ticket })`, no `emailAddress`, no `strategy: "ticket"`) — Bug B's fix brings the OTP-ticket branch into parity with it.

**Existing test coverage**:
- `apps/app/src/__tests__/use-auth-flow.test.tsx:199-258` has 4 tests for the activate slice that mock `signIn.ticket({ ticket })`. They'll be updated to assert `signIn.create({ strategy: "ticket", ticket })` after the Bug A fix lands.
- No test covers the sign-up-with-ticket init branch today (independent coverage gap; Phase 1 closes it).

**Clerk Future API type evidence** (`node_modules/.pnpm/@clerk+shared@4.8.3/node_modules/@clerk/shared/dist/types/index.d.ts`):
- `SignUpFutureCreateParams` at `:5393-5438` — `ticket?: string` (line 5431) with docstring *"Required if `strategy` is set to `'ticket'`"*. `emailAddress?: string` (line 5403) is optional. The OAuth branch confirms `signUp.create({ ticket })` works without explicit `strategy` — the param is implied by the ticket presence.
- `SignInFutureCreateParams` at `:2383-2424` — `ticket?: string` (line 2418) + `strategy?: ... | TicketStrategy` (line 2398). Docstring *"Required if `strategy` is set to `'ticket'`"*.
- `SignInFutureTicketParams` at `:2613-2619` — only `{ ticket: string }`.
- `SignInFutureResource.ticket` at `:2895-2899` — *"Used to perform a ticket-based sign-in"*. No docstring caveat about token kind or pre-priming. This is exactly what the bug contradicts at runtime.

So Bug B has the OAuth-ticket branch as a direct in-repo precedent for the fix shape. Bug A's typed contract says `.ticket()` should work; runtime says it doesn't — but `create({ strategy: "ticket", ticket })` is the documented alternative.

**Pre-refactor parity**: `git show HEAD:apps/app/src/app/(auth)/_components/session-activator.tsx` and `git show HEAD:apps/app/src/app/(auth)/_components/otp-island.tsx` both confirm the bugs predate the unified-hook refactor verbatim. The refactor PR (committed at `85a4041f5`) shipped them as-is.

### Key Discoveries

- Clerk Future API surface diverges from legacy at runtime: identical call shapes work on `window.Clerk.client.signIn.*` (legacy) but fail on the proxied `signIn` returned from `useSignIn()` (Future). This is the central mystery of Bug A. From handoff debug evidence: `await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: "<same JWT>" })` returns `{ status: "complete" }` synchronously, while the Future API method against the same JWT inside the hook leaves status at `"needs_identifier"`. We will not assume which call shape works on Future — we will try `signIn.create({ strategy: "ticket", ticket })` first because the type system advertises it as canonical, and only fall back if it fails at runtime.
- The OAuth ticket-create branch at `use-auth-flow.ts:130-134` passes `signUp.create({ ticket })` *without* `emailAddress` and *without* `strategy: "ticket"`. The Bug B fix matches this exactly (plus `legalAccepted: true`, which the OAuth branch defers to `signUp.sso()` instead — that asymmetry is documented in the existing comment at `:122-129` and stays).
- Email-OTP ticket sign-ups in this dev tenant *would* deliver mail to `jp+<random>@jeevanpillay.com` once Bug B is fixed (waitlist mode is on but tickets bypass it). Superhuman MCP can confirm delivery — see the handoff's "Email plus-addressing" note. Phase 1's E2E verification leverages this.
- The lightfast-clerk skill (`.agents/skills/lightfast-clerk/`) wraps Backend API user provisioning, JWT minting, and reset. For invitations and sign-in tokens, the handoff documents calling `POST /v1/invitations` and `POST /v1/sign_in_tokens` directly with `curl`. The skill's `references/sign-in-playbook.md` is the canonical recipe for `agent-browser`-driven flows.
- `agent-browser` quirks documented in the handoff: daemon persists across calls, `--profile` is silently ignored on the second invocation, `agent-browser close` + ~2s pause is needed between profile changes. Phase 3's deep testing must account for this.

## Desired End State

A specification of the desired end state after this plan completes:

1. Visiting `https://lightfast.localhost/sign-up?__clerk_ticket=<JWT>`, entering the invited email, and clicking "Continue with Email" successfully sends an OTP to Superhuman and (after `424242`-style code entry, or a real code from the inbox) reaches `/account/welcome` with `window.Clerk.user.id` populated.
2. Visiting `https://lightfast.localhost/sign-in?step=activate&token=<sign-in-token-JWT>` reaches `/account/welcome` with `window.Clerk.user.id` populated, with no spurious "Sign-in failed" UI in between.
3. All four manual-review paths in `thoughts/shared/plans/2026-05-13-auth-unified-hook.md` (Phase 3 ticket sign-up, Phase 3 sign-up OTP, Phase 4 valid-token, Phase 4 invalid-token) pass.
4. The deep-testing matrix (Phase 3) executes every auth entry point end-to-end and surfaces any latent bugs. Each bug found gets a same-session fix or an annotated `TODO`/follow-up plan reference.
5. Hook unit tests at `apps/app/src/__tests__/use-auth-flow.test.tsx` cover the sign-up-ticket init branch (new) and assert the chosen activate-slice call shape.
6. If Phase 2's fallback was triggered (legacy escape hatch), a TODO comment in the hook documents the divergence with a link to a follow-up task. No external support ticket is filed in this plan.

### How to verify

- `pnpm --filter=@lightfast/app test` passes (target current baseline + new tests).
- `pnpm --filter=@lightfast/app typecheck` passes.
- `pnpm check` passes against the auth surface (`apps/app/src/app/(auth)/**`, `apps/app/src/__tests__/**`).
- Manual E2E: each phase ships with executable recipes in its Human Review section. Phase 3 (deep testing) ships the master matrix.

## What We're NOT Doing

- Not changing Constraint C (waitlist mode). It is design-as-intended per the handoff and the dev tenant config. The hook's existing `sign_up_restricted_waitlist` → `?errorCode=waitlist` redirect (`use-auth-flow.ts:77-84`) already handles it correctly — Phase 3 will verify this.
- Not changing the OAuth ticket-create branch at `use-auth-flow.ts:130-134`. Its `signUp.create({ ticket })` call is already correct, and the SSO followup needs `legalAccepted` on `signUp.sso()`, not `signUp.create()` (documented in the existing comment).
- Not refactoring the `sign-up/sso-callback/page.tsx` effects (`:19-57`). They run against `AuthenticateWithRedirectCallback`'s internal lifecycle and were intentionally out of scope for the unified-hook plan; same constraint applies here. Phase 3 verifies via UI only.
- Not migrating any other Clerk Future API call sites. The grep confirmed the hook is the only consumer of `signIn.ticket` / `signUp.create` in app code.
- Not adding Playwright E2E tests. Phase 3's manual verification uses `agent-browser` + Superhuman MCP per the existing skill recipes. Playwright is a follow-up plan.
- Not modifying any test infrastructure outside `apps/app/src/__tests__/use-auth-flow.test.tsx`.
- Not touching the unified-hook plan's own files (`auth-errors.ts`, `auth-telemetry.ts`) — both are correct as-is and exercised by these fixes only through the hook entry point.
- Not changing the URL contract, the search-param schema, or any server actions.
- **Not creating a git branch, commits, or PR.** Edits land directly in the working copy. Committing is a separate explicit user-triggered step after this plan completes.
- **Not writing a CDP-trace research document.** The original plan's Phase 2 was a research-doc spike — the user wants iterative fix-test-iterate. If the simple Bug A fix fails and the legacy fallback also fails, only *then* do we capture CDP evidence (out of scope here; would be its own follow-up plan).
- **Not filing an upstream Clerk support ticket** in this plan. If the legacy escape hatch lands, the TODO comment is enough; ticket-filing is a separate side-task.

## Implementation Approach

Edits land directly in the working copy on whatever branch the user is on. Four phases, executed sequentially:

- **Phase 1** — Bug B fix: drop `emailAddress` from the OTP-ticket `signUp.create` call. Match the OAuth-ticket call shape exactly.
- **Phase 2** — Bug A fix: swap `signIn.ticket()` for `signIn.create({ strategy: "ticket", ticket })`. If runtime E2E shows this still no-ops, fall back to the legacy escape hatch in the same phase (don't re-plan — just apply the fallback inline).
- **Phase 3** — Deep testing matrix + error-injection sweep: drive every auth entry point through `agent-browser` + Superhuman MCP. Includes Clerk-side mutations (revoke invitations mid-flow, expire tokens, force network drops) to exercise error paths.
- **Phase 4** — Triage findings from Phase 3: each new bug gets a same-session fix or a follow-up TODO. Update the unified-hook plan rows. Re-run automated checks. Done.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead. If Phase 2's preferred fix fails at runtime, the in-phase fallback (legacy escape hatch) does **not** require a separate go-ahead — it's the documented next move within the same phase.

## Phase 1: Bug B — drop redundant identifier from signUp.create({ ticket })

### Overview

Fix the `form_identifier_exists` rejection in the OTP ticket sign-up branch. Replace the current `{ ticket, emailAddress, legalAccepted }` payload with `{ ticket, legalAccepted: true }` — matching the OAuth-ticket branch at `use-auth-flow.ts:130-134` exactly (which uses `signUp.create({ ticket })` and works). Do **not** add `strategy: "ticket"` — it's redundant: the OAuth branch proves the ticket itself implies the strategy. Add a unit test covering the call shape (current coverage gap). E2E-verify by sending a real OTP through Superhuman.

### Changes Required

#### 1. Hook fix

**File**: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`
**Changes**: Update the init effect's sign-up-with-ticket branch (lines `254-264`) to drop `emailAddress`. Preserve all surrounding logic (status check, `resolvedEmail` fallback, OTP send, error/breadcrumb wiring).

```ts
// :253-271 — init effect, sign-up + ticket branch
async function init() {
  if (mode === "sign-up" && ticket) {
    // The invitation pre-claims the email identifier server-side, so we must
    // NOT pass emailAddress explicitly — doing so triggers form_identifier_exists.
    // Mirrors the OAuth-ticket branch at use-auth-flow.ts:130-134 which calls
    // signUp.create({ ticket }) cleanly. legalAccepted: true matches the
    // no-ticket sign-up branch below (line 309-312) for consistency.
    const { error: createError } = await signUp.create({
      ticket,
      legalAccepted: true,
    });
    if (createError) {
      const { success } = handleOtpClerkError(createError);
      if (!success) {
        return;
      }
    }
    if (signUp.status === "complete") {
      setIsRedirecting(true);
      await signUp.finalize({ navigate: navigateToSuccess });
      return;
    }
    setResolvedEmail(signUp.emailAddress ?? email ?? null);
    // ...remainder unchanged (sendEmailCode + breadcrumbs)
  }
  // ...rest of init effect unchanged
}
```

#### 2. New unit test — sign-up-with-ticket init branch

**File**: `apps/app/src/__tests__/use-auth-flow.test.tsx`
**Changes**: Add a `describe("useAuthFlow — init effect (sign-up + ticket)")` block that:
- Asserts `signUpStub.create` is called exactly once with `{ ticket, legalAccepted: true }` (no `emailAddress` key, no `strategy` key).
- Asserts the call is guarded by `hasInitRef` (re-render and StrictMode tests parallel to the existing no-ticket cases at `:154-184`).
- Asserts `verifications.sendEmailCode` fires once after `create` resolves with `{ error: null }`.
- Covers the `signUp.status === "complete"` early-return branch (sets stub status to `"complete"`, asserts `finalize` runs and `hrefValue === "/account/welcome"`).

The `SignUpStub` interface (`:53-63`) already exposes `create: Mock`; no stub plumbing changes needed.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter=@lightfast/app typecheck` passes.
- [ ] `pnpm --filter=@lightfast/app test` passes; new sign-up-ticket tests assert the exact call shape `{ ticket, legalAccepted: true }` (no `emailAddress` key, no `strategy` key) and the hasInitRef / StrictMode guards parallel the existing no-ticket suite.
- [ ] `pnpm check apps/app/src/app/\(auth\)/_hooks/use-auth-flow.ts apps/app/src/__tests__/use-auth-flow.test.tsx` passes (Biome lint + format).

#### Human Review

- [ ] Provision a fresh invitation:
      ```bash
      EMAIL="jp+phase1-$(date +%s)@jeevanpillay.com"
      curl -sS -X POST "$CLERK_BACKEND_URL/v1/invitations" \
        -H "Authorization: Bearer $CLERK_SECRET_KEY" \
        -H "Content-Type: application/json" \
        --data "{\"email_address\":\"$EMAIL\",\"redirect_url\":\"https://lightfast.localhost/sign-up\",\"notify\":false}" \
        | jq -r '.url' | sed -E 's/.*__clerk_ticket=([^&]+).*/\1/'
      # → JWT
      ```
      Drive `https://lightfast.localhost/sign-up?__clerk_ticket=<JWT>` via `agent-browser`, fill the email field with the same `$EMAIL`, click "Continue with Email" → expected observation: URL transitions to `?step=code&email=<EMAIL>&ticket=<JWT>`, OTPIsland renders "We sent a verification code to ..." heading, no inline `form_identifier_exists` error appears.
- [ ] Within ~30s of the previous step, `mcp__superhuman-mail__list_threads` filtered to the Clerk sender returns a thread to `$EMAIL` containing a 6-digit OTP. Extract the code and complete the flow via `agent-browser fill "@<ref>" <code>` → expected observation: page navigates to `/account/welcome`, `window.Clerk.user.id` populated, the user with `$EMAIL` exists per `curl /v1/users?email_address=<encoded>`.

### Fallback if Bug B's minimal fix still fails

If `signUp.create({ ticket, legalAccepted: true })` still rejects (unlikely given the OAuth-branch precedent, but possible if Clerk treats OTP-ticket differently from OAuth-ticket): add `strategy: "ticket"` explicitly inside the same phase, update the new test's `toHaveBeenCalledWith` assertion, and continue. Do not block on a separate phase.

### Cleanup after the phase

- [ ] Revoke the test invitation: `curl -X POST $CLERK_BACKEND_URL/v1/invitations/<id>/revoke`.
- [ ] Delete the test user: `node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs delete-user <user_id>`.
- [ ] Close `agent-browser`: `agent-browser close`.

---

## Phase 2: Bug A — swap signIn.ticket() for signIn.create({ strategy: "ticket", ticket })

### Overview

Replace the activate effect's `signIn.ticket({ ticket })` call with the documented canonical Future API equivalent: `signIn.create({ strategy: "ticket", ticket })`. Per the type docs, this *should* drive the SignIn resource to `status: "complete"` directly, after which `signIn.finalize({ navigate })` lands the user on `/account/welcome`. If runtime shows this still no-ops, apply the legacy escape hatch inline (same phase, no separate plan).

### Changes Required

#### 1. Hook fix — preferred path (`signIn.create({ strategy: "ticket", ticket })`)

**File**: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`
**Changes**: Update the activate effect (`:516-538`). Preserve the `mapOtpClerkError`-as-success fallthrough for `verification_already_verified` (retry/refresh handling), the `hasActivatedRef` guard, and the trailing `status === "complete"` check.

```ts
// :516-538 — activate effect, Future API canonical path
const ticketToken = token;
async function activate() {
  authBreadcrumb("Session activation via ticket", "info", {});
  // signIn.ticket() Future API silently no-ops on sign-in tokens — status
  // stays at "needs_identifier" even with { error: null }. signIn.create
  // with explicit strategy: "ticket" is the documented Future API alternative
  // per SignInFutureCreateParams; see plan:
  // thoughts/shared/plans/2026-05-13-auth-clerk-ticket-bugfixes.md
  const { error: createError } = await authSpan(
    "auth.session.activate",
    { mode },
    () => signIn.create({ strategy: "ticket", ticket: ticketToken })
  );
  if (createError) {
    // verification_already_verified can fire here on retry/refresh —
    // treat it as success and check status. Reuse mapOtpClerkError so the
    // activate slice never bypasses the normalizer / native guard path.
    const mapped = mapOtpClerkError(createError);
    if (mapped.kind !== "success") {
      setActivateError("Sign-in failed. Please try again.");
      return;
    }
  }
  if (signIn.status === "complete") {
    authBreadcrumb("Session activated", "info", {});
    await signIn.finalize({ navigate: navigateToSuccess });
  } else {
    setActivateError("Sign-in failed. Please try again.");
  }
}
```

#### 2. Test updates

**File**: `apps/app/src/__tests__/use-auth-flow.test.tsx`
**Changes**:
- Add `create: Mock` to `SignInStub` interface and `makeSignInStub()`. Default `mockResolvedValue({ error: null })`.
- Update the 4 existing activate-slice tests at `:199-258` to assert against `signInStub.create({ strategy: "ticket", ticket })` instead of `signInStub.ticket`.
- Keep the `hasActivatedRef` / StrictMode guards as semantic checks (one call exactly).
- Drop the `signInStub.ticket` mock entirely once no tests reference it.

#### 3. Fallback — legacy escape hatch (apply ONLY if step 1 fails the E2E human-review check)

If the activate URL still lands on "Sign-in failed" after step 1, replace the activate effect body with the legacy global call. This is the only call shape proven to work today per the handoff's debug evidence.

```ts
// :516-538 — activate effect, legacy escape hatch (fallback only)
const ticketToken = token;
async function activate() {
  authBreadcrumb("Session activation via ticket (legacy fallback)", "info", {});
  // Future API signIn.ticket() and signIn.create({ strategy: "ticket" })
  // both no-op against sign-in tokens in clerk-js@5.x in this hook context.
  // The legacy window.Clerk.client.signIn.create({ strategy: "ticket", ticket })
  // succeeds against the same JWT — see handoff debug evidence at
  // thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md
  // TODO(auth): remove this branch once the Future API is fixed upstream.
  const clerk = window.Clerk;
  if (!clerk?.client?.signIn) {
    setActivateError("Sign-in failed. Please try again.");
    return;
  }
  try {
    const result = await authSpan(
      "auth.session.activate.legacy",
      { mode },
      () => clerk.client.signIn.create({ strategy: "ticket", ticket: ticketToken })
    );
    if (result.status === "complete") {
      authBreadcrumb("Session activated (legacy)", "info", {});
      await signIn.finalize({ navigate: navigateToSuccess });
    } else {
      setActivateError("Sign-in failed. Please try again.");
    }
  } catch (err) {
    const mapped = mapOtpClerkError(err);
    if (mapped.kind === "success" && signIn.status === "complete") {
      await signIn.finalize({ navigate: navigateToSuccess });
    } else {
      setActivateError("Sign-in failed. Please try again.");
    }
  }
}
```

If the fallback runs, the tests also pivot:
- Add a `window.Clerk` shim in `beforeEach` parallel to the existing `window.location` shim (`:122-148`). Mock `window.Clerk.client.signIn.create` returning `{ status: "complete", id: "sia_test" }` by default.
- Update the 4 activate-slice tests to assert against `window.Clerk.client.signIn.create`.
- Add a test for the `window.Clerk` undefined defensive guard.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter=@lightfast/app typecheck` passes.
- [ ] `pnpm --filter=@lightfast/app test` passes; all 4 existing activate-slice tests updated to the chosen call shape; new tests cover whichever path landed.
- [ ] `pnpm check apps/app/src/app/\(auth\)/_hooks/use-auth-flow.ts apps/app/src/__tests__/use-auth-flow.test.tsx` passes.

#### Human Review

- [ ] Mint a fresh sign-in token via Backend API:
      ```bash
      USER_ID=$(node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs ensure-user "jp+phase2-$(date +%s)@jeevanpillay.com" | jq -r .userId)
      TOKEN=$(curl -sS -X POST "$CLERK_BACKEND_URL/v1/sign_in_tokens" \
        -H "Authorization: Bearer $CLERK_SECRET_KEY" \
        -H "Content-Type: application/json" \
        --data "{\"user_id\":\"$USER_ID\",\"expires_in_seconds\":600}" | jq -r .token)
      ```
      Open `https://lightfast.localhost/sign-in?step=activate&token=$TOKEN` in a clean `agent-browser` profile → expected observation: page renders the "Signing in..." spinner briefly, then navigates to `/account/welcome`; `window.Clerk.user.id` equals `$USER_ID`; no "Sign-in failed" UI ever rendered.
- [ ] **If the preferred path fails this check**: apply the fallback (legacy escape hatch) in the same phase, repeat the E2E. Note in the conversation that the fallback was triggered. Do not advance to Phase 3 with a broken activate flow.

### Cleanup after the phase

- [ ] Delete test user, revoke unused tokens.
- [ ] `agent-browser close`, remove `.agent-browser/profiles/phase2-*`.

---

## Phase 3: Deep testing matrix + error-injection sweep

### Overview

With Bugs A and B fixed, exercise **every** auth entry point end-to-end. Goal is to surface latent bugs the unified-hook refactor preserved but neither bug A nor B masked. Includes error-injection (Clerk-side state mutations between page loads) to exercise UI error paths that are otherwise unreachable in normal use.

This phase ships findings, not code. Bugs surfaced here either get a same-session inline fix (small) or an annotated TODO + follow-up plan reference (larger).

### Test matrix

For each path, the success criterion is the same: page navigates to the expected destination, no spurious error UI, `window.Clerk.user.id` populated when expected. Record observed UI, URL transitions, network errors, console errors.

#### Happy paths (golden 4 from unified-hook plan)

1. **Sign-in OTP** — `https://lightfast.localhost/sign-in` → enter `jp+e2e-signin@jeevanpillay.com` (must exist; ensure-user first) → click "Continue with Email" → URL transitions to `?step=code&email=...` → grab 6-digit code from Superhuman → enter code → `/account/welcome`.
2. **Sign-up OTP (no ticket, on waitlist)** — `https://lightfast.localhost/sign-up` → enter a fresh `jp+e2e-signup-$(date +%s)@jeevanpillay.com` (no invitation) → click "Continue with Email" → expected: redirects to `/sign-up?errorCode=waitlist` (Constraint C; waitlist mode rejects non-invited identifiers). The error toast must render with the documented copy.
3. **Ticket sign-up** — provision invitation → `?__clerk_ticket=<JWT>` → fill email matching the invitation → OTP → `/account/welcome`. (Re-verifies Phase 1.)
4. **Magic-link activate** — mint sign-in token → `?step=activate&token=<JWT>` → `/account/welcome`. (Re-verifies Phase 2.)

#### OAuth happy paths

5. **OAuth sign-in (no ticket)** — `https://lightfast.localhost/sign-in` → click "Continue with Google" → expected: redirects to Google consent → returns to `/account/welcome`. Use a Google account the dev tenant already trusts; document the account in conversation.
6. **OAuth sign-up (no ticket, on waitlist)** — `/sign-up` → "Continue with Google" → expected: same `?errorCode=waitlist` redirect after Google returns (constraint C still applies; OAuth doesn't bypass waitlist for non-invited identifiers).
7. **OAuth sign-up (ticket)** — provision invitation matching a Google-trusted email → `/sign-up?__clerk_ticket=<JWT>` → "Continue with Google" → expected: `signUp.create({ ticket })` then `signUp.sso({ ..., legalAccepted: true })` → Google consent → `/account/welcome`.

#### Search-param and URL contract paths

8. **`?errorCode=waitlist`** — load `https://lightfast.localhost/sign-up?errorCode=waitlist` directly → expected: error toast renders documented waitlist copy; no auto-redirect.
9. **`?errorCode=oauth_invalid_identifier`** — load `https://lightfast.localhost/sign-in?errorCode=oauth_invalid_identifier` directly → expected: error toast renders documented OAuth invalid-identifier copy.
10. **`?step=code&email=<EMAIL>`** (deep-link without prior init) — load the URL directly without first hitting `?step=email` → expected: hook attempts to send a code on init via `signIn.emailCode.sendCode`. Will either send (if user exists) or error with `form_identifier_not_found`. Document which.
11. **`?step=code` with no email param** — load directly → expected: hook's missing-email guard at `use-auth-flow.ts:247-251` sets `otpError = "Missing email. Please start over."` and no FAPI call fires.
12. **`?step=activate` with no token** — load directly → expected: activate effect's `!token` guard at `:506-508` short-circuits; no UI change, no FAPI call.

#### Error-injection paths

13. **Revoked invitation** — provision invitation, capture JWT, revoke immediately via `curl /v1/invitations/<id>/revoke`, then visit `/sign-up?__clerk_ticket=<JWT>` → expected: `signUp.create({ ticket })` errors (Clerk returns invalid-ticket). Verify error toast is human-readable, not raw Clerk message.
14. **Expired sign-in token** — mint sign-in token with `expires_in_seconds: 1`, wait 2s, visit `?step=activate&token=<JWT>` → expected: activate flow surfaces user-readable error (not "Sign-in failed. Please try again." generic).
15. **Reused sign-in token** — mint sign-in token, visit activate URL, succeed, sign out, paste the same activate URL again → expected: surface user-readable error (token already consumed). Document if it's the generic message.
16. **Reused invitation ticket** — sign up successfully via a ticket → sign out → revisit `?__clerk_ticket=<JWT>` → expected: error toast (ticket already redeemed).
17. **Bad OTP code** — sign-in OTP flow, enter `111111` instead of the real code → expected: `verifyCode` returns error with `form_code_incorrect`. Verify `otp.error` renders correct copy and `verifyingCodeRef` resets so the user can re-enter.
18. **Resend code** — sign-in OTP flow, hit "Resend code" → expected: `signIn.emailCode.sendCode` fires again, new code arrives in Superhuman, old code rejected by FAPI.
19. **Browser back at `?step=code`** — sign-in OTP flow, advance to `?step=code`, hit browser back → expected: returns to `?step=email`, no zombie effects fire, `hasInitRef` is reset across mounts (cleanly remounted hook). Re-submitting email should re-trigger OTP send.
20. **Browser refresh at `?step=code`** — sign-in OTP flow, advance to `?step=code`, refresh page → expected: hook remounts, init effect re-fires `signIn.emailCode.sendCode` exactly once (no double-send despite StrictMode), code arrives again. Document whether the user gets a fresh code or sees a `form_already_sent` error.
21. **Network drop mid-OTP-send** — open DevTools → throttle to "Offline" → submit email on `?step=email` → expected: `sendCode` rejects, error toast renders user-readable message, "Continue with Email" button re-enables.
22. **Network drop mid-verify** — `?step=code` → throttle offline → enter code → expected: `verifyCode` rejects gracefully.

#### State-leak / re-mount paths

23. **Two tabs, same step** — open `?step=email` in tab A, submit; open `?step=email` in tab B with same email, submit → expected: both reach `?step=code`. Verify each tab gets a distinct OTP (or document that Clerk de-dupes server-side and only the most recent OTP is valid).
24. **Sign in, sign out, sign in again** — full round trip → expected: second sign-in clean, no leftover state from first.
25. **Race: rapid resend** — `?step=code` → click "Resend code" 5x rapidly → expected: hook debounces (or Clerk rate-limits gracefully). Document which.
26. **Race: rapid email submit** — `?step=email` → click "Continue with Email" 5x rapidly → expected: only one OTP send fires (button disabled or hook idempotent).

### Findings recording

For each test row, record in `thoughts/shared/research/2026-05-13-auth-deep-test-findings.md` (new):
- Path number + name.
- Observed behavior (one paragraph).
- Pass/fail vs. expected.
- If fail: severity (P0/P1/P2), proposed fix or follow-up plan, whether fixed in Phase 4 or deferred.
- Network/console errors, if any.

The document is the deliverable for this phase. No code changes happen here (those go in Phase 4 if same-session, or a follow-up plan).

### Success Criteria

#### Automated Verification

- [ ] `thoughts/shared/research/2026-05-13-auth-deep-test-findings.md` exists with one section per test row (26 rows).
- [ ] Each row marked PASS or FAIL with observed behavior recorded.

#### Human Review

- [ ] At least the 4 golden paths (rows 1-4) pass; failures on those block Phase 4.
- [ ] OAuth happy paths (rows 5-7) all pass.
- [ ] Error-injection rows (13-22) each have documented behavior — fails are recorded as findings, not blockers.
- [ ] User reviews the findings document and decides which P0/P1 findings get same-session fixes in Phase 4 vs. deferred to follow-up plans.

### Cleanup after the phase

- [ ] Delete all spike users via `node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs delete-user <user_id>` for each.
- [ ] Revoke all unused invitations.
- [ ] `agent-browser close`, remove `.agent-browser/profiles/phase3-*`.

---

## Phase 4: Triage findings + final verification

### Overview

For each P0/P1 finding from Phase 3 the user designated for same-session fix: apply the fix, add a test if the bug is in `use-auth-flow.ts`, re-run the affected test row from the matrix. P2 findings get TODO comments or stub follow-up plans under `thoughts/shared/plans/`. Update the unified-hook plan's manual-review rows. Re-run all automated checks.

### Changes Required

Open-ended — depends on Phase 3 output. Each fix follows the same shape:

1. Reproduce locally (re-run the Phase 3 row).
2. Patch the smallest unit (hook function, error message, search-param handler).
3. Add or update a unit test in `apps/app/src/__tests__/`.
4. Re-run the Phase 3 row and confirm.
5. Annotate the finding in `2026-05-13-auth-deep-test-findings.md` with the fix commit-equivalent (since we're not committing: cite the diff range).

For P2 / deferred findings:
- Add a TODO comment at the relevant call site pointing to the finding document anchor.
- If multiple P2s cluster, draft a thin follow-up plan stub at `thoughts/shared/plans/2026-05-13-auth-deep-test-followups.md` (one line per finding).

### Unified-hook plan updates

After all P0/P1 fixes land:

- [ ] Update `thoughts/shared/plans/2026-05-13-auth-unified-hook.md` Phase 4 valid-token row to `[x]` with verification date and a one-line note referencing this plan's Phase 2.
- [ ] Update `thoughts/shared/plans/2026-05-13-auth-unified-hook.md` Phase 3 ticket sign-up row to `[x]` with verification date.
- [ ] Update unified-hook Phase 5 status from "not started" to "[DONE]" with a one-line completion note.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter=@lightfast/app test` passes (no regressions; new tests for each in-phase fix included).
- [ ] `pnpm --filter=@lightfast/app typecheck` passes.
- [ ] `pnpm check apps/app/src/app/\(auth\)` passes.

#### Human Review

- [ ] Each P0/P1 finding from Phase 3 marked RESOLVED in the findings doc with diff range citation.
- [ ] Each P2 finding marked DEFERRED with TODO comment or follow-up plan reference.
- [ ] Unified-hook plan rows updated.

### Cleanup after the phase

- [ ] Final agent-browser shutdown.
- [ ] Optional: user decides whether to commit the accumulated changes (separate explicit step; not part of this plan).

---

## Testing Strategy

### Unit Tests

- `apps/app/src/__tests__/use-auth-flow.test.tsx` — new sign-up-ticket init branch tests (Phase 1), updated activate-slice tests (Phase 2), and tests for any hook-level fixes from Phase 4. Existing `mapOtpClerkErrorMock` test infrastructure is reused for activate-slice success-fallthrough cases.
- `apps/app/src/__tests__/auth-errors.test.ts` — no changes expected; the auth-errors mappers are unchanged by Phases 1-2. Phase 4 may surface mapper bugs (e.g., a Clerk error code we don't map cleanly) — in which case `auth-errors.test.ts` gets a row per missed code.
- `apps/app/src/__tests__/auth-search-params.test.ts` — no changes expected; same condition as auth-errors.

### Integration / E2E Tests

- Phase 1's "Human Review" section is the integration check for Bug B. Recipe uses real Superhuman delivery via `mcp__superhuman-mail__list_threads`.
- Phase 2's "Human Review" section is the integration check for Bug A. Recipe uses Backend `POST /v1/sign_in_tokens` and `agent-browser` URL navigation.
- Phase 3 is the integration check for everything else (26-row matrix + error injection).

## Performance Considerations

- Bug A's fix (`signIn.create({ strategy: "ticket", ticket })`) is one FAPI round-trip, same as `signIn.ticket()`. No perf delta.
- Bug A's fallback (legacy escape hatch) is also one FAPI round-trip — different surface, same call count.
- Bug B's fix has no perf impact — payload shape changes but request count and structure don't.
- Phase 3's deep testing is dev-only; runtime cost is human-time (~30-60 min for the full matrix), not user-facing perf.

## Migration Notes

- No data migration needed. Both fixes change client-side call shape, not stored state.
- No URL contract change; `?step=activate&token=…` and `?__clerk_ticket=…` continue to work identically from the user's perspective.
- No backwards-compatibility shim needed; both bugs predate any merged release of the affected code (the unified-hook refactor at `85a4041f5` was the first commit to ship the hook to `main`, and these bugs were preserved verbatim from the pre-refactor components).
- If Phase 2's fallback was triggered (legacy escape hatch) and Clerk later ships a fix to the Future API, deleting the legacy escape hatch is one focused commit guided by the TODO comment.

## References

- Original handoff: `thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md`
- Unified-hook plan (parent): `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`
- Auth UX state research: `thoughts/shared/research/2026-05-11-web-auth-ux-current-state.md`
- Clerk tenant inventory: `thoughts/shared/research/2026-05-11-clerk-dashboard-inventory.md`
- Hook under fix: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:253-271` (Bug B), `:505-543` (Bug A)
- Hook tests: `apps/app/src/__tests__/use-auth-flow.test.tsx:199-258` (activate slice)
- Auth error mapper (unchanged unless Phase 4 surfaces a missed code): `apps/app/src/app/(auth)/_hooks/auth-errors.ts:28-66`
- Search-param schema (unchanged): `apps/app/src/app/(auth)/_lib/search-params.ts:15-31`
- Clerk Future API types: `node_modules/.pnpm/@clerk+shared@4.8.3/.../index.d.ts` — `SignInFutureCreateParams` `:2383`, `SignInFutureTicketParams` `:2613`, `SignInFutureResource` `:2651-2933`, `SignUpFutureCreateParams` `:5393-5438`, `__internal_future` accessor `:3013`
- Clerk docs cited inline by the types: https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations
- lightfast-clerk skill (E2E driver): `.agents/skills/lightfast-clerk/SKILL.md`, `.agents/skills/lightfast-clerk/references/sign-in-playbook.md`, `.agents/skills/lightfast-clerk/lib/clerk-backend.mjs`
- Superhuman MCP: `mcp__superhuman-mail__list_threads` for OTP delivery checks
- Pre-existing memory: `feedback_lightfast_merge_queue.md` (PR merge style, only relevant if user later asks to commit), `feedback_persistent_dirty_worktree.md` (untracked `thoughts/` files are intentional)

---

## Improvement Log

### 2026-05-13 — adversarial review

Triggered by `/improve_plan` with user direction: "no need for pr/commit. remove that. just make changes and ensure it works. secondly, let's also, proceed with deep testing the existing sign in and sign up flows to find more bugs if any."

**Removed:**
- Branch + merge-queue PR ceremony from Overview and Implementation Approach. Edits land directly in the working copy. Committing is a separate explicit step after the plan completes.
- Phase 5 (file Clerk support ticket). Out of scope for "make changes and ensure it works."
- Original Phase 2 (CDP-trace research-doc spike). The user wants iterative fix-test-iterate, not pre-planned research artifacts. CDP capture is now mentioned only as an out-of-scope follow-up if both Phase 2 fix attempts fail.
- Pre-scoped Branches A1/A2/A3 in old Phase 3. Collapsed to one path (`signIn.create({ strategy: "ticket", ticket })`) with the legacy escape hatch as a documented in-phase fallback. Old Branch A3 (degraded UX) is dropped — if both attempts fail, the user re-plans; we don't ship degraded UX silently.

**Simplified:**
- **Bug B fix:** previous plan added `strategy: "ticket"` to `signUp.create`. Adversarial review found that the OAuth-ticket branch at `use-auth-flow.ts:130-134` already calls `signUp.create({ ticket })` *without* `strategy: "ticket"` and works. New fix matches the OAuth precedent exactly: `signUp.create({ ticket, legalAccepted: true })`. Added a fallback inside Phase 1 to add `strategy: "ticket"` only if the minimal form fails.
- **Bug A fix:** previous plan presented three pre-scoped branches gated by a CDP research doc. New plan: try the Future API canonical `signIn.create({ strategy: "ticket", ticket })` first; if runtime shows it still no-ops, apply the legacy escape hatch inline in the same phase. No research-doc gate.

**Added:**
- **Phase 3 (deep testing matrix + error-injection sweep).** User's explicit second ask. 26-row matrix covering golden paths (4), OAuth paths (3), URL-contract paths (5), error-injection paths (10), and state-leak / re-mount paths (4). Phase 3's deliverable is `thoughts/shared/research/2026-05-13-auth-deep-test-findings.md`.
- **Phase 4 (triage findings + final verification).** Open-ended fix phase for whatever Phase 3 surfaces.

**Adversarial spike decision:** identified the highest-leverage uncertainty as "does `signIn.create({ strategy: "ticket", ticket })` alone drive status to complete?" — but skipped the formal `spike-validator` worktree run. Rationale: a 2-line code change is faster to verify in the working copy during execution than a separate isolated worktree spike. Lower-latency given user direction "just make changes and ensure it works."

**Carried forward unchanged:**
- Current State Analysis (call site references), Desired End State items 1-3, What We're NOT Doing items (constraint C, OAuth ticket-create branch, sso-callback, URL contract).
- Testing Strategy section structure.
- Performance Considerations.
- Migration Notes.
- References section (added auth-UX research + clerk-dashboard-inventory pointers).
