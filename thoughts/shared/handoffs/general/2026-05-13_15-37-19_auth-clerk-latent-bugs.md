---
date: 2026-05-13T15:37:19+1000
researcher: Jeevan Pillay
git_commit: 85a4041f59c120fed9635a5426f3e6e95d54cd5d
branch: main
repository: lightfast
topic: "Auth flow — latent pre-existing Clerk integration bugs surfaced by Phase 4 E2E verification"
tags: [handoff, auth, clerk, use-auth-flow, session-activator, otp-island, magic-link, invitation]
status: complete
last_updated: 2026-05-13
last_updated_by: Jeevan Pillay
type: handoff
---

# Handoff: auth-flow latent Clerk integration bugs

## Task(s)

End-to-end verification of the auth unified-hook refactor (plan: `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`) surfaced **two latent pre-existing bugs** in the Clerk client integration and **one tenant-config constraint** that block three of the four manual-review paths. The refactor itself preserves behavior verbatim — these bugs predate this PR and were invisible before because the manual verification items were listed as `TODO: automate via Playwright` and never actually exercised.

- **Bug A — magic-link activate Future API no-op** — status: open, needs follow-up plan
- **Bug B — ticket sign-up `signUp.create` "email in use" conflict** — status: open, needs follow-up plan
- **Constraint C — waitlist mode blocks non-ticket signups** — status: design-as-intended; documents the verification gap

Refactor Phase 4 itself is complete and clean. This handoff only tracks the bugs/errors.

## Plan State

Plan: `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`

- Phase 1 (build hook): `[DONE]`
- Phase 2 (migrate `oauth-button.tsx`): `[DONE]`
- Phase 3 (migrate `otp-island.tsx`): `[DONE]`
- Phase 4 (migrate `session-activator.tsx`): automated criteria all `[x]`; manual review — invalid-token `[x]` (verified 2026-05-13), valid-token `[ ]` (BLOCKED by Bug A)
- Phase 5 (cleanup & verification): not started

Plan annotations updated with evidence at:
- Phase 3 ticket sign-up row (Bug B)
- Phase 4 valid-token row (Bug A)

## Critical References

- Plan: `thoughts/shared/plans/2026-05-13-auth-unified-hook.md`
- Hook under test: `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` (activate slice at `:500-543`; sign-up ticket init at `:282-307` per pre-refactor signature)
- Clerk Future API types: `node_modules/.pnpm/@clerk+shared@4.8.3_…/dist/types/index.d.ts:2613` (`SignInFutureTicketParams`), `:2383` (`SignInFutureCreateParams`)
- Skill used for the E2E driver: `.agents/skills/lightfast-clerk/` (Backend API + `agent-browser` CLI)

## Recent Changes

**Committed since plan-Phase-3 close (HEAD at `85a4041f5`):** Phase 4 migration:
- `apps/app/src/app/(auth)/_components/session-activator.tsx` — 38 lines, migrated to `useAuthFlow.activate`

**Uncommitted in working tree:** none related to the bugs themselves. The session included a temporary debug spike on `use-auth-flow.ts` (window-exposed `__activateDebug` + a `signIn.create({strategy:'ticket'})` swap) — both reverted. `git diff apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` is empty.

**Plan file edited** (untracked, `thoughts/` is gitignored from PRs by convention):
- Annotated Phase 3 ticket-sign-up manual-review item with Bug B evidence
- Annotated Phase 4 valid-token manual-review item with Bug A evidence; marked invalid-token `[x]` with verification details

## Verification

| Check | Status | Notes |
|---|---|---|
| `pnpm --filter=@lightfast/app typecheck` | ✅ pass | post-revert, 2026-05-13 |
| `pnpm --filter=@lightfast/app test` | ✅ 150/150 | post-revert, 2026-05-13 |
| `pnpm check` (scoped to auth surface) | ✅ pass | 29 files clean |
| `pnpm check` (repo-wide) | ❌ fails | Unrelated WIP file `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs` flags `useForOf`. Not our refactor. |
| Phase 4 invalid-token manual | ✅ verified | a11y snapshot showed error UI + "Back to Sign In" link |
| Phase 4 valid-token manual | ❌ blocked | Bug A — see Debug Evidence |
| Phase 3 ticket sign-up OTP manual | ❌ blocked | Bug B — see Debug Evidence |
| Phase 3 sign-up OTP success manual | ⏭ skipped | Constraint C — waitlist mode blocks; allowlist API does not override |

