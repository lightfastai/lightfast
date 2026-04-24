#!/usr/bin/env bash
# Convenience wrapper: mint a JWT and curl a tRPC procedure.
#
# Usage:
#   curl.sh <profile> <procedure> [json-body]            # GET if no body
#   curl.sh <profile> <procedure> '{"foo":"bar"}'        # POST with JSON body
#   curl.sh -t <template> <profile> <procedure> [body]   # use a JWT template
#   curl.sh --raw <profile> <procedure> [body]           # skip tRPC batching
#
# By default, GET calls are wrapped in tRPC's batch=1 envelope:
#   /api/trpc/<procedure>?batch=1&input={"0":{"json":<body|null>}}
# Use --raw if you're calling a procedure that doesn't use batching.
#
# Output: response body to stdout, status to stderr.
# Exit: curl's exit code (0 on 2xx, non-zero otherwise — checked via http_code).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

TEMPLATE=""
RAW=0

# Parse leading flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--template) TEMPLATE="$2"; shift 2 ;;
    --raw) RAW=1; shift ;;
    -h|--help)
      sed -nE '/^# /,/^[^#]/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    --) shift; break ;;
    -*) die "unknown option: $1" ;;
    *) break ;;
  esac
done

PROFILE="${1:-}"; shift || true
PROCEDURE="${1:-}"; shift || true
BODY="${1:-}"
[[ -n "$PROFILE" && -n "$PROCEDURE" ]] || die "usage: curl.sh [-t template] [--raw] <profile> <procedure> [json-body]"

assert_safe_env

# Mint the JWT (token.sh writes log to stderr; we only capture stdout)
TOKEN="$("$SCRIPT_DIR/token.sh" "$PROFILE" "$TEMPLATE" 2>/dev/null | tr -d '\n')"
[[ -n "$TOKEN" ]] || die "token.sh returned empty token for profile '$PROFILE' (check its state: status.sh $PROFILE)"

URL="$LIGHTFAST_CLERK_URL/api/trpc/$PROCEDURE"
if [[ "$RAW" == "0" ]]; then
  # Wrap body in tRPC batch envelope
  if [[ -n "$BODY" ]]; then
    INPUT="{\"0\":{\"json\":$BODY}}"
  else
    INPUT='{"0":{"json":null}}'
  fi
  ENCODED_INPUT=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$INPUT")
  URL="${URL}?batch=1&input=${ENCODED_INPUT}"
fi

if [[ -n "$BODY" && "$RAW" == "0" ]]; then
  # Batched calls send input via query string for GET-shaped queries; mutations
  # use POST with the body in the request payload. Default to GET unless body
  # is set AND the user explicitly wants POST (--raw + body).
  METHOD="GET"
elif [[ -n "$BODY" ]]; then
  METHOD="POST"
else
  METHOD="GET"
fi

log "${METHOD} ${URL}  (token: ${TOKEN:0:20}...${TOKEN: -10})"

if [[ "$METHOD" == "POST" ]]; then
  curl -sS -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-trpc-source: lightfast-clerk-skill" \
    -H "Content-Type: application/json" \
    -d "$BODY" \
    -w "\n[HTTP %{http_code}]\n" \
    "$URL"
else
  curl -sS \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-trpc-source: lightfast-clerk-skill" \
    -w "\n[HTTP %{http_code}]\n" \
    "$URL"
fi
