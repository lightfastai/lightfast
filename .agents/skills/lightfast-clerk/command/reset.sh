#!/usr/bin/env bash
# Wipe a profile from disk. Closes browser sessions first, then removes the
# profile dir and meta sidecar. Does NOT delete the underlying Clerk user
# (use delete-user.sh for that).
#
# Usage:
#   reset.sh <profile>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || die "usage: reset.sh <profile>"
assert_profile_name "$PROFILE"

PROF_PATH="$(profile_dir "$PROFILE")"
META_PATH="$(profile_meta_path "$PROFILE")"

# Close any agent-browser sessions — releases Playwright user-data-dir lock.
agent-browser close --all >/dev/null 2>&1 || true

removed_any=0
if [[ -d "$PROF_PATH" ]]; then
  rm -rf "$PROF_PATH"
  log "removed profile dir: $PROF_PATH"
  removed_any=1
fi
if [[ -f "$META_PATH" ]]; then
  rm -f "$META_PATH"
  log "removed meta: $META_PATH"
  removed_any=1
fi
[[ "$removed_any" == "1" ]] || log "nothing to reset for '$PROFILE'"
log "OK"
