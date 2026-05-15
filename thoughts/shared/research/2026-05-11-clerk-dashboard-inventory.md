# Clerk dev tenant inventory — 2026-05-11

Read-only audit of the dev Clerk instance backing local Lightfast (`apps/app`).
Purpose: establish the authoritative "what is enabled, what is not" snapshot
before planning the auth UX / harness rebuild. No settings were modified.

## 1. Credentials & wiring

- Env file: `apps/app/.vercel/.env.development.local`
  - `CLERK_SECRET_KEY` = `sk_test_R…` (test instance, dev-safe)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_test_Y2hhcm1lZC1zaGFyay01Mi5jbGVyay5hY2NvdW50cy5kZXYk`
  - Decoded Frontend API host: `charmed-shark-52.clerk.accounts.dev`
- Env schema: `apps/app/src/env.ts` extends `clerkEnvBase` from `vendor/clerk/src/env.ts`:
  - `CLERK_SECRET_KEY` must start with `sk_`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` must start with `pk_`
  - No other Clerk env vars in the schema.
- ClerkProvider (`apps/app/src/app/layout.tsx:68-76`) configures only the
  redirect URLs (`/sign-in`, `/sign-up`, `/early-access`,
  `signInFallbackRedirectUrl=/account/welcome`); no Clerk feature flags are
  set from code.

## 2. Backend API findings (`https://api.clerk.com/v1/...`)

All requests authenticated with the dev `sk_test_` key.

### `GET /instance`

```json
{
  "id": "ins_33UPJBWgqyHb8Ptt6mIJKoBs2BB",
  "object": "instance",
  "environment_type": "development",
  "allowed_origins": null
}
```

- Dev instance. No allowed-origin restrictions configured at the instance
  level — Clerk will admit any origin for the dev tenant.

### `GET /instance/restrictions`

Empty body (HTTP 200, 0 bytes). The instance-level "sign-up restrictions"
endpoint returns nothing for this tenant. The real, populated
restrictions live in the Frontend API `/v1/environment` payload (below):

```json
"restrictions": {
  "allowlist": { "enabled": false },
  "blocklist": { "enabled": false },
  "allowlist_blocklist_disabled_on_sign_in": { "enabled": true },
  "block_email_subaddresses": { "enabled": true },
  "block_disposable_email_domains": { "enabled": false }
}
```

- **No allowlist / blocklist.**
- **`block_email_subaddresses=true`** → `jp+foo@…` style aliases are rejected
  at sign-up. That bites the harness: the natural pattern of minting
  `jp+clerk-test-N@lightfast.ai` users is blocked. Confirmed against the
  waitlist data — `jp+clerk-waitlist-test-1@lightfast.ai` ended up in the
  `rejected` state.
- Disposable-domain blocking is **off**.

### `GET /jwt_templates`

```json
[
  {
    "id": "jtmp_3CkpqSviO4Fc7G18hmbGAc4UxIj",
    "name": "lightfast-desktop",
    "claims": { "org_id": "{{org.id}}" },
    "lifetime": 3600,
    "signing_algorithm": "RS256"
  }
]
```

- The `lightfast-desktop` JWT template **exists** and is the only template.
- Claims contain **only `org_id`**. There is no `org_slug`,
  `lastActiveOrgId`, `org_role`, `email`, or any custom user metadata.
- Lifetime 3600 s, RS256. No custom signing key.

### `GET /users?limit=10` and `GET /users/count`

```json
{ "data": [], "total_count": 0 } // /users
{ "object": "total_count", "total_count": 0 } // /users/count
```

- **Dev tenant is fully empty of users.** The research's "empty tenant"
  claim is confirmed.

### `GET /waitlist_entries?limit=10` (`total_count=4`)