## Debug Evidence

Primary block: **browser** (Clerk client-side JS + the `useAuthFlow` activate / init effects).

### Bug A — `signIn.ticket({ ticket })` silently no-ops on sign-in tokens

- **Entrypoint / repro:** mint a sign-in token via Backend API (`POST /v1/sign_in_tokens` with `{ user_id, expires_in_seconds: 600 }`), then visit `https://lightfast.localhost/sign-in?step=activate&token=<JWT>` in a clean browser profile.
- **Hook code path:** `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts:516-538` (`activate` effect) — calls `signIn.ticket({ ticket: ticketToken })` then checks `signIn.status === "complete"` and either finalizes or sets `setActivateError("Sign-in failed. Please try again.")`.
- **Observed behavior:** the call resolves with `{ error: null }`, but `signIn.status` stays at `"needs_identifier"` (the initial pre-sign-in state). The hook hits the `else` branch and renders the error UI within ~1s of mount. `window.Clerk.user` remains `null`.
- **Strongest evidence:** debug instrumentation captured at activate-time:
  ```
  { stage: "status-not-complete", status: "needs_identifier" }
  ```
- **Counter-evidence proving the ticket is valid:** direct eval of the legacy API surface returned `status: "complete"`:
  ```js
  await window.Clerk.client.signIn.create({ strategy: "ticket", ticket: "<same JWT>" })
  // → { status: "complete", id: "sia_...", supportedFirstFactors: null }
  ```
  So the ticket, the Clerk instance, and the user state are all fine — only the Future API's `signIn.ticket()` method fails.
- **Failed remediation spike:** swapped the hook to `signIn.create({ strategy: "ticket", ticket })` (the Future API equivalent of the working legacy call). Still failed inside the React hook context — Future API surface behaves differently from legacy even on the same shape. Reverted.
- **Next decisive check:** intercept Clerk FAPI network traffic during the activate effect to capture the raw `/v1/client/sign_ins` request + response. The console interceptor approach was tried but reset on page navigation. Use CDP (`agent-browser connect`) or instrument `window.fetch` _before_ the activate URL load (e.g., persist via service worker, or open `/sign-in` first then push-navigate with `history.pushState`).
- **Pre-refactor parity:** `git show HEAD:apps/app/src/app/(auth)/_components/session-activator.tsx` shows the original called `signIn.ticket({ ticket: token })` with the exact same shape. Refactor preserves the bug verbatim.

### Bug B — `signUp.create({ ticket, emailAddress, legalAccepted })` rejects with `form_identifier_exists`

- **Entrypoint / repro:** create an invitation via Backend API (`POST /v1/invitations` with `{ email_address: "jp+phase3-ticket-<ts>@jeevanpillay.com", redirect_url: "https://lightfast.localhost/sign-up", notify: false }`), extract the ticket JWT from the response's `url`, then drive `https://lightfast.localhost/sign-up?__clerk_ticket=<JWT>` via `agent-browser`. Fill the email textbox with the same email used in the invitation, click "Continue with Email". Server action redirects to `?step=code&email=...&ticket=...` correctly. OTPIsland renders with Clerk's "We sent a verification code to ..." heading.
- **Hook code path:** `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts` — init effect, sign-up + ticket branch:
  ```ts
  const { error: createError } = await signUp.create({
    ticket,
    emailAddress: email ?? undefined,
    legalAccepted: true,
  });
  ```
- **Observed behavior:** Clerk returns `form_identifier_exists`: *"This email address is already in use. Creating multiple accounts with the same email address is not allowed."* The hook captures this via `handleOtpClerkError` and sets `otpError`. CodeVerificationUI displays it as an inline error. No OTP email is sent.
- **Persisted truth (no actual user exists):** Clerk Backend API confirmed no user with the email exists:
  ```bash
  curl /v1/users?email_address=<ENCODED>
  # → []
  ```
  Only the pending invitation exists. The "in use" rejection is triggered by the invitation pre-claiming the email identifier.
