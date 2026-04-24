#!/usr/bin/env bash
# Delete the Clerk user backing a profile (irreversible) AND wipe the profile
# dir from disk. Use this when you want a fully clean slate — e.g., after
# testing a fresh-signup flow.
#
# Usage:
#   delete-user.sh <profile>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || die "usage: delete-user.sh <profile>"

assert_safe_env
assert_profile_name "$PROFILE"

USER_ID="$(meta_read "$PROFILE" userId)"
if [[ -n "$USER_ID" ]]; then
  log "deleting Clerk user $USER_ID"
  node "$SCRIPT_DIR/../lib/clerk-backend.mjs" delete-user "$USER_ID"
  log "user deleted"
else
  log "no userId in meta — skipping Clerk delete"
fi

# Then wipe local profile state.
"$SCRIPT_DIR/reset.sh" "$PROFILE"
