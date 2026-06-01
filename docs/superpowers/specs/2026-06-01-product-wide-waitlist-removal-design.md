# Product-Wide Waitlist Removal Design

## Goal

Remove Lightfast's waitlist as a product concept and as a Clerk integration.
After this change, public visitors can start at `/sign-up`, existing users can
sign in at `/sign-in`, and old `/early-access` links permanently redirect to
sign-up without preserving old waitlist query parameters.

This is a product-wide change. It covers the custom auth route group under
`apps/app/src/app/(auth)`, the retired early-access route, Clerk provider
configuration, auth error handling, app and marketing CTAs, tests, and the
operational Clerk Dashboard setting.

## Current State

The waitlist appears in four places:

- `apps/app/src/app/layout.tsx` passes `waitlistUrl="/early-access"` to
  `ClerkProvider`.
- `apps/app/src/app/(auth)` treats Clerk's
  `sign_up_restricted_waitlist` error as a first-class `waitlist` auth error
  code and renders a waitlist CTA.
- `apps/app/src/app/(early-access)` collects early-access form data and writes
  to `clerk.waitlistEntries.create`.
- `apps/www` has navigation, footer, landing, FAQ, and use-case CTAs that point
  to `/early-access`.

Clerk's current waitlist docs make the dashboard setting part of the behavior:
Waitlist mode must be enabled in the Clerk Dashboard, and `waitlistUrl` routes
users to the waitlist page. The backend waitlist API remains available, but
Lightfast should stop using it.

## Product Decisions

Public CTAs that previously said "Join Early Access" or "Join the Waitlist"
become "Get started" and link to `/sign-up`.

The old `/early-access` URL permanently redirects to `/sign-up`. It should not
serve a retired waitlist page and should not 404, because older public links may
still exist. The redirect should strip all old query parameters such as
`email`, `success`, or validation state.

The `(auth)` layout header is contextual auth navigation:

- On `/sign-in`, show `Sign up` linking to `/sign-up`.
- On `/sign-up` and `/sign-up/accept-invitation`, show `Log in` linking to
  `/sign-in`.

Invitation acceptance remains in scope. It is a Clerk ticket flow for invited
users and is not part of the public waitlist.

The release is not complete until Clerk Waitlist mode is disabled in every
environment that uses this app. Code removal and Dashboard configuration are
both required for the product behavior to change.

## Auth Rewrite Shape

The auth rewrite keeps the current custom Clerk email-code flows but removes
waitlist-specific branches from every layer.

`auth-errors.ts` should no longer expose a `waitlist` error code. The
`sign_up_restricted_waitlist` Clerk error should be treated as a configuration
problem, because seeing it after this change means Clerk Waitlist mode is still
enabled. The user-facing result should be a generic authentication failure in
production. Tests can assert the mapping no longer creates a waitlist route.
The application should log or track this branch as a configuration error when a
logging hook is available, but it should not render a waitlist recovery path.

`search-params.ts` should retain only active product auth error codes. The known
code needed after removal is `account_not_found`, with copy that sends users
toward account creation instead of waitlist access:

> We couldn't find a Lightfast account for that email. Create an account to
> continue.

`ErrorBanner` should become a general auth error banner. For
`account_not_found`, its primary action should link to `/sign-up`; for dynamic
inline errors, the action should remain "Try again" back to the current auth
page.

The contextual auth header should be implemented as a small client component
inside `(auth)`, because it needs the current pathname. The server layout should
keep the logo, legal links, and centered content structure.

The sign-in page should gain a form-local footer matching the existing sign-up
footer:

- `/sign-in`: "Don't have an account? Sign up"
- `/sign-up`: keep "Already have an account? Log in"

Use `Sign up` for auth-context account creation actions. Use `Get started` only
for public marketing CTAs.

## Early Access Route

Replace the early-access route implementation with a proxy-level permanent
redirect in `apps/app/src/proxy.ts`:

- `/early-access` and nested early-access paths redirect permanently to
  `/sign-up`.
- Redirects strip old waitlist query parameters instead of forwarding them.
- The early-access form action, form components, search-param helpers, confetti
  success state, and route error UI are deleted if no other route imports them.
- Tests for early-access form submission and Clerk waitlist entry creation are
  removed or replaced with redirect coverage.

