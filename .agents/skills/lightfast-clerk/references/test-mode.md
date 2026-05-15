# Clerk test mode primer

This skill relies on Clerk's [test mode](https://clerk.com/docs/testing/test-emails-and-phones)
to fully automate sign-in. Test mode is enabled implicitly by using `pk_test_` /
`sk_test_` keys.

## What test mode does

### 1. Test email pattern

Email addresses matching this regex are treated as test addresses:
```
^.+\+clerk_test@.+$
```

Examples:
- `debug-jp+clerk_test@lightfast.ai` ✅
- `claude+clerk_test@example.com` ✅
- `jp+clerk_test_v2@anything.com` ❌ (must end in `+clerk_test`, not contain it)

For test addresses:
- **No real email is sent.** The OTP code is fixed.
- **Always use code `424242`** to verify.

### 2. Test phone pattern

`+15555550100` through `+15555550199` are test phone numbers. Code `424242`
verifies. Not used by this skill.

### 3. Backend-API user creation

`POST /v1/users` works without OTP / waitlist friction. The skill uses this
(`clerk-backend.mjs ensure-user`) to provision users that the UI sign-up flow
would otherwise reject (e.g., when the Clerk dashboard has waitlist mode on).

## Why this matters for Lightfast

Lightfast's dev Clerk tenant has **waitlist mode enabled** — fresh users can
sign up but the OTP step returns `sign_up_restricted_waitlist`. The skill
sidesteps this by:

1. Backend API creates the user (bypasses waitlist)
2. Browser drives `/sign-in` with the now-existing email + 424242 (works because
   test mode treats `+clerk_test@` emails specially)

Without backend provisioning, only invited users can complete sign-up. The
skill makes that requirement transparent.

## When NOT to use this

`+clerk_test@` skips real delivery — useful for fast/automated runs, but
useless when you need to verify the actual email *contents*, the URL
Clerk embeds in a magic link, or the OTP digits Clerk generates. For
those, see [`real-email-testing.md`](real-email-testing.md), which
documents the plus-addressing pattern that triggers real delivery into
your own inbox.

| You need | Use |
|---|---|
| Fast, repeatable sign-in for tRPC/auth scaffolding | `+clerk_test@` (this doc) |
| Verify the actual email body / URL / OTP digits | real-email-testing.md |
| Verify invitation/ticket sign-up end to end | real-email-testing.md |
| Reproduce waitlist gating against a fresh email | real-email-testing.md |

## Reading

- Clerk Testing docs: https://clerk.com/docs/testing/test-emails-and-phones
- Clerk Backend API reference: https://clerk.com/docs/reference/backend-api
- The skill's wrapper: `.agents/skills/lightfast-clerk/lib/clerk-backend.mjs`
- Companion doc: [`real-email-testing.md`](real-email-testing.md)
