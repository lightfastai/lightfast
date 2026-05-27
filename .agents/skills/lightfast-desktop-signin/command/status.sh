#!/usr/bin/env bash
# Report whether the desktop has a persisted native session file.
#
# Usage:
#   status.sh           # human-readable
#   status.sh --json    # single-line JSON
#
# Exit: 0 always (informational). Cannot decrypt auth.bin here; Electron's
# safeStorage owns that. This checks file presence only.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

JSON=0
if [[ "${1:-}" == "--json" ]]; then JSON=1; fi

state="SIGNED_OUT"
[[ -f "$LIGHTFAST_DSI_AUTH_BIN" ]] && state="SIGNED_IN"

DESKTOP_PID="$(pgrep -f 'Electron\.app/Contents/MacOS/Electron' | head -1 || true)"

if [[ "$JSON" == "1" ]]; then
  node --input-type=module -e "
    process.stdout.write(JSON.stringify({
      state: '${state}',
      userDataDir: '${LIGHTFAST_DSI_USERDATA_DIR}',
      authBin: '${LIGHTFAST_DSI_AUTH_BIN}',
      authBinExists: '${state}' === 'SIGNED_IN',
      desktopPid: '${DESKTOP_PID}' ? Number('${DESKTOP_PID}') : null,
    }) + '\n');
  "
else
  printf 'state: %s\n' "$state"
  printf '  userDataDir: %s\n' "$LIGHTFAST_DSI_USERDATA_DIR"
  printf '  authBin: %s\n' "$LIGHTFAST_DSI_AUTH_BIN"
  [[ -n "$DESKTOP_PID" ]] && printf '  desktopPid: %s\n' "$DESKTOP_PID"
fi
