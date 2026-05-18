#!/usr/bin/env bash
# Report whether the desktop is signed in (auth.bin present) and which
# lightfast-clerk profile/email/userId owns it.
#
# Usage:
#   status.sh           # human-readable
#   status.sh --json    # single-line JSON
#
# Exit: 0 always (informational). Cannot decrypt the token here — only
# Electron with the same keychain can do that. We only check file presence
# and our own sidecar.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

JSON=0
if [[ "${1:-}" == "--json" ]]; then JSON=1; fi

state="SIGNED_OUT"
[[ -f "$LIGHTFAST_DSI_AUTH_BIN" ]] && state="SIGNED_IN"

PROFILE="$(meta_read_signin profile)"
USER_ID="$(meta_read_signin userId)"
EMAIL="$(meta_read_signin email)"
WRITTEN_AT="$(meta_read_signin writtenAt)"

DESKTOP_PID="$(pgrep -f 'Electron\.app/Contents/MacOS/Electron' | head -1 || true)"

if [[ "$JSON" == "1" ]]; then
  node --input-type=module -e "
    process.stdout.write(JSON.stringify({
      state: '${state}',
      authBin: '${LIGHTFAST_DSI_AUTH_BIN}',
      authBinExists: '${state}' === 'SIGNED_IN',
      profile: '${PROFILE}' || null,
      userId: '${USER_ID}' || null,
      email: '${EMAIL}' || null,
      writtenAt: '${WRITTEN_AT}' || null,
      desktopPid: '${DESKTOP_PID}' ? Number('${DESKTOP_PID}') : null,
    }) + '\n');
  "
else
  printf 'state: %s\n' "$state"
  printf '  authBin: %s\n' "$LIGHTFAST_DSI_AUTH_BIN"
  [[ -n "$PROFILE" ]]    && printf '  profile: %s\n' "$PROFILE"
  [[ -n "$USER_ID" ]]    && printf '  userId: %s\n' "$USER_ID"
  [[ -n "$EMAIL" ]]      && printf '  email: %s\n' "$EMAIL"
  [[ -n "$WRITTEN_AT" ]] && printf '  writtenAt: %s\n' "$WRITTEN_AT"
  [[ -n "$DESKTOP_PID" ]] && printf '  desktopPid: %s\n' "$DESKTOP_PID"
fi
