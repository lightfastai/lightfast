#!/usr/bin/env bash
# Sign in a Clerk test user via email + OTP 424242. Idempotent.
#
# Usage:
#   login.sh <profile> [email]
#
# Profile is a short name (a-z0-9_-). Email defaults to derive_test_email().
# On success: profile dir contains a Clerk session; <profile>.meta.json is written.
#
# Requires:
#   - dev server reachable at $LIGHTFAST_CLERK_URL (default http://localhost:3024)
#   - Clerk publishable key starts with pk_test_

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || die "usage: login.sh <profile> [email]"
EMAIL="${2:-$(derive_test_email)}"

assert_safe_env
assert_profile_name "$PROFILE"

# Email must be a Clerk test address — defense in depth against accidentally
# signing in a real user via this skill.
[[ "$EMAIL" == *"+clerk_test@"* ]] || die "email '$EMAIL' is not a Clerk test address (must contain '+clerk_test@')"

log "profile=$PROFILE email=$EMAIL url=$LIGHTFAST_CLERK_URL"

# --- Step 0: ensure the Clerk user exists (idempotent) ----------------------
# Sign-ups are waitlist-gated in this Lightfast tenant, so we can't UI-sign-up
# fresh users. Backend API bypasses the waitlist. Idempotent: returns existing
# user id if email already registered.

log "ensuring Clerk user exists"
PROVISIONED_USER_ID=$(node "$SCRIPT_DIR/../lib/clerk-backend.mjs" ensure-user "$EMAIL")
[[ -n "$PROVISIONED_USER_ID" ]] || die "ensure-user failed for $EMAIL"
log "user provisioned: $PROVISIONED_USER_ID"

# --- Idempotency check: load /sign-in. Signed-in users are redirected away
# (proxy.ts: "Auth routes: authenticated users → /account/welcome"). If we
# land on anything other than /sign-in, we're already signed in.

ab "$PROFILE" open "$LIGHTFAST_CLERK_URL/sign-in" >/dev/null
sleep 1
landing_url=$(ab_eval_raw "$PROFILE" "location.href")
if [[ "$landing_url" != *"/sign-in"* && -n "$landing_url" ]]; then
  log "already signed in (landed on $landing_url) — refreshing meta"
  # Wait briefly for Clerk to populate user object on the post-auth page.
  for _ in $(seq 1 20); do
    existing_user=$(ab_eval_raw "$PROFILE" "window.Clerk?.user?.id ?? ''")
    [[ -n "$existing_user" ]] && break
    sleep 0.5
  done
  if [[ -z "$existing_user" ]]; then
    # Fall back to the backend-provisioned id (Clerk JS slow to hydrate)
    existing_user="$PROVISIONED_USER_ID"
  fi
  meta_write "$PROFILE" "{ email: '$EMAIL', userId: '$existing_user', signedInAt: new Date().toISOString() }"
  ab "$PROFILE" close >/dev/null 2>&1 || true
  log "OK — signed in as user=$existing_user"
  exit 0
fi

# --- Sign-in flow -----------------------------------------------------------

log "navigating to /sign-in"
ab "$PROFILE" open "$LIGHTFAST_CLERK_URL/sign-in" >/dev/null

log "waiting for email input"
ab "$PROFILE" wait 'input[name=email]' >/dev/null

log "submitting email"
ab "$PROFILE" fill 'input[name=email]' "$EMAIL" >/dev/null
# The "Continue with Email" submit button is the only button on this form.
ab "$PROFILE" find role button click "Continue with Email" >/dev/null

log "waiting for OTP input"
# shadcn InputOTP renders a hidden input with data-input-otp. Wait for it.
for _ in $(seq 1 20); do
  ready=$(ab "$PROFILE" eval "!!document.querySelector('input[data-input-otp]')" 2>/dev/null || printf 'false')
  [[ "$ready" == "true" ]] && break
  sleep 0.5
done
[[ "$ready" == "true" ]] || die "OTP input did not appear within 10s"

log "typing OTP 424242"
# shadcn input-otp uses a controlled value via React onChange.
# `fill` dispatches a native input event → React state updates → auto-submits at length 6.
ab "$PROFILE" fill 'input[data-input-otp]' '424242' >/dev/null

log "waiting for sign-in to complete (redirect away from /sign-in)"
for _ in $(seq 1 30); do
  url=$(ab "$PROFILE" get url 2>/dev/null || printf '')
  [[ "$url" != *"/sign-in"* && -n "$url" ]] && break
  sleep 1
done
[[ "$url" != *"/sign-in"* ]] || die "still on /sign-in after 30s — verification likely failed (current url: $url)"
log "redirected to: $url"

# Wait for Clerk client to settle on the new page
for _ in $(seq 1 20); do
  loaded=$(ab "$PROFILE" eval "typeof window.Clerk !== 'undefined' && window.Clerk.loaded && !!window.Clerk.user" 2>/dev/null || printf 'false')
  [[ "$loaded" == "true" ]] && break
  sleep 0.5
done

USER_ID=$(ab_eval_raw "$PROFILE" "window.Clerk?.user?.id ?? ''")
[[ -n "$USER_ID" && "$USER_ID" != "null" ]] || die "could not read Clerk user id after sign-in"

meta_write "$PROFILE" "{ email: '$EMAIL', userId: '$USER_ID', signedInAt: new Date().toISOString() }"
ab "$PROFILE" close >/dev/null 2>&1 || true

log "OK — signed in as user=$USER_ID"
