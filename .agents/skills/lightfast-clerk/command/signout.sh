#!/usr/bin/env bash
# Sign out the current Clerk session for a profile (server-side invalidate).
# Profile dir + meta sidecar are kept — re-login is fast (cookies still cached).
# For a full disk-level wipe, use reset.sh.
#
# Usage:
#   signout.sh <profile>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || die "usage: signout.sh <profile>"

assert_safe_env
assert_profile_name "$PROFILE"

PROF_PATH="$(profile_dir "$PROFILE")"
if [[ ! -d "$PROF_PATH" ]]; then
  log "no profile dir for '$PROFILE' — nothing to sign out"
  exit 0
fi

# Open any authed page so window.Clerk loads. /sign-in redirects to
# /account/welcome when signed in, which exposes Clerk client.
ab "$PROFILE" open "$LIGHTFAST_CLERK_URL/sign-in" >/dev/null
sleep 1

# If we landed back on /sign-in, we were already signed out.
url=$(ab_eval_raw "$PROFILE" "location.href")
if [[ "$url" == *"/sign-in"* ]]; then
  log "already signed out (landed on $url)"
  ab "$PROFILE" close >/dev/null 2>&1 || true
  exit 0
fi

log "calling Clerk.signOut()"
ab "$PROFILE" eval "(async () => { await window.Clerk.signOut(); })()" >/dev/null

# Verify
sleep 1
ab "$PROFILE" open "$LIGHTFAST_CLERK_URL/sign-in" >/dev/null
sleep 1
final_url=$(ab_eval_raw "$PROFILE" "location.href")
ab "$PROFILE" close >/dev/null 2>&1 || true

if [[ "$final_url" == *"/sign-in"* ]]; then
  log "OK — signed out (now lands on $final_url)"
else
  die "signout reported success but still landing on $final_url"
fi
