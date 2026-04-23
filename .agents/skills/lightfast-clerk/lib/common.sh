#!/usr/bin/env bash
# Shared helpers for lightfast-clerk skill.
#
# All scripts source this. Contains:
#  - Safety guardrails (pk_test-only, localhost-only by default)
#  - Profile path resolution (per-repo under .agent-browser/)
#  - Default email derivation from git config
#  - Meta sidecar helpers (load/save user+org ids)
#
# Scripts should `set -euo pipefail` and then `source lib/common.sh`.

# Resolve repo root from the skill location (three levels up: lib/ -> skill/ -> skills/ -> .agents/)
LIGHTFAST_CLERK_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
export LIGHTFAST_CLERK_REPO_ROOT

LIGHTFAST_CLERK_PROFILES_DIR="${LIGHTFAST_CLERK_REPO_ROOT}/.agent-browser/profiles"
export LIGHTFAST_CLERK_PROFILES_DIR

# Default base URL. Override with LIGHTFAST_CLERK_URL.
LIGHTFAST_CLERK_URL="${LIGHTFAST_CLERK_URL:-http://localhost:3024}"
export LIGHTFAST_CLERK_URL

# --- logging ---------------------------------------------------------------

log()  { printf '[lightfast-clerk] %s\n' "$*" >&2; }
err()  { printf '[lightfast-clerk] ERROR: %s\n' "$*" >&2; }
die()  { err "$*"; exit 1; }

# --- safety ----------------------------------------------------------------

