#!/bin/bash

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <plan-path> <iterations>"
  echo "Example: $0 thoughts/shared/plans/2026-02-25-connection-manager-implementation.md 10"
  exit 1
fi

plan="$1"
iterations="$2"

if [ ! -f "$plan" ]; then
  echo "Error: Plan file not found: $plan"
  exit 1
fi

TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT

echo "Implementing: $plan"
echo "Max iterations: $iterations"
echo ""

for ((i=1; i<=$iterations; i++)); do
  echo "--- Iteration $i/$iterations ---"
  echo "  Started at $(date '+%H:%M:%S')..."

  script -q "$TMPFILE" claude --dangerously-skip-permissions -p \
    "/implement_plan $plan
    Execute ALL phases consecutively without pausing for manual verification.
    After completing all automated verification for a phase, proceed to the next.
    Commit your changes after each phase.
    If all phases are complete, output <promise>COMPLETE</promise>." || true

  echo "  Finished at $(date '+%H:%M:%S')."
  echo ""
  cat "$TMPFILE"
  echo ""

  # Stop if manual verification is needed
  if grep -q "Ready for Manual Verification" "$TMPFILE"; then
    echo ""
    echo "Paused for manual verification after $i iterations."
    echo "Review the plan file for manual verification steps."
    exit 0
  fi

  # Stop if plan is fully complete
  if grep -q "<promise>COMPLETE</promise>" "$TMPFILE"; then
    echo ""
    echo "Plan complete after $i iterations."
    exit 0
  fi
done

echo ""
echo "Reached max iterations ($iterations). Check plan progress."
