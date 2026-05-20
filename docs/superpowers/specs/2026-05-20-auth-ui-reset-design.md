# Auth UI Reset Design

## Goal

Reimplement the custom auth UI under `apps/app/src/app/(auth)` using Clerk's current Core 3 custom-flow APIs, remove stale invitation and OAuth workarounds, and upgrade Clerk patch versions. This reset does not change ClerkProvider, middleware, protected app routes, API auth, tRPC auth, desktop auth handoff, or the `/early-access` waitlist action.

## Architecture

The auth surface remains a small set of client pages backed by Clerk hooks:

- `/sign-in`: email-code sign-in and OAuth sign-in.
- `/sign-up`: email-code sign-up and OAuth sign-up, gated by legal acceptance and Clerk captcha.
- `/sign-up/accept-invitation`: application invitation acceptance through Clerk's ticket strategy.
- `/sso-callback`: one OAuth callback state walker for sign-in, sign-up, transfer, existing-session, and error branches.
- `/sign-up/continue`: finalizes sign-up after OAuth transfer when only `legal_accepted` is missing.

Shared helpers stay local to `(auth)`:

- `auth-errors.ts`: normalizes Clerk API errors into URL codes, inline messages, success, or redirects.
- `auth-navigate.ts`: centralizes `finalize()` and `setActive()` navigation, always using `decorateUrl()`.
- `search-params.ts`: owns public error-code query params and display copy.

## Flow Decisions

Email sign-in calls `signIn.emailCode.sendCode({ emailAddress })`. If Clerk reports that no user can sign in with that identifier, the page redirects to `/sign-in?errorCode=account_not_found`, whose banner sends the user to `/early-access`.

Email sign-up calls `signUp.create({ emailAddress, legalAccepted: true })`, sends an email code, verifies the code, then finalizes. Waitlist-restricted Clerk errors route to `/sign-up?errorCode=waitlist`.

OAuth sign-in/sign-up call `signIn.sso()` or `signUp.sso()` with `/sso-callback` and `/account/welcome`. The callback handles transferable resources instead of each page doing callback-specific work.

Invitation acceptance requires `__clerk_ticket`. Missing tickets render a no-invitation state. Accepting the invitation consumes the ticket with `clerk.client.signUp.create({ strategy: "ticket", ticket, legalAccepted: true })`, activates the returned session, routes waitlist errors back to the same invitation URL, and renders ticket-expired errors inline. OAuth-with-ticket is removed because the current official application-invitation custom-flow docs only document ticket acceptance, not OAuth ticket binding.

Session-task pages are not added in this boundary because they require ClerkProvider task URLs and middleware allowances outside `(auth)`. The finalize helper does route Clerk's `choose-organization` task to `/account/welcome`, because that route is already pending-session-allowed and owns Lightfast's organization onboarding. A follow-up should add dedicated task routes for Clerk's `TaskResetPassword` and `TaskSetupMFA` components if those dashboard features are enabled.

## Testing

Update the current Vitest/Testing Library auth page tests first. The key red tests are:

- sign-in unknown-account errors show the waitlist CTA.
- invitation acceptance uses Clerk's ticket strategy and never uses the legacy `authenticateWithRedirect()` OAuth workaround.
- callback transfer and existing-session branches still finalize to `/account/welcome`.
- captcha containers remain mounted for sign-up, invitation, callback, and continuation flows.

Run focused auth tests first, then the app typecheck/build path after the Clerk upgrade.

## Clerk Upgrade

Upgrade catalog pins to the latest npm versions verified on 2026-05-20:

- `@clerk/nextjs`: `7.3.7`
- `@clerk/backend`: `3.4.11`
- `@clerk/shared`: `4.12.2`

Regenerate `pnpm-lock.yaml` through pnpm instead of manual lockfile edits.
