#!/usr/bin/env bash
# Remove auth.bin so the desktop boots in the signed-out state. Idempotent.
#
# Usage:
#   sign-out.sh
#
# Does NOT touch:
#   - The Clerk user (use lightfast-clerk's delete-user.sh)
#   - The lightfast-clerk profile dir (use lightfast-clerk's reset.sh)
#   - The desktop process (it must be restarted to pick up the change —
#     auth-store.ts only re-reads on launch)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

assert_macos

removed=0
if [[ -f "$LIGHTFAST_DSI_AUTH_BIN" ]]; then
  rm -f "$LIGHTFAST_DSI_AUTH_BIN"
  log "removed: $LIGHTFAST_DSI_AUTH_BIN"
  removed=1
fi
if [[ -f "$LIGHTFAST_DSI_META" ]]; then
  rm -f "$LIGHTFAST_DSI_META"
  log "removed: $LIGHTFAST_DSI_META"
  removed=1
fi
[[ "$removed" == "1" ]] || log "nothing to remove (already signed out)"

if pgrep -f 'Electron\.app/Contents/MacOS/Electron' >/dev/null 2>&1; then
  log "note: an Electron app is running. It will not pick up the change until restarted."
fi

log "OK"
