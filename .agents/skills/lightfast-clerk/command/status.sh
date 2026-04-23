#!/usr/bin/env bash
# Report the state of a lightfast-clerk profile.
#
# Usage:
#   status.sh <profile>
#
# Prints one of (human-readable to stdout; machine-parseable with --json):
#   UNKNOWN              no meta sidecar, no profile dir
#   PROVISIONED          user exists in Clerk, no browser session
#   SIGNED_IN            user exists AND browser profile has a live Clerk session
#   SIGNED_OUT           profile exists but session was cleared
#
# Exit: 0 on any known state, 1 on error.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || die "usage: status.sh <profile>"
assert_profile_name "$PROFILE"

META_PATH="$(profile_meta_path "$PROFILE")"
PROF_PATH="$(profile_dir "$PROFILE")"
USER_ID="$(meta_read "$PROFILE" userId)"
EMAIL="$(meta_read "$PROFILE" email)"

# 1) No meta and no profile dir → UNKNOWN
if [[ -z "$USER_ID" && ! -d "$PROF_PATH" ]]; then
  printf 'state: UNKNOWN (profile=%s)\n' "$PROFILE"
  exit 0
fi

# 2) Only meta (provisioned, never browser-signed-in) → PROVISIONED
if [[ -n "$USER_ID" && ! -d "$PROF_PATH" ]]; then
  printf 'state: PROVISIONED\n  profile: %s\n  email: %s\n  userId: %s\n' \
    "$PROFILE" "$EMAIL" "$USER_ID"
  exit 0
fi

# 3) Has profile dir — probe browser for live session.
#    This is the slow path (~2-3s) because it spins up a browser.
assert_safe_env
ab "$PROFILE" open "$LIGHTFAST_CLERK_URL/sign-in" >/dev/null

# Poll URL until stable (cold-start daemons may report URL before the post-/sign-in
# redirect has resolved). Stable = same value across two reads, up to ~6s.
landing_url=""
prev_url=""
for _ in $(seq 1 12); do
  landing_url="$(ab_eval_raw "$PROFILE" "location.href")"
  if [[ -n "$landing_url" && "$landing_url" == "$prev_url" ]]; then
    break
  fi
  prev_url="$landing_url"
  sleep 0.5
done
ab "$PROFILE" close >/dev/null 2>&1 || true

if [[ "$landing_url" == *"/sign-in"* || -z "$landing_url" ]]; then
  state="SIGNED_OUT"
else
  state="SIGNED_IN"
fi

printf 'state: %s\n  profile: %s\n  email: %s\n  userId: %s\n  landingUrl: %s\n' \
  "$state" "$PROFILE" "$EMAIL" "$USER_ID" "$landing_url"
