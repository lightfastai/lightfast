#!/usr/bin/env bash
# Report the state of a lightfast-clerk profile. Backend-only — no browser.
#
# Usage:
#   status.sh <profile>           # human-readable to stdout
#   status.sh --json <profile>    # single-line JSON to stdout
#
# States:
#   UNKNOWN           no meta sidecar, no profile dir
#   GHOST             meta points to a userId that Clerk 404s (user deleted
#                     out-of-band; run reset.sh and re-provision)
#   PROVISIONED       meta + valid Clerk user, no browser profile dir
#                     (token.sh works; UI flows need a browser sign-in first)
#   SIGNED_IN_LOCAL   meta + valid user + profile dir + signedInAt
#                     (cookies are presumed live; escalate with your own
#                     browser probe if you need certainty)
#
# Exit: 0 on any known state, 1 on unexpected error.
#
# What this does NOT do: verify the browser cookie in the profile dir is still
# valid. That requires launching agent-browser, which is expensive and rare to
# actually need. Callers that must know run a probe themselves against the
# sign-in playbook (references/sign-in-playbook.md).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

JSON_OUTPUT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON_OUTPUT=1; shift ;;
    -h|--help)
      sed -nE '/^# /,/^[^#]/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    --) shift; break ;;
    -*) die "unknown option: $1" ;;
    *) break ;;
  esac
done

PROFILE="${1:-}"
[[ -n "$PROFILE" ]] || die "usage: status.sh [--json] <profile>"
assert_profile_name "$PROFILE"

META_PATH="$(profile_meta_path "$PROFILE")"
PROF_PATH="$(profile_dir "$PROFILE")"
USER_ID="$(meta_read "$PROFILE" userId)"
EMAIL="$(meta_read "$PROFILE" email)"
SIGNED_IN_AT="$(meta_read "$PROFILE" signedInAt)"

state="UNKNOWN"
user_exists=""
banned=""
locked=""

if [[ -z "$USER_ID" ]]; then
  # No meta → UNKNOWN, regardless of whether a stray profile dir exists.
  # A dir without meta means the profile is half-built (browser was opened but
  # sign-in never completed, or meta was lost). Callers should `reset.sh` and
  # start fresh.
  state="UNKNOWN"
else
  # Safety gate only fires when we're about to hit Clerk — UNKNOWN can answer
  # without env (useful for quick "is anything here?" checks in CI or scripts).
  assert_safe_env

  # Backend verification: is the stored userId still a real Clerk user?
  set +e
  user_json="$(node "$SCRIPT_DIR/../lib/clerk-backend.mjs" get-user "$USER_ID" 2>/dev/null)"
  rc=$?
  set -e

  case "$rc" in
    0)
      user_exists="true"
      banned="$(printf '%s' "$user_json" | node -e "const u=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(String(!!u.banned))")"
      locked="$(printf '%s' "$user_json" | node -e "const u=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(String(!!u.locked))")"
      if [[ -d "$PROF_PATH" && -n "$SIGNED_IN_AT" ]]; then
        state="SIGNED_IN_LOCAL"
      else
        state="PROVISIONED"
      fi
      ;;
    3)
      user_exists="false"
      state="GHOST"
      ;;
    *)
      die "clerk-backend get-user failed (exit $rc) for userId=$USER_ID"
      ;;
  esac
fi

if [[ "$JSON_OUTPUT" == "1" ]]; then
  node --input-type=module -e "
    const out = {
      state: '${state}',
      profile: '${PROFILE}',
      email: '${EMAIL}' || null,
      userId: '${USER_ID}' || null,
      signedInAt: '${SIGNED_IN_AT}' || null,
      userExists: '${user_exists}' === '' ? null : '${user_exists}' === 'true',
      banned: '${banned}' === '' ? null : '${banned}' === 'true',
      locked: '${locked}' === '' ? null : '${locked}' === 'true',
      profileDir: '${PROF_PATH}',
      metaPath: '${META_PATH}',
    };
    process.stdout.write(JSON.stringify(out));
  "
  printf '\n'
else
  printf 'state: %s\n' "$state"
  printf '  profile: %s\n' "$PROFILE"
  [[ -n "$EMAIL" ]]        && printf '  email: %s\n' "$EMAIL"
  [[ -n "$USER_ID" ]]      && printf '  userId: %s\n' "$USER_ID"
  [[ -n "$SIGNED_IN_AT" ]] && printf '  signedInAt: %s\n' "$SIGNED_IN_AT"
  [[ -n "$banned" ]]       && printf '  banned: %s\n' "$banned"
  [[ -n "$locked" ]]       && printf '  locked: %s\n' "$locked"
fi