# Refuse if the configured Clerk publishable key is a live key.
# Refuse if target URL is not localhost unless explicitly overridden.
assert_safe_env() {
  local env_file="${LIGHTFAST_CLERK_REPO_ROOT}/apps/app/.vercel/.env.development.local"
  if [[ ! -f "$env_file" ]]; then
    die "missing env file: $env_file  (run 'vercel env pull' in apps/app?)"
  fi

  # Grep the publishable key line; strip quotes; first 8 chars must be pk_test_.
  local pk
  pk="$(grep -E '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' "$env_file" | head -n1 \
        | sed -E 's/^[^=]+=//; s/^"//; s/"$//')"
  if [[ -z "$pk" ]]; then
    die "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY not found in $env_file"
  fi
  if [[ "$pk" != pk_test_* ]]; then
    die "refusing to run against non-test Clerk key (starts with '${pk:0:8}'). This skill is dev-only."
  fi

  # URL guardrail
  if [[ "${LIGHTFAST_CLERK_URL}" != http://localhost:* && "${LIGHTFAST_CLERK_URL}" != http://127.0.0.1:* ]]; then
    if [[ "${LIGHTFAST_CLERK_I_KNOW_WHAT_IM_DOING:-0}" != "1" ]]; then
      die "LIGHTFAST_CLERK_URL='${LIGHTFAST_CLERK_URL}' is not localhost. Set LIGHTFAST_CLERK_I_KNOW_WHAT_IM_DOING=1 to override."
    fi
  fi
}

# Reject profile names that would escape the profiles dir or overwrite siblings.
assert_profile_name() {
  local name="$1"
  [[ -n "$name" ]] || die "profile name is required"
  [[ "$name" =~ ^[a-zA-Z0-9_-]+$ ]] || die "profile name must match [a-zA-Z0-9_-]+; got: $name"
}

profile_dir() {
  local name="$1"
  assert_profile_name "$name"
  printf '%s/%s' "$LIGHTFAST_CLERK_PROFILES_DIR" "$name"
}

profile_meta_path() {
  local name="$1"
  assert_profile_name "$name"
  printf '%s/%s.meta.json' "$LIGHTFAST_CLERK_PROFILES_DIR" "$name"
}

# --- email derivation ------------------------------------------------------

# Derive a test email from git config. Examples:
#   user.email = "jp@jeevanpillay.com"                       → "debug-jp-jeevanpillay-com+clerk_test@lightfast.ai"
#   user.email = "169354619+jeevanpillay@users.noreply.github.com" → "debug-jeevanpillay+clerk_test@lightfast.ai"
#
# Clerk test mode delivers nothing but requires "+clerk_test" suffix in the
# local-part. Using lightfast.ai as the domain keeps stray emails off the
# developer's personal inbox if test mode is ever bypassed.
#
# Override: export LIGHTFAST_CLERK_EMAIL=... to bypass git-derivation entirely.
derive_test_email() {
  if [[ -n "${LIGHTFAST_CLERK_EMAIL:-}" ]]; then
    printf '%s' "$LIGHTFAST_CLERK_EMAIL"
    return 0
  fi

  local git_email
  git_email="$(git -C "$LIGHTFAST_CLERK_REPO_ROOT" config user.email 2>/dev/null || true)"
  [[ -n "$git_email" ]] || die "git user.email not set. Set LIGHTFAST_CLERK_EMAIL or git user.email."

  # Special-case GitHub noreply: "<id>+<user>@users.noreply.github.com" or
  # "<user>@users.noreply.github.com" → use just <user>.
  local slug
  if [[ "$git_email" == *"@users.noreply.github.com" ]]; then
    local local_part="${git_email%@users.noreply.github.com}"
    # Strip leading "<id>+"
    slug="${local_part##*+}"
  else
    slug="$(printf '%s' "$git_email" \
      | tr '[:upper:]' '[:lower:]' \
      | sed -E 's/@/-/g; s/\./-/g; s/[^a-z0-9-]/-/g; s/-+/-/g; s/^-+//; s/-+$//')"
  fi
  [[ -n "$slug" ]] || die "could not derive slug from git email: $git_email"

  printf 'debug-%s+clerk_test@lightfast.ai' "$slug"
}

# --- meta sidecar ----------------------------------------------------------

# Write/merge fields into <profile>.meta.json. Uses node for safe JSON merging
# (jq isn't guaranteed installed on dev boxes). Keys that are null are deleted.
# Usage: meta_write <profile> <json-object>
meta_write() {
  local profile="$1"
  local patch="$2"
  local path
  path="$(profile_meta_path "$profile")"
  mkdir -p "$(dirname "$path")"
  node --input-type=module -e "
    import { readFileSync, writeFileSync, existsSync } from 'node:fs';
    const path = '${path}';
    const patch = ${patch};
    const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    const next = { ...current, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === null) delete next[k];
    writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  "
}

meta_read() {
  local profile="$1"
  local key="$2"
  local path
  path="$(profile_meta_path "$profile")"
  [[ -f "$path" ]] || { printf ''; return 0; }
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const m = JSON.parse(readFileSync('${path}', 'utf8'));
    const v = m['${key}'];
    if (v !== undefined && v !== null) process.stdout.write(String(v));
  "
}

# --- agent-browser wrapper -------------------------------------------------

# Run agent-browser bound to a profile, with consistent flags.
# The daemon emits a `--profile ignored: daemon already running` warning on
# every reuse — harmless but noisy. We swallow it but keep real errors.
# Usage: ab <profile> <args...>
ab() {
  local profile="$1"; shift
  local dir
  dir="$(profile_dir "$profile")"
  mkdir -p "$dir"
  agent-browser --profile "$dir" --session "lightfast-clerk-$profile" "$@" \
    2> >(grep -v -- '--profile ignored: daemon already running' >&2)
}

# Eval a JS expression and return the value as a raw string (no surrounding quotes).
# agent-browser eval emits JSON-encoded values; use this when you want the raw
# primitive (e.g., a userId, URL) without manual quote-stripping.
# Usage: ab_eval_raw <profile> <expr>
ab_eval_raw() {
  local profile="$1"; shift
  local expr="$1"
  local raw
  raw="$(ab "$profile" eval "$expr" 2>/dev/null || true)"
  # Strip a surrounding pair of double quotes (JSON string) if present.
  if [[ "$raw" =~ ^\".*\"$ ]]; then
    raw="${raw#\"}"; raw="${raw%\"}"
  fi
  printf '%s' "$raw"
}
