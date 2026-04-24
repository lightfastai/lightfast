#!/usr/bin/env bash
# Mint a Clerk session JWT for a profile. Backend-only — no browser needed.
#
# Usage:
#   token.sh <profile> [template]
#
# Stdout: a single JWT line (no decoration). Stderr: progress + errors.
# Exit codes:
#   0  ok
#   1  unexpected error (incl. "profile dir exists but meta missing" — fix by
#      finishing the sign-in playbook or resetting the profile)
#
# Cold-start behavior: if no meta and no profile dir, token.sh auto-provisions
# a Clerk user via derive_test_email (git config) or LIGHTFAST_CLERK_EMAIL,
# then writes meta. This is the fast path for "just give me a JWT."
#
# Why backend instead of browser eval:
#   - Faster (no browser process, no page load)
#   - Reliable (no React-state timing)
#   - Works for arbitrary JWT templates (browser eval depends on Clerk JS state)
# Browser sign-in (via references/sign-in-playbook.md) is still required if
# you need a persisted Clerk cookie for desktop renderer / BrowserWindow flows.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-}"
TEMPLATE="${2:-}"
[[ -n "$PROFILE" ]] || die "usage: token.sh <profile> [template]"

assert_safe_env
assert_profile_name "$PROFILE"

USER_ID="$(meta_read "$PROFILE" userId)"

if [[ -z "$USER_ID" ]]; then
  # No meta sidecar. Two cases:
  #  - Cold start (no profile dir): safe to auto-provision via derive_test_email.
  #  - Profile dir exists but meta is missing: inconsistent state. Refuse —
  #    auto-provisioning would silently bind this profile to the git user's
  #    email, which cross-contaminates with other profiles using the same
  #    derivation. Caller should reset or write meta explicitly.
  PROF_PATH="$(profile_dir "$PROFILE")"
  if [[ -d "$PROF_PATH" ]]; then
    die "profile '$PROFILE' has a browser dir but no meta. Either: (a) finish sign-in via references/sign-in-playbook.md and write meta with meta_write, or (b) run reset.sh '$PROFILE' to start over."
  fi
  EMAIL="${LIGHTFAST_CLERK_EMAIL:-$(derive_test_email)}"
  log "no profile meta found — provisioning user for $EMAIL"
  USER_ID=$(node "$SCRIPT_DIR/../lib/clerk-backend.mjs" ensure-user "$EMAIL")
  [[ -n "$USER_ID" ]] || die "ensure-user returned empty id"
  meta_write "$PROFILE" "{ email: '$EMAIL', userId: '$USER_ID', signedInAt: new Date().toISOString() }"
  log "provisioned user=$USER_ID (note: no browser session — drive references/sign-in-playbook.md if you need cookie persistence)"
fi

log "minting token for user=$USER_ID${TEMPLATE:+ template=$TEMPLATE}"
node "$SCRIPT_DIR/../lib/clerk-backend.mjs" mint-session-token "$USER_ID" "$TEMPLATE"
# trailing newline so consumers using $(token.sh) don't end up with weird trailing content
printf '\n'