| email                                       | status      | invitation                       |
| ------------------------------------------- | ----------- | -------------------------------- |
| `jp+clerk-waitlist-test-1@lightfast.ai`     | rejected    | revoked invitation present       |
| `jp@lightfast.ai`                           | completed   | accepted invitation              |
| `jeevan.pillay8@gmail.com`                  | rejected    | revoked invitation               |
| `jp@jeevanpillay.com`                       | completed   | no invitation                    |

- Waitlist mode is **active** (see `sign_up.mode = "waitlist"` below) — the
  product uses the Clerk waitlist as the gate.
- Two completed entries, two rejected. No live invitations.
- Note: the only user-related rows are the waitlist; `/users` is empty even
  though two entries are "completed", because the dev tenant has been
  reset / had its users wiped after waitlist completion.

### `GET /organizations`, `GET /organization_invitations`, `GET /sessions?status=active`

All three: `{"data":[],"total_count":0}`.

- No orgs exist.
- No outstanding invitations.
- No active sessions.

### `GET /domains`

```json
[{
  "id": "dmn_33UPJ6NjdLxQxFYeu3RKQ5jIWQB",
  "name": "charmed.shark-52.lcl.dev",
  "is_satellite": false,
  "is_provider_domain": false,
  "frontend_api_url": "https://charmed-shark-52.clerk.accounts.dev",
  "accounts_portal_url": "https://charmed-shark-52.accounts.dev",
  "development_origin": "http://localhost:3024"
}]
```

- Single dev domain, primary, no satellites.
- `development_origin` is **pinned to `http://localhost:3024`** (the legacy
  app port). This is meaningful: in the portless aggregate world the app is
  served at `https://app.lightfast.localhost` and ports vary per worktree.
  The harness will need to either accept that the Clerk dashboard URL
  defaults point at `localhost:3024` (used only by Clerk-hosted screens) or
  configure satellite domains.

### `GET /saml_connections`, `GET /oauth_applications`, `GET /sign_in_tokens`

- SAML: `{"data":[],"total_count":0}` — no SAML connections.
- OAuth applications (i.e. Clerk-hosted OAuth provider clients exposed to
  third parties): `{"data":[],"total_count":0}` — none.
- `/sign_in_tokens` requires `user_id` or `client_id` — listing is not
  supported by the API. (Not blocking: sign-in tokens are issued on demand
  for dev users.)

### `GET /instance/organization_settings`

```json
{
  "enabled": true,
  "max_allowed_memberships": 5,
  "max_allowed_roles": 10,
  "max_allowed_permissions": 0,
  "creator_role": "org:admin",
  "admin_delete_enabled": true,
  "domains_enabled": false,
  "slug_disabled": false,
  "force_organization_selection": true,
  "organization_creation_defaults": {
    "enabled": false,
    "automatic_organization_creation": { "enabled": false },
    "detect_from_email_domain": { "enabled": false }
  }
}
```

- Organizations **enabled**, 5 memberships max per org (dev limit).
- **`force_organization_selection=true`** — Clerk will insert a
  `choose-organization` session task whenever a user has > 0 orgs. This is
  what drives the `/account/welcome` → org-pick flow.
- Auto-org-on-sign-up is **off** — orgs are only ever created explicitly via
  the `clerk.organizations.createOrganization` call in
  `api/app/src/router/user/organization.ts:74`.

### `GET /redirect_urls`

Empty `[]`. No allowlisted redirect URLs configured at the instance level.

## 3. Frontend API findings (`/v1/environment`)

This is the canonical source of truth for the user-facing auth surface —
what flows the dashboard has actually turned on. Pulled
`https://charmed-shark-52.clerk.accounts.dev/v1/environment` unauthenticated.

### Identification and factors

```json
"identification_requirements": [["email_address","oauth_github"],[]],
"identification_strategies":   ["email_address","oauth_github"],
"first_factors":               ["email_code","oauth_github","ticket"],
"second_factors":              []
```

