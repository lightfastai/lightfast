---
date: 2026-05-14
author: Jeevan Pillay (with Claude)
status: |
  Bug 1 (#8551): filed and open. Minimal repro confirmed.
  Bug 2 (#8552): filed 2026-05-14, self-closed same-day as premature — minimal repo
  does not reproduce the bfcache failure (Clerk re-hydrates cleanly there).
  Lightfast reproduces reliably but the differentiating ingredient was not
  isolated within time-box. To refile when a minimal repro is built.
filed_at: 2026-05-14
minimal_repro: https://github.com/jeevanpillay/clerk-bug-repros
related:
  - thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md
  - apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx
  - apps/app/src/app/(auth)/sso-callback/page.tsx
---

# Upstream Clerk bug reports — drafts

Two reports to file against `clerk/javascript`. Bug 1 is the load-bearing one; Bug 2 is the downstream symptom that lands on our auth pages because Bug 1 forces us off the documented API surface.

Both originally observed against `@clerk/clerk-js@6.8.0` (the version Clerk's CDN serves to our dev tenant by default) and **re-verified against `@clerk/clerk-js@6.10.1` on 2026-05-14 — both still present**. Override applied via `NEXT_PUBLIC_CLERK_JS_VERSION=6.10.1` env var to force the CDN to serve `clerk.browser.js@6.10.1`. `window.Clerk.version` confirmed `"6.10.1"` at runtime.

| Bug | 6.8.0 | 6.10.1 |
|---|---|---|
| 1. signUp.sso() 405 on ticket-bound resource | broken | broken |
| 2. Clerk.loaded false after bfcache restore on legacy authenticateWithRedirect | broken | broken |

---

## Bug 1 — `signUp.sso()` POSTs to collection URL after ticket-bound resource, returns 405

**Title:** `clerk-js@6.10.1: signUp.sso() POSTs to /v1/client/sign_ups instead of /v1/client/sign_ups/{id} after signUp.create({strategy:'ticket'}) → 405`

### Preliminary checks

- [x] Reviewed docs
- [x] Searched existing issues — closest is the `signIn.create({strategy:'ticket'})` family of issues (Future-API proxy out of sync with underlying client). Did not find an existing report on the `signUp` side.
- [x] Not previously raised via support/Discord

### Description

After `signUp.create({ strategy: 'ticket', ticket, legalAccepted: true })` returns successfully, calling `signUp.sso({ strategy, redirectCallbackUrl, redirectUrl, legalAccepted: true })` on the same resource issues `POST /v1/client/sign_ups?...&_method=PATCH` (the **collection** URL) instead of `PATCH /v1/client/sign_ups/{id}` (the **resource** URL). FAPI returns 405 Method Not Allowed.

The Future API surface returns no error to the caller; the promise resolves with `{ error: undefined }`. No IdP redirect happens. Any UI state tied to "set loading false on error" never fires — the button is left in its disabled/spinning state indefinitely.

Same family of bug as the documented `signIn.create({ strategy: 'ticket' })` Future-API-proxy/client mismatch, but on the `signUp` side and at the `.sso()` step rather than at `.create()`.

### Reproduction

1. Mint an invitation:
   ```js
   await clerk.backendAPI.invitations.createInvitation({
     emailAddress: 'testuser@example.com',
     redirectUrl: 'https://app.example.com/sign-up',
   });
   ```
   Capture the resulting ticket JWT.
2. Open `https://app.example.com/sign-up?__clerk_ticket=<jwt>` in a fresh profile.
3. Run:
   ```ts
   const { signUp } = useSignUp();
   await signUp.create({ strategy: 'ticket', ticket, legalAccepted: true });
   // ↑ 200 OK. status: 'missing_requirements',
   //   missingFields: ['legal_accepted', 'email_address']
   await signUp.sso({
     strategy: 'oauth_github',
     redirectCallbackUrl: '/sso-callback',
     redirectUrl: '/welcome',
     legalAccepted: true,
   });
   // ↑ 405. promise resolves with no error. no IdP redirect.
   ```
4. Observe the network panel:
   ```
   POST /v1/client/sign_ups?...               200 OK
   POST /v1/client/sign_ups?...&_method=PATCH 405 Method Not Allowed
   ```

Also reproduced via:
- `signUp.ticket({ ticket, legalAccepted: true })` followed by `signUp.sso({…})` — same 405.
- `signUp.sso({ strategy, ticket, … })` alone (no prior `.create`) — same 405.

### Hypothesis

`signUp.sso()` is not threading the in-flight resource's `id` into the request path. Looks like the Future-API proxy still references an empty `signUp` state at the time the URL is constructed, even though the underlying `clerk.client.signUp` has the resource ID populated.

### Workaround we shipped

Drop to the legacy API:

```ts
await clerk.client.signUp.authenticateWithRedirect({
  strategy,
  redirectUrl: `/sso-callback?__clerk_ticket=${encodeURIComponent(ticket)}`,
  redirectUrlComplete: '/welcome',
  continueSignUp: true,
  legalAccepted: true,
});
```

This sends the correct `PATCH /v1/client/sign_ups/{id}` and completes the IdP redirect.

Note: this workaround introduces Bug 2 below — `clerk.client.signUp.authenticateWithRedirect()` leaves Clerk's singleton in a state that's unrecoverable after bfcache restore.

### Environment

- `@clerk/clerk-js@6.10.1` (Core 3) — re-verified 2026-05-14 by forcing the runtime SDK via `NEXT_PUBLIC_CLERK_JS_VERSION=6.10.1`; `window.Clerk.version === "6.10.1"` confirmed in browser. Originally observed at 6.8.0 (the CDN's default for this tenant).
- `@clerk/nextjs@7.3.3`
- `@clerk/shared@4.10.2`
- Next.js App Router
- Chromium 124 + Safari 17 (browser-agnostic — it's an SDK URL-construction bug)
- Tenant: dev instance, `sign_up_mode` toggled across `waitlist` and `public` — identical behavior in both.

### 2026-05-14 re-verification trace at 6.10.1

```
window.Clerk.version === "6.10.1"  ✓
performance.getEntriesByType("resource").filter(e => e.name.includes("/sign_ups")):
  /v1/client/sign_ups?... → 200  (signUp.create({strategy:'ticket',…}))
  /v1/client/sign_ups?...&_method=PATCH → 405  (signUp.sso({strategy:'oauth_custom_test_idp',…}))
```

Identical to the 6.8.0 trace. UI freezes — OAuth button stays disabled, no error path, no IdP redirect.

---

## Bug 2 — `window.Clerk.loaded === false` after bfcache restore on pages that used `clerk.client.signUp.authenticateWithRedirect()`

**Title:** `clerk-js@6.10.1: Clerk singleton unrecoverable after bfcache restore on pages that called clerk.client.signUp.authenticateWithRedirect() pre-navigation`

### Preliminary checks

- [x] Reviewed docs
- [x] Searched existing issues — closest is #1584 (iOS-specific `isLoaded` stays false after refresh) and #7714 (the original `beforeunload` complaint that drove #7775). Neither describes this exact symptom.
- [x] Not previously raised

### Description

After PR #7775 / #7818 removed the `beforeunload` listener from `SafeLock` (intentionally — to restore bfcache eligibility for Clerk pages), a new failure mode appears on pages that called `clerk.client.signUp.authenticateWithRedirect(...)` immediately before navigating to an external IdP:

1. Page calls `signUp.create({ strategy: 'ticket', ticket })`, then `clerk.client.signUp.authenticateWithRedirect({ strategy, continueSignUp: true, legalAccepted: true, … })`. Browser navigates to IdP.
2. User clicks Back (or otherwise navigates back) before completing IdP auth.
3. Browser bfcache-restores the original page.
4. **Observed:** `window.Clerk.loaded === false` and `window.Clerk.client === undefined` persist for the lifetime of the restored page. They do not transition. React hook closures (`useSignUp`, `useSignIn`, `useClerk`) hold proxies pointing at the torn-down singleton.
5. **Result:** any user action (re-clicking the OAuth button, submitting the email form) silently no-ops. No error surfaces.

The bug is **asymmetric** across our auth pages:

| Page | OAuth API used | Affected? |
|---|---|---|
| `/sign-in` | `signIn.sso({strategy})` (Future) | No — Clerk restores cleanly |
| `/sign-up` (no ticket) | `signUp.sso({strategy, legalAccepted: true})` (Future) | No — Clerk restores cleanly |
| `/sign-up/accept-invitation` | `clerk.client.signUp.authenticateWithRedirect({continueSignUp:true, legalAccepted:true})` (legacy — workaround for Bug 1) | **Yes — singleton dies on bfcache restore** |

Pages on the Future API (`signIn.sso`/`signUp.sso`) are bfcache-eligible AND recover cleanly. The legacy `authenticateWithRedirect()` codepath specifically leaves something unrecoverable.

This pairs with Bug 1: anyone forced onto the legacy `authenticateWithRedirect()` workaround (which is the only way to do OAuth-with-ticket today) ends up exposed to this bfcache failure.

### Reproduction

Same setup as Bug 1's reproduction up through step 2. Then:

3. Click the OAuth button. App calls `signUp.create({strategy:'ticket', ticket, legalAccepted:true})` then `clerk.client.signUp.authenticateWithRedirect({strategy, continueSignUp:true, legalAccepted:true, …})`. Browser lands on the IdP consent page.
4. Click the browser Back button. Browser bfcache-restores the `/sign-up/accept-invitation` page (no fresh GET).
5. Open DevTools console, evaluate:
   ```js
   window.Clerk.loaded          // false
   window.Clerk.client          // undefined
   ```
6. Click the OAuth button again. The handler enters, `signUp` proxy is dead, no network request fires, button stays disabled. Same for the email/ticket submit path.

To confirm it's specifically the legacy codepath: change step 3 to `signUp.sso({strategy, legalAccepted: true})` (which fails with 405 per Bug 1, but DOES make the page bfcache-eligible after the failed call). On a `/sign-up` page where this works (no ticket), `window.Clerk.loaded` is `true` after restore.

### Workaround we shipped

Detect bfcache restore via `pageshow` event.persisted and force a hard reload:

```ts
React.useEffect(() => {
  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted) {
      window.location.reload();
    }
  };
  window.addEventListener('pageshow', onPageShow);
  return () => window.removeEventListener('pageshow', onPageShow);
}, []);
```

This defeats the bfcache-eligibility win from #7775 on this specific page.

### Environment

- `@clerk/clerk-js@6.10.1` (includes #7775) — re-verified 2026-05-14 by forcing the runtime SDK via `NEXT_PUBLIC_CLERK_JS_VERSION=6.10.1`. Originally observed at 6.8.0.
- `@clerk/nextjs@7.3.3`
- Next.js App Router
- Confirmed: Chromium 124+, WebKit (Safari 17)
- The pre-#7775 SDK never exhibited this because pages with Clerk were ineligible for bfcache entirely — restore couldn't happen. So this is a latent bug newly exposed by #7775, not a regression in #7775 itself.

### 2026-05-14 re-verification trace at 6.10.1

```
1. Open /sign-up/accept-invitation?__clerk_ticket=<jwt>
2. window.Clerk.loaded === true, window.Clerk.version === "6.10.1"  ✓
3. Click "Continue with Test IdP" → lands on IdP consent page  ✓
4. Browser Back → returns to /sign-up/accept-invitation  ✓
5. performance.getEntriesByType("navigation")[0].type === "back_forward"
6. Repeated polling at t+0s, t+5s, t+10s:
     window.Clerk.loaded     === false  ✗  (never recovers)
     window.Clerk.client     === undefined  ✗
     window.Clerk.client?.signUp === undefined
```

The page's React component still mounts (it has stale references), but every action that touches `signUp` / `clerk.client` is a silent no-op. Identical to the 6.8.0 behavior. Workaround (`pageshow` event.persisted → `window.location.reload()`) is the only known recovery.

### Suggested fix shape

Either:
- Have `clerk.client.signUp.authenticateWithRedirect()` register the same bfcache-aware cleanup-and-rehydrate path that the Future API uses, OR
- Make the Future API's `signUp.sso()` work correctly on ticket-bound resources (Bug 1), eliminating the need for the legacy path entirely. This is the preferred resolution.

---

## Posting outcome

- [x] Bug 1 filed → [clerk/javascript#8551](https://github.com/clerk/javascript/issues/8551). Minimal repro confirmed end-to-end at clerk-js@6.10.1. Open.
- [x] Bug 2 filed → [clerk/javascript#8552](https://github.com/clerk/javascript/issues/8552). **Self-closed same-day as premature** — verification of the linked minimal repro found the bug does NOT reproduce there (Clerk hydrates cleanly after bfcache restore on the bare repo). Lightfast still reproduces reliably. Differentiating ingredient was not isolated within the 30-min time-box (suspects: clerkMiddleware, MFE-proxy chain, HTTPS-cookie behavior).
- [x] Minimal repro published → [github.com/jeevanpillay/clerk-bug-repros](https://github.com/jeevanpillay/clerk-bug-repros). README updated to note Bug 1 is solid, Bug 2 page is exploratory.
- [x] Comment block in `apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx` updated to link only #8551 (the load-bearing root cause) and describe Bug 2 as an in-app-only observation pending isolation.

## Next steps

- Drop the bfcache `pageshow` reload workaround when #8551 closes — that eliminates the legacy `authenticateWithRedirect` path that Bug 2 surfaces on, so Bug 2 becomes moot regardless of whether it's ever filed.
- If #8551 stalls and the workaround becomes load-bearing for >2 months, time-box another 1–2 hours to isolate the Bug 2 trigger (try adding clerkMiddleware to the minimal repo first, then HTTPS via portless) and refile.
- Append both issue numbers (open + closed) to `thoughts/shared/handoffs/general/2026-05-13_15-37-19_auth-clerk-latent-bugs.md` ledger.
