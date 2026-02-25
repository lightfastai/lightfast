#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <plan-path>"
  echo "Example: $0 thoughts/shared/plans/2026-02-25-connection-manager-implementation.md"
  exit 1
fi

plan="$1"

if [ ! -f "$plan" ]; then
  echo "Error: Plan file not found: $plan"
  exit 1
fi

echo "Implementing: $plan"
echo "Started at $(date '+%H:%M:%S')..."

claude --permission-mode acceptEdits "/implement_plan $plan"