- Sign-in identifies via **email_address or GitHub OAuth**.
- First-factor strategies: **email_code (OTP), oauth_github, ticket**
  (invitation/sign-in token).
- **No second factor enforced.** `sign_in.second_factor.required = false`.

### Attributes and sign-up

```json
"email_address": { "enabled": true, "required": true,
                   "used_for_first_factor": true, "first_factors": ["email_code"],
                   "verifications": ["email_code"], "verify_at_sign_up": true },
"first_name":    { "enabled": true, "required": false },
"last_name":     { "enabled": true, "required": false },
"username":      { "enabled": false },
"phone_number":  { "enabled": false },
"password":      { "enabled": false },  // ← passwords are OFF
"passkey":       { "enabled": false },
"authenticator_app": { "enabled": false },
"ticket":        { "enabled": true }    // invitation tickets accepted

"sign_up": {
  "mode": "waitlist",                    // ← waitlist gate active
  "captcha_enabled": false,
  "progressive": true,
  "legal_consent_enabled": true,         // ← legal_accepted required
  "custom_action_required": false,
  "mfa": { "required": false }
}
```

- **Sign-up mode = `waitlist`.** The research claim is confirmed: a public
  sign-up posts to the waitlist; only invited users (via ticket) can
  complete a real sign-up.
- **Passwords disabled instance-wide.** First factor is email OTP only.
  Anything calling `signIn.create({ strategy: "password", … })` will return
  `strategy_invalid` / `form_param_unknown_attribute`.
- **`legal_consent_enabled = true`** — sign-up requires `legal_accepted`
  on the `SignUp` resource. The OAuth callback's `continueSignUpUrl` fires
  if a user GitHub-OAuths without a waitlist invitation, because Clerk
  forces sign-up completion and the user has no waitlist entry.
- **`first_name` / `last_name` enabled but not required.**
- Captcha is **off** in dev.
- `progressive: true` — sign-up supports incremental field collection.

### Social providers

```json
"social": {
  "oauth_github": { "enabled": true, "authenticatable": true, "name": "GitHub" },
  "oauth_google": { "enabled": false, "authenticatable": false }
}
```

- **Only GitHub OAuth is enabled.** Google is configured but disabled
  (`enabled: false`). All other social providers absent.
- Matches the research's "only GitHub" finding.

### Password / passkey / enterprise SSO

```json
"password_settings": { ...all booleans false / lengths 0 },
"passkey_settings":  { "allow_autofill": true, "show_sign_in_button": true },
"saml":               { "enabled": false },
"enterprise_sso":     { "enabled": false, "self_serve_sso": false }
```

- Password settings exist but are inert because `attributes.password.enabled=false`.
- Passkeys configured but disabled at the attribute level.
- SAML and Enterprise SSO **off**.

### Attack protection (matches research's `too_many_requests` / `user_locked`)

```json
"attack_protection": {
  "user_lockout": { "enabled": true, "max_attempts": 100, "duration_in_minutes": 60 },
  "pii":          { "enabled": true },
  "email_link":   { "require_same_client": true },
  "enumeration_protection": { "enabled": false }
}
```

- **User lockout: 100 attempts / 60 minutes.** This is what produces the
  `user_locked` error code the early-access action handles
  (`apps/app/src/app/(early-access)/_actions/early-access.ts:263`). 100
  attempts is generous for humans but **a busy test harness can blow past
  it in a single run** — keep the lockout window in mind when designing
  the rebuild.
- Rate limiting (the `too_many_requests` / 429 path the same file handles
  at line 247) is not in `auth_config`; it is enforced at Clerk's edge
  globally, not configurable per-tenant.
- **`enumeration_protection.enabled=false`** — Clerk will return
  `identifier_not_found` directly. The harness can rely on this to detect
  unregistered emails.
- `email_link.require_same_client=true` — magic links must be opened in the
  same browser/device that initiated sign-in. (Not used today; relevant if
  we ever swap OTP for magic links.)

