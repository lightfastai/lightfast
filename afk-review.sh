#!/bin/bash

# afk-review.sh — Process CodeRabbit review findings continuously.
# Removes each finding from the file after processing, always grabs
# the first finding. Loops by default until all findings are done.
#
# Usage:
#   ./afk-review.sh <review-file>            # Process all findings (default)
#   ./afk-review.sh <review-file> --one      # Process just the first finding
#   ./afk-review.sh <review-file> --status   # Show remaining count
#   ./afk-review.sh <review-file> --skip     # Remove first finding without processing

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <review-file> [--status|--skip|--all]"
  exit 1
fi

REVIEW_FILE="$1"
ACTION="${2:-run}"

if [ ! -f "$REVIEW_FILE" ]; then
  echo "Error: Review file not found: $REVIEW_FILE"
  exit 1
fi

# ─── Helpers ─────────────────────────────────────────────────────────────────

# Count findings (each ==== line starts a finding block)
get_total() {
  grep -c '^====' "$REVIEW_FILE" || true
}

# Extract the first finding (content between 1st and 2nd ==== lines)
extract_first() {
  awk '
    /^====/ { delim++; next }
    delim == 1 { print }
  ' "$REVIEW_FILE"
}

# Remove the first finding from the file (keeps header + everything after 2nd ====)
remove_first() {
  local tmp
  tmp=$(mktemp)
  awk '
    /^====/ { delim++ }
    delim == 1 { next }
    { print }
  ' "$REVIEW_FILE" > "$tmp"
  mv "$tmp" "$REVIEW_FILE"
}

# ─── Commands ────────────────────────────────────────────────────────────────

TOTAL=$(get_total)

case "$ACTION" in
  --status)
    echo "Review: $REVIEW_FILE"
    echo "Remaining: $TOTAL findings"
    if [ "$TOTAL" -eq 0 ]; then
      echo "Status: ALL COMPLETE"
    else
      finding=$(extract_first)
      file_line=$(echo "$finding" | grep -m1 "^File:" || echo "unknown")
      type_line=$(echo "$finding" | grep -m1 "^Type:" || echo "unknown")
      echo "Next: $file_line | $type_line"
    fi
    exit 0
    ;;

  --skip)
    if [ "$TOTAL" -eq 0 ]; then
      echo "No findings to skip."
      exit 0
    fi
    remove_first
    echo "Skipped. $((TOTAL - 1)) remaining."
    exit 0
    ;;

  --one)
    RUN_ALL=false
    ;;

  run|*)
    RUN_ALL=true
    ;;
esac

if [ "$TOTAL" -eq 0 ]; then
  echo "All findings processed!"
  exit 0
fi

# ─── Processing ──────────────────────────────────────────────────────────────

TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT

process_first() {
  local finding
  finding=$(extract_first)

  if [ -z "$finding" ]; then
    echo "Error: Could not extract finding"
    return 1
  fi

  local remaining
  remaining=$(get_total)

  local file_line type_line comment_first
  file_line=$(echo "$finding" | grep -m1 "^File:" || echo "unknown")
  type_line=$(echo "$finding" | grep -m1 "^Type:" || echo "unknown")
  comment_first=$(echo "$finding" | grep -m1 -A1 "^Comment:" | tail -1 || echo "")

  echo ""
  echo "══════════════════════════════════════════════════════════════════════"
  echo "  $remaining remaining"
  echo "  $file_line"
  echo "  $type_line"
  echo "  $comment_first"
  echo "══════════════════════════════════════════════════════════════════════"
  echo "  Started at $(date '+%H:%M:%S')..."
  echo ""

  local prompt
  prompt="You are reviewing a CodeRabbit finding. Here is the full finding:

---
$finding
---

Instructions:
1. Read the referenced file(s) and verify the finding against the current code.
2. If the issue is valid and the code still has the problem, fix it.
3. If the code has already been fixed or the finding doesn't apply, skip it.
4. Commit your fix with a descriptive message if you made changes.
5. When done, output <promise>DONE</promise>.

IMPORTANT: Do NOT modify, read, or interact with any files under thoughts/ or thoughts/reviews/. Only work on the source code files referenced in the finding."

  script -q "$TMPFILE" claude --dangerously-skip-permissions -p "$prompt" || true

  echo "  Finished at $(date '+%H:%M:%S')."
  echo ""

  # Remove processed finding from the file
  remove_first

  if grep -q "<promise>DONE</promise>" "$TMPFILE"; then
    echo "  Processed. $(get_total) remaining."
  else
    echo "  Claude session ended without DONE signal."
    return 1
  fi

  return 0
}

if [ "$RUN_ALL" = true ]; then
  echo "Processing all $TOTAL findings"
  while [ "$(get_total)" -gt 0 ]; do
    process_first || {
      echo ""
      echo "Stopped. $(get_total) findings remaining."
      echo "Run again to retry or --skip to move on."
      exit 1
    }
  done
  echo ""
  echo "All findings processed!"
else
  process_first || exit 1
  remaining=$(get_total)
  if [ "$remaining" -eq 0 ]; then
    echo ""
    echo "All findings processed!"
  else
    echo ""
    echo "$remaining remaining. Run again or use default to process all."
  fi
fi