- **Reproduced under clean conditions:** fresh email + fresh invitation + fresh `agent-browser` profile dir + `Clerk.signOut()` first. Same error.
- **Pre-refactor parity:** `git show HEAD:apps/app/src/app/(auth)/_components/otp-island.tsx | grep -A 5 'signUp.create'` confirms identical call shape pre-refactor. Bug predates refactor.
- **Suspected fix (not applied):** drop `emailAddress` from the params when `ticket` is set — the ticket's JWT encodes `email_address` in its payload, so Clerk derives it server-side. Recommended next step: verify against `https://clerk.com/docs/guides/development/custom-flows/authentication/application-invitations`, then either remove the redundant param or replace it with `strategy: 'ticket'` (which `SignUpFutureCreateParams` accepts per types).
- **Next decisive check:** spike the fix (drop `emailAddress`) in an isolated worktree, mint a fresh invitation, drive the flow, observe whether OTP email lands in Superhuman and whether `signUp.finalize` reaches `/account/welcome`.

### Constraint C — waitlist mode blocks non-ticket signups

- **Entrypoint / repro:** add `jp+phase3-otp-<ts>@jeevanpillay.com` to Clerk allowlist via `POST /v1/allowlist_identifiers`, drive `https://lightfast.localhost/sign-up` UI flow.
- **Observed:** server action correctly redirects to `?step=code&...`, OTPIsland's init effect calls `signUp.create({ emailAddress, legalAccepted })`, Clerk returns `sign_up_restricted_waitlist`, hook redirects to `/sign-up?errorCode=waitlist`. ErrorBanner renders the waitlist copy. **This is the intended behavior — the refactor's waitlist-block branch works correctly.**
- **Why allowlist didn't bypass:** Clerk's `allowlist_identifiers` only takes effect in *restrictions* mode. In *waitlist* mode, sign-ups must use the invitation/ticket flow. Independent knobs.
- **To unblock for verification only:** flip the Clerk dashboard waitlist setting off temporarily (out of scope without owner buy-in), or use a `+clerk_test@` test-mode address (different from user's preference for real emails).
- **Pre-refactor parity:** behavior is identical; refactor does not change waitlist logic.

## Learnings

- **Lightfast dev Clerk tenant:** waitlist mode is ON. Only path to a successful sign-up is via invitation tickets or `+clerk_test@` test-mode emails. Allowlist API does not bypass waitlist mode (only restrictions mode).
- **Clerk Future API surface diverges from legacy at runtime:** identical call shapes (e.g., `signIn.create({ strategy: "ticket", ticket })`) work via `window.Clerk.client.signIn.create(...)` but fail inside a React `useSignIn()`-bound proxy. This is an undocumented behavioral gap. Worth a Clerk support ticket.
- **`signIn.ticket()` Future API is broken for sign-in tokens (today).** Per `@clerk/shared@4.8.3` types it's typed as `(params?: SignInFutureTicketParams) => Promise<{ error: ClerkError | null }>` and the doc string says *"Used to perform a ticket-based sign-in"* — but in practice it returns `{ error: null }` without advancing state. Either it expects pre-priming via `signIn.create({...})`, only handles invitation tickets (not sign-in tokens), or is partially unimplemented.
- **`signUp.create()` with both `ticket` and `emailAddress` is a footgun.** When an invitation has been created for the email, Clerk treats the explicit `emailAddress` param as a conflict. Drop it; the ticket JWT carries the address.
- **`agent-browser` CLI is the right primitive** for driving these flows — accessibility-tree snapshots + `@refN` filling is reliable. Daemon reuse caveat: the second call ignores `--profile` flag (warns "daemon already running"). Use `agent-browser close` between profile changes.
- **Superhuman MCP is available** and reaches `jp@jeevanpillay.com` inbox — confirmed via `list_threads` filtered by Clerk senders. Not exercised this session because no OTPs were actually sent (both ticket flows failed pre-email).
- **`.agents/skills/lightfast-clerk/lib/clerk-backend.mjs`** wraps ensure-user / delete-user / mint-session-token. For magic-link tokens, use direct `curl` to `POST /v1/sign_in_tokens` (not in the wrapper). For invitations, use direct `curl` to `POST /v1/invitations`.
- **Toast surface is silently dropped** in auth flows — `(auth)/layout.tsx` does not mount `<Toaster />`. This is a separate pre-existing UX gap, already noted on Phase 3's "Resend" row. Not new.

## Artifacts

- **Plan:** `thoughts/shared/plans/2026-05-13-auth-unified-hook.md` — Phase 3 + Phase 4 manual-review rows updated with bug evidence
- **Hook (clean, no debug code):** `apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`
  - activate slice: `:500-543`
  - sign-up + ticket init branch: `:265-307`
- **Refactored Phase 4 component:** `apps/app/src/app/(auth)/_components/session-activator.tsx`
- **Clerk Backend wrapper:** `.agents/skills/lightfast-clerk/lib/clerk-backend.mjs`
- **Sign-in playbook (E2E recipe template):** `.agents/skills/lightfast-clerk/references/sign-in-playbook.md`
- **Future API types:** `node_modules/.pnpm/@clerk+shared@4.8.3_…/dist/types/index.d.ts` — `SignInFutureTicketParams` (`:2613`), `SignInFutureCreateParams` (`:2383`), `SignInFutureResource` (`:2724-2895`)
- **This handoff:** `thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md`

## Action Items & Next Steps

In priority order:

1. **Decide scope of the bug fixes.** Two options:
   - (a) File both bugs as separate follow-up plans, ship the refactor PR as-is (verifies the parts that work, preserves the buggy parts faithfully). Recommended given refactor's stated intent of "no behavior change."
   - (b) Fix Bug B in-flight (single-line change: drop `emailAddress` from `signUp.create` when `ticket` is set, plus update the `use-auth-flow.test.tsx` mock expectations). Lower-risk than Bug A.
2. **Spike Bug B fix in isolated worktree:**
   ```ts
   // apps/app/src/app/(auth)/_hooks/use-auth-flow.ts — sign-up + ticket branch
   const { error: createError } = await signUp.create({
     ticket,                       // remove `emailAddress` — JWT carries it
     legalAccepted: true,
   });
   ```
   Then re-run the E2E recipe in this handoff's Debug Evidence (Bug B). If OTP lands in Superhuman and verify succeeds, the fix is good.
3. **Investigate Bug A** via CDP-level network capture. Hypothesis to test first: `signIn.ticket()` in the Future API requires `signIn.create({ strategy: "ticket", ticket })` to prime the state first. If that's the case, the hook needs both calls.
4. **Resume Phase 5 of the plan** (cleanup & full-stack verification). With Bug A unfixed, Phase 5's "magic-link activate" smoke step is blocked — note that explicitly in the PR description.
5. **Open Clerk support ticket** documenting the Future API vs legacy divergence, attaching debug evidence from Bug A. Useful regardless of which fix path is chosen.

## Other Notes

- **Dev server state at handoff:** `pnpm dev` is running in the background (started by this session). PIDs in `lsof -i :443`. Log at `/tmp/lightfast-dev.log`. Kill with `pkill -f "next dev"` to clean.
- **Test artifacts cleaned:** Clerk test user `user_3DejiVOuZGrFO3SD1HV5a0jN4EO` deleted, allowlist identifier `alid_3DelCA53Kd5Rjt18bj1F4KO2Yyx` deleted, two test invitations revoked, all `.agent-browser/profiles/auth-*` directories removed, `/tmp/phase{3,4}-*` files removed.
- **`agent-browser` quirk:** the daemon persists across calls. After `close`, the next `open` may navigate to `about:blank` instead of the URL if the daemon is mid-restart — sleep 2-3s after `close` before re-opening, or always pass `--profile` on the very first invocation.
- **Email plus-addressing:** user prefers `jp+<random>@jeevanpillay.com` rather than `+clerk_test@` test-mode addresses. This means real emails *would* land in Superhuman if a flow actually sent one. Useful for future E2E once Bugs A/B are fixed.
- **Memory:** see `feedback_persistent_dirty_worktree.md` — pre-existing untracked files in the worktree are user's WIP, not Phase 4's work. The `pnpm check` failure on `write-auth-bin.mjs` is not our concern.