### Display config (relevant defaults)

```json
"home_url":         "http://localhost:3024/",
"sign_in_url":      "http://localhost:3024/sign-in",
"sign_up_url":      "http://localhost:3024/sign-up",
"waitlist_url":     "http://localhost:3024/early-access",
"after_sign_in_url":"http://localhost:3024",
"after_sign_up_url":"http://localhost:3024",
"preferred_sign_in_strategy": "otp",
"branded": false,
"clerk_js_version": "5"
```

- All redirect URL defaults still point at the legacy `localhost:3024`
  origin. They're shadowed by the in-code `ClerkProvider` props
  (`signInUrl`, `signUpUrl`, `waitlistUrl`) on the app side, but anything
  triggered from Clerk-hosted screens (the Accounts portal, email links)
  will navigate back to `localhost:3024`.

### Other observed flags

- `auth_config.test_mode = true`, `cookieless_dev = true`,
  `single_session_mode = true`, `reverification = true`,
  `url_based_session_syncing = true`.
- `organization_settings.force_organization_selection = true` (also above).
- `fraud_settings.native.device_attestation_mode = "disabled"`.
- `commerce_settings.billing.enabled = false`.
- `api_keys_settings.enabled = false` (Clerk's own user-API-keys feature is
  off; this is unrelated to our `orgApiKeys` table).

## 4. Source code surface relevant to dashboard state

- `apps/app/src/app/layout.tsx:68-76` — ClerkProvider props.
  `waitlistUrl="/early-access"` is wired explicitly, consistent with
  `sign_up.mode = "waitlist"`.
- `apps/app/src/app/(auth)/sign-in/page.tsx` — server-rendered shell with
  three steps (`email` → `code` → `activate`). Code path assumes
  email-OTP only as the first factor, GitHub as the alternative; there is
  no password input. This matches `first_factors = ["email_code",
  "oauth_github", "ticket"]`.
- `apps/app/src/app/(auth)/sign-in/sso-callback/page.tsx:18` —
  `continueSignUpUrl="/sign-in?errorCode=account_not_found"`. With waitlist
  mode + `legal_consent_enabled`, an unregistered GitHub OAuth callback
  always trips this URL.
- `apps/app/src/app/(early-access)/_actions/early-access.ts:196-200` —
  `clerk.waitlistEntries.create({ emailAddress })` is the only way the
  product writes to Clerk during sign-up; the catch block specifically
  handles `email_address_exists`, `form_identifier_exists`,
  `too_many_requests`, `rate_limit_exceeded`, `user_locked`, mirroring the
  dashboard's attack-protection / waitlist semantics.
- `api/app/src/router/user/organization.ts:74` — only place orgs are
  created. Consistent with `automatic_organization_creation.enabled =
  false`.
- `vendor/clerk/src/env.ts:5-21` — only two Clerk env vars exist; no
  optional template name, JWT issuer, or domain override.
- No `taskUrls` are configured at the ClerkProvider call site. Clerk's
  session-task system is in play (`force_organization_selection=true`
  injects a `choose-organization` task) but the app relies on the default
  redirect (`signInFallbackRedirectUrl=/account/welcome`) plus an
  in-app router to resolve it. A future harness can pass `taskUrls={{
  "choose-organization": "/account/welcome" }}` explicitly if we want to
  centralise this.

## 5. Implications for the auth harness rebuild

1. **Waitlist mode is on.** Any harness flow that "creates a new user" via
   the public sign-up endpoint will hit the waitlist gate. The harness
   must either:
   - Provision users via `/v1/users` (Backend API) and skip the public
     flow entirely, or
   - Create a waitlist entry, then mint an invitation ticket and consume
     it.
   The empty `/users` collection plus 4 waitlist entries says the team has
   been doing path (b) manually so far.

