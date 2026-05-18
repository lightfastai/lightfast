#!/usr/bin/env bash
# Shared helpers for lightfast-desktop-signin skill.
#
# All scripts source this. Contains:
#  - Repo + skill path resolution
#  - Discovery of the Electron binary (apps/desktop/node_modules)
#  - The dev-mode userData product name
#  - safeStorage prerequisite check (macOS keychain)
#  - Logging helpers
#
# Scripts should `set -euo pipefail` and then `source lib/common.sh`.

# Resolve repo root: lib/ -> skill/ -> skills/ -> .agents/ -> repo
LIGHTFAST_DSI_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
export LIGHTFAST_DSI_REPO_ROOT

LIGHTFAST_DSI_SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export LIGHTFAST_DSI_SKILL_DIR

# The dev product name MUST match apps/desktop/src/main/bootstrap.ts:
#   const productName = app.isPackaged ? "Lightfast" : "Lightfast Dev";
LIGHTFAST_DSI_PRODUCT="${LIGHTFAST_DSI_PRODUCT:-Lightfast Dev}"
export LIGHTFAST_DSI_PRODUCT

# Where the desktop reads auth.bin from at boot.
LIGHTFAST_DSI_USERDATA_DIR="$HOME/Library/Application Support/${LIGHTFAST_DSI_PRODUCT}"
LIGHTFAST_DSI_AUTH_BIN="${LIGHTFAST_DSI_USERDATA_DIR}/auth.bin"
export LIGHTFAST_DSI_USERDATA_DIR LIGHTFAST_DSI_AUTH_BIN

# Sidecar tracks who we wrote the file as. The desktop app does not need this;
# it's purely so this skill can answer "what profile is currently signed in?".
LIGHTFAST_DSI_META="${LIGHTFAST_DSI_USERDATA_DIR}/.lightfast-desktop-signin.meta.json"
export LIGHTFAST_DSI_META

LIGHTFAST_DSI_ELECTRON_BIN="${LIGHTFAST_DSI_REPO_ROOT}/apps/desktop/node_modules/.bin/electron"
export LIGHTFAST_DSI_ELECTRON_BIN

# --- logging ---------------------------------------------------------------

log()  { printf '[lightfast-desktop-signin] %s\n' "$*" >&2; }
err()  { printf '[lightfast-desktop-signin] ERROR: %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

# --- preconditions ---------------------------------------------------------

assert_macos() {
  case "$(uname -s)" in
    Darwin) ;;
    *) die "this skill is macOS-only (safeStorage flow). On Linux use the OAuth flow instead." ;;
  esac
}

assert_electron_present() {
  [[ -x "$LIGHTFAST_DSI_ELECTRON_BIN" ]] \
    || die "missing Electron binary at ${LIGHTFAST_DSI_ELECTRON_BIN}. Run 'pnpm install' from the repo root."
}

# Refuse to run while the desktop app is running. safeStorage writes are still
# safe (different processes, OS-level keychain), but the desktop only reads
# auth.bin once at module-load time — writing while it's up means our token
# won't take effect until next launch, which is confusing.
assert_desktop_not_running() {
  if pgrep -f 'Electron\.app/Contents/MacOS/Electron' >/dev/null 2>&1; then
    die "an Electron app is already running. Stop it first (lightfast-electron skill: pkill -f electron-forge && pkill -f 'Electron\\.app')."
  fi
}

# --- meta sidecar ----------------------------------------------------------

meta_write_signin() {
  local profile="$1"
  local user_id="$2"
  local email="$3"
  mkdir -p "$LIGHTFAST_DSI_USERDATA_DIR"
  node --input-type=module -e "
    import { writeFileSync } from 'node:fs';
    const meta = {
      profile: '${profile}',
      userId: '${user_id}',
      email: '${email}',
      writtenAt: new Date().toISOString(),
      writtenBy: 'lightfast-desktop-signin',
    };
    writeFileSync('${LIGHTFAST_DSI_META}', JSON.stringify(meta, null, 2) + '\n');
  "
}

meta_read_signin() {
  local key="$1"
  [[ -f "$LIGHTFAST_DSI_META" ]] || { printf ''; return 0; }
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const m = JSON.parse(readFileSync('${LIGHTFAST_DSI_META}', 'utf8'));
    const v = m['${key}'];
    if (v !== undefined && v !== null) process.stdout.write(String(v));
  "
}
