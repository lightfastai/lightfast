#!/usr/bin/env bash
# Sign the desktop app in by minting a Clerk JWT (lightfast-clerk skill) and
# writing it to auth.bin via Electron's safeStorage. The desktop reads
# auth.bin at boot and starts in the signed-in state.
#
# Usage:
#   sign-in.sh                              # uses 'claude-default' profile
#   sign-in.sh <profile>                    # custom lightfast-clerk profile
#
# Idempotent: safe to re-run. Each run mints a fresh token, overwriting
# auth.bin with new ciphertext.
#
# Refuses if Electron is already running (the desktop only reads auth.bin
# once at startup — writing while it's running is a no-op until next launch).
#
# Composes:
#   - lightfast-clerk: provisions the test user + mints the JWT
#   - lib/write-auth-bin.mjs: encrypts the JWT with safeStorage
#
# Side effects:
#   - Writes ~/Library/Application Support/Lightfast Dev/auth.bin
#   - Writes a sidecar .lightfast-desktop-signin.meta.json beside it
#   - May provision a Clerk test user via lightfast-clerk's cold-start path

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

PROFILE="${1:-claude-default}"

assert_macos
assert_electron_present
assert_desktop_not_running

CLERK_SKILL="$LIGHTFAST_DSI_REPO_ROOT/.agents/skills/lightfast-clerk"
[[ -d "$CLERK_SKILL" ]] || die "missing lightfast-clerk skill at $CLERK_SKILL"

log "minting JWT via lightfast-clerk profile=$PROFILE"
JWT="$("$CLERK_SKILL/command/token.sh" "$PROFILE" lightfast-desktop 2>/dev/null | tr -d '\n')"
[[ -n "$JWT" ]] || die "token.sh returned empty token. Inspect: $CLERK_SKILL/command/status.sh $PROFILE"

# Pull the profile metadata back out of lightfast-clerk's sidecar so we can
# log who is now signed in.
USER_ID="$(node --input-type=module -e "
  import { readFileSync, existsSync } from 'node:fs';
  const p = '${LIGHTFAST_DSI_REPO_ROOT}/.agent-browser/profiles/${PROFILE}.meta.json';
  if (!existsSync(p)) process.exit(0);
  const m = JSON.parse(readFileSync(p, 'utf8'));
  if (m.userId) process.stdout.write(String(m.userId));
")"
EMAIL="$(node --input-type=module -e "
  import { readFileSync, existsSync } from 'node:fs';
  const p = '${LIGHTFAST_DSI_REPO_ROOT}/.agent-browser/profiles/${PROFILE}.meta.json';
  if (!existsSync(p)) process.exit(0);
  const m = JSON.parse(readFileSync(p, 'utf8'));
  if (m.email) process.stdout.write(String(m.email));
")"

log "writing auth.bin via Electron safeStorage (product='${LIGHTFAST_DSI_PRODUCT}')"
mkdir -p "$LIGHTFAST_DSI_USERDATA_DIR"

OUT_PATH="$(printf '%s' "$JWT" | "$LIGHTFAST_DSI_ELECTRON_BIN" \
  "$LIGHTFAST_DSI_SKILL_DIR/lib/write-auth-bin.mjs" \
  --product "$LIGHTFAST_DSI_PRODUCT" 2>&1 | tail -1)"

[[ -f "$LIGHTFAST_DSI_AUTH_BIN" ]] || die "expected auth.bin not found at $LIGHTFAST_DSI_AUTH_BIN (helper output: $OUT_PATH)"

meta_write_signin "$PROFILE" "${USER_ID:-}" "${EMAIL:-}"

log "signed in: profile=$PROFILE${USER_ID:+ user=$USER_ID}${EMAIL:+ email=$EMAIL}"
log "next: launch the desktop app — see lightfast-electron skill"