2. **`block_email_subaddresses=true` is hostile to the obvious test
   pattern.** `jp+test-1@…` aliases are rejected. Either:
   - Disable that flag in the dev dashboard before standing up the
     harness, or
   - Use distinct domains / mailboxes (e.g. dedicated catch-all on
     `lightfast.dev`) for harness users.

3. **GitHub is the only social provider.** OAuth-only harness flows need
   to drive `strategy: "oauth_github"` exclusively. No Google/Microsoft
   fallback exists.

4. **No passwords, ever.** First-factor is email OTP. The harness must
   intercept the OTP delivery — either:
   - Use Clerk's "test mode" reserved email `+clerk_test` pattern (which
     accepts any 6-digit code starting with `424242` etc., but conflicts
     with `block_email_subaddresses=true` — must lift that block first), or
   - Provision users with `skip_password_checks` + Backend API
     `createUser` and skip the OTP entirely, then issue a sign-in token.

5. **JWT template `lightfast-desktop` exists but is thin.** It carries
   only `org_id`. If the desktop / harness needs `org_slug`,
   `lastActiveOrgId`, or `email`, those claims must be added to the
   template. The research's reference to `lastActiveOrgId` is **not**
   present today.

6. **Lockout: 100 attempts / 60 minutes.** Acceptable for human dev work
   but easy to trip during a noisy test harness loop. Either bump the
   threshold in the dashboard or build cooldown / circuit-breaker
   semantics into the harness.

7. **`force_organization_selection=true` means every signed-in session
   without an org will land on the `choose-organization` task.** The
   harness's "fresh user" flow has to provision an org (Backend API
   `createOrganization`, see `api/app/src/router/user/organization.ts:74`)
   immediately after user creation, otherwise tRPC calls under
   `orgScopedProcedure` will fail with no active org.

8. **`continueSignUpUrl` is wired to a generic error page.** OAuth users
   without a waitlist invitation get bounced to
   `/sign-in?errorCode=account_not_found`. For a clean harness UX we
   should either:
   - Auto-create a waitlist invitation on first GitHub OAuth, or
   - Provide a dev-only "skip waitlist" path (Backend API).

9. **No `allowed_origins`, no satellite domains, no SAML.** Greenfield —
   nothing to migrate.

## 6. Settings to consider toggling before the harness lands

(Read-only audit; the actual flip should happen after we agree on the
harness plan.)

- `restrictions.block_email_subaddresses` → **off** in dev so
  `jp+harness-N@…` works.
- `attack_protection.user_lockout.max_attempts` → bump to 1000 in dev (or
  disable user lockout entirely on the test instance).
- `social.oauth_google.enabled` → flip on if we want a non-GitHub OAuth
  path in tests.
- `jwt_templates.lightfast-desktop.claims` → add `org_slug`, `email`,
  `lastActiveOrgId` if downstream code expects them.
- Optional: `sign_up.mode` → `public` on a dedicated "harness" dev
  instance, so harness-only signups skip the waitlist entirely.

## Update — 2026-05-14

- `api_keys_settings.enabled` flipped **on** in the dev tenant via the
  Clerk Dashboard (Configure → API Keys). There is no `clerk enable
  api-keys` CLI subcommand and `api_keys_settings` is not exposed in
  `npx clerk config schema` — the toggle is Dashboard-only.
- Verification:

  ```bash
  $ npx clerk api GET '/api_keys?subject=org_3Dhc40yosdcumyEcFW9rsybErIi'
  { "data": [], "total_count": 0 }
  ```

  (Disabled response was `{ "errors": [{ "code": "feature_not_enabled", ... }] }`.)
- Test minted/cleaned during Phase 2 verification:
  `ak_bcf4741cec00cea9934bfb824264b53b` (phase2-smoke-test) and
  `ak_f2b2fc4192db40c087629346353a1336` (revoke-test) — both deleted via
  `DELETE /api_keys/<id>`.
- Production tenant gets the same flip in the rollout PR — record here
  when applied.
