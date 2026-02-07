---
name: arch-eval
description: Run architecture evaluation pipeline
user_invocable: true
---

# Architecture Evaluation

Run the architecture evaluation pipeline to analyze boundary integrity, dependency health, build efficiency, and type safety across the Lightfast monorepo.

## Usage

- `/arch-eval` — Run full evaluation pipeline
- `/arch-eval --quick` — Run dependency-cruiser + turbo boundaries only
- `/arch-eval --compare` — Compare with last run

## Steps

1. Run `pnpm arch-eval` (or with flags as specified)
2. Read the generated markdown summary from `thoughts/shared/evaluations/summaries/`
3. Present findings to the user, grouped by tier
4. For Tier 1 (critical) findings, suggest immediate fixes
5. For Tier 2 (important) findings, suggest using `/create_plan` to plan fixes
6. Note the signal ratio and compare with previous runs if available
