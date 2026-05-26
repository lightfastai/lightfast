#!/usr/bin/env bash
# Remove the persisted native session so the desktop boots signed out.
# Idempotent.
#
# Usage:
#   sign-out.sh
#
# Does NOT touch:
#   - The desktop process (it must be restarted to pick up the change —
#     native-auth/store.ts keeps the loaded session in memory)

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