Do not implement this as a rewrite. A rewrite would keep `/early-access` in the
browser while rendering sign-up, which is the wrong product and SEO signal.
Do not implement this in `next.config.ts` redirects, because Next config
redirects preserve incoming query parameters.

Remove `/early-access(.*)` from `PUBLIC_ROUTE_PATTERNS`; the legacy URL is
owned by an explicit redirect branch, not by a public route allowlist.

## Marketing Surface

Replace `/early-access` links in `apps/www` with `/sign-up` through the
microfrontend link mechanism where cross-zone navigation is already used.

Update copy from early-access language to launch/open language:

- "Join Early Access" -> "Get started"
- "Join the Early Access waitlist" -> "Get started"
- "Early Access" nav entries should be removed or replaced with a sign-up CTA,
  not kept as a navigation destination.

Keep `Get started` as a button or CTA, not as a normal navigation item. The
marketing navigation should remain content-oriented, such as pricing and docs.

Rename stale code identifiers that carry product meaning, such as
`WaitlistCTA`, to current names such as `GetStartedCTA`.

Sitemap entries for `/early-access` should be removed. Reserved-name entries for
`early-access` can remain, because preserving reserved slugs prevents workspace
or organization names from colliding with historical public URLs.

Historical or internal-only references are not in scope unless they affect live
product behavior. The pitch-deck copy that mentions future waitlist targets can
remain in this change.

## Clerk Operational Requirement

Disable Waitlist mode in Clerk Dashboard for every Lightfast environment that
uses this auth app. The code change removes Lightfast's waitlist URL and SDK
usage, but Clerk can still reject sign-ups with `sign_up_restricted_waitlist`
while Dashboard Waitlist mode remains enabled.

Success requires both the code change and the Clerk Dashboard setting change.
Roll out by disabling Waitlist mode in development and staging first, verifying
`/sign-up`, and then disabling it in production before or at the same time as
the code deploy.

If Redis contains historical `early-access:emails` data, this implementation
does not migrate, export, or delete it. The app should stop reading and writing
that key. Data cleanup is an operational task outside this code change.

## Testing

Focused app tests should cover:

- `authErrorCodes` no longer includes `waitlist`.
- Clerk waitlist-restriction errors do not map to `errorCode=waitlist`.
- Sign-in unknown-account errors render a sign-up action, not a waitlist action.
- Sign-up and invitation errors never render waitlist copy.
- `(auth)` header shows `Sign up` on `/sign-in` and `Log in` on sign-up routes.
- `/early-access` and nested paths redirect with status `308` to `/sign-up`
  without forwarding query parameters.
- `ClerkProvider` is configured without `waitlistUrl`.

Marketing tests, if present for affected components, should assert `Get started`
copy and `/sign-up` targets.

Existing early-access form/action tests should be deleted or replaced; they
should not continue to mock `clerk.waitlistEntries.create`.

After focused tests, run the app typecheck/build path because this change
deletes route modules and removes exported auth error values.

## Non-Goals

- No change to Clerk session, organization, or billing integration.
- No change to protected app routing, tRPC auth, API auth, or native OAuth.
- No replacement lead-capture store for early-access submissions.
- No migration, export, or deletion of historical Redis early-access data.
- No deletion of invitation acceptance.
- No pricing or onboarding redesign beyond replacing waitlist CTAs with
  sign-up CTAs.
- No rewrite-based `/early-access` compatibility route.
- No `next.config.ts` redirect for `/early-access`, because that would preserve
  incoming query parameters.
- No pitch-deck narrative cleanup.

## Success Criteria

- No runtime path imports, renders, or writes to Clerk waitlist APIs.
- No `waitlistUrl` is passed to `ClerkProvider`.
- No auth URL supports `errorCode=waitlist` as a product state.
- `/early-access` permanently redirects to `/sign-up` through the proxy, strips
  old query parameters, and is no longer proxy-public allowlisted.
- Public marketing CTAs use "Get started" and link to `/sign-up`.
- The `(auth)` header uses contextual `Sign up` / `Log in` navigation.
- The sign-in page includes a form-local sign-up recovery link.
- Clerk Waitlist mode is disabled operationally outside the repository.
