#!/usr/bin/env bash
# Shared helpers for lightfast-desktop-signin skill.
#
# All scripts source this. Contains:
#  - Repo + skill path resolution
#  - The dev-mode userData product name
#  - Logging helpers
#
# Scripts should `set -euo pipefail` and then `source lib/common.sh`.

# Resolve repo root: lib/ -> skill/ -> skills/ -> .agents/ -> repo
LIGHTFAST_DSI_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
export LIGHTFAST_DSI_REPO_ROOT

# The dev product name MUST match apps/desktop/src/main/bootstrap.ts:
#   const productName = app.isPackaged ? "Lightfast" : "Lightfast Dev";
LIGHTFAST_DSI_PRODUCT="${LIGHTFAST_DSI_PRODUCT:-Lightfast Dev}"
export LIGHTFAST_DSI_PRODUCT

# Where the desktop reads auth.bin from at boot.
LIGHTFAST_DSI_USERDATA_DIR="$HOME/Library/Application Support/${LIGHTFAST_DSI_PRODUCT}"
LIGHTFAST_DSI_AUTH_BIN="${LIGHTFAST_DSI_USERDATA_DIR}/auth.bin"
export LIGHTFAST_DSI_USERDATA_DIR LIGHTFAST_DSI_AUTH_BIN

# Old token-writing versions of this skill created this sidecar. Keep the path
# only so sign-out can remove stale metadata while deleting auth.bin.
LIGHTFAST_DSI_META="${LIGHTFAST_DSI_USERDATA_DIR}/.lightfast-desktop-signin.meta.json"
export LIGHTFAST_DSI_META

# --- logging ---------------------------------------------------------------

log()  { printf '[lightfast-desktop-signin] %s\n' "$*" >&2; }
err()  { printf '[lightfast-desktop-signin] ERROR: %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

# --- preconditions ---------------------------------------------------------

assert_macos() {
  case "$(uname -s)" in
    Darwin) ;;
    *) die "this local auth.bin helper is macOS-only." ;;
  esac
}
