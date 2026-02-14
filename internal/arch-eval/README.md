# Architecture Evaluation Pipeline

Automated architecture boundary enforcement, dependency health checks, and code quality monitoring for the Lightfast monorepo.

## Quick Start

```bash
# Run full evaluation
pnpm arch-eval

# Run quick mode (skip knip + turbo-summary)
pnpm arch-eval -- --quick

# Run with comparison to previous run
pnpm arch-eval -- --compare

# Run individual checks
pnpm lint:deps      # dependency-cruiser only
pnpm lint:unused    # knip only
```

## What It Does

The pipeline evaluates the monorepo across 4 dimensions:

1. **Boundary Integrity** - Enforces layered architecture (apps → api → packages → vendor → db)
2. **Dependency Health** - Detects unused dependencies, files, and exports
3. **Build Efficiency** - Monitors Turbo cache hit rates and build times
4. **Type Safety** - Checks for missing strict mode and excessive `any` usage

### Architecture Rules

**Layer Enforcement (7 rules):**
- Apps cannot import from other apps
- Apps cannot import from DB directly (must go through API)
- Packages cannot import from apps or API
- Vendor packages cannot import from packages or API
- No circular dependencies

**Vendor Abstraction (17 rules):**
- Third-party SDKs must only be imported within their vendor wrapper
- Examples: `@clerk/*` → `@vendor/clerk`, `@sentry/*` → `@vendor/observability`
- See `.dependency-cruiser.cjs` for complete list

## Output Files

```
thoughts/shared/evaluations/
├── results/          # Immutable JSON results per run
│   └── YYYY-MM-DD-HHMMSS-arch-eval.json
├── summaries/        # Human-readable Markdown summaries
│   └── YYYY-MM-DD-arch-eval.md
└── baselines/        # Initial baselines for comparison
    └── YYYY-MM-DD-initial-baseline.json
```

## Understanding Findings

### Tier Classification

- **Tier 1 (Critical)** - Architectural violations requiring immediate attention
  - Circular dependencies
  - Reverse layer imports (packages → API, apps → DB)
  - Missing TypeScript strict mode

- **Tier 2 (Important)** - Should be addressed in upcoming work
  - Vendor abstraction bypasses
  - Excessive unused code
  - Undeclared dependencies

- **Tier 3 (Informational)** - Can be fixed opportunistically
  - Minor unused exports
  - Naming inconsistencies
  - Long build times

### Signal Ratio

Percentage of Tier 1 + Tier 2 findings out of total findings. Target: >80% (all findings are actionable).

## Working with Findings

### 1. Review the Markdown Summary

After running `pnpm arch-eval`, check:
```
thoughts/shared/evaluations/summaries/YYYY-MM-DD-arch-eval.md
```

Each finding includes:
- Tier classification
- Affected files
- Why it matters
- Recommended action

### 2. Address Tier 1 Findings

Tier 1 findings block CI (once promoted from non-blocking). To fix:

1. Read the finding description
2. Use `/create_plan` in Claude Code to plan the refactor
3. Implement the fix
4. Run `pnpm arch-eval` to verify
5. Commit and push

### 3. Suppress False Positives

If a violation is intentional (accepted technical debt), add to `.arch-eval-ignore.json`:

```json
{
  "suppressions": [
    {
      "rule": "no-package-to-api-imports",
      "from": "packages/console-trpc/src/server.tsx",
      "to": "api/console/src/index.ts",
      "reason": "tRPC server setup requires API import - architectural exception",
      "expires": "2026-06-01"
    }
  ]
}
```

**Fields:**
- `rule` - Rule name from finding
- `from` - Source file path (supports glob patterns)
- `to` - Target file path (optional, supports glob patterns)
- `reason` - Why this is acceptable (required for audit trail)
- `expires` - Optional expiration date (YYYY-MM-DD) to force re-evaluation

**Run `pnpm arch-eval` after adding suppressions to verify they work.**

### 4. Update Baseline After Fixes

After addressing findings, update the baseline:

```bash
# Run evaluation
pnpm arch-eval

# Copy latest result to baseline
cp thoughts/shared/evaluations/results/YYYY-MM-DD-HHMMSS-arch-eval.json \
   thoughts/shared/evaluations/baselines/YYYY-MM-DD-updated-baseline.json

# Commit the new baseline
git add thoughts/shared/evaluations/baselines/
git commit -m "chore: update architecture evaluation baseline"
```

## CI Integration

### Current Status (Non-Blocking)

The Architecture Evaluation workflow runs on all PRs but does **not** block merging (`continue-on-error: true`). This allows the team to:
- Monitor false positive rate
- Tune rules based on real usage
- Address existing violations gradually

### Promotion to Blocking

After **2-4 weeks** of monitoring, when false positive rate is **<15%**, the workflow will be promoted to blocking:

1. Remove `continue-on-error: true` from `.github/workflows/arch-eval.yml`
2. Document decision in ADR-002
3. Communicate to team
4. Monitor for any issues

## Scheduled Runs

A weekly cron job runs every **Monday at 9am UTC** on the `main` branch to:
- Detect architecture drift over time
- Track signal ratio trends
- Alert if new violations appear

View scheduled runs: https://github.com/lightfastai/lightfast/actions/workflows/arch-eval.yml

## Configuration

### Pipeline Config (`pipeline.config.json`)

```json
{
  "dimensions": ["boundary_integrity", "dependency_health", "build_efficiency", "type_safety"],
  "thresholds": {
    "unused_exports_per_package": 10,
    "build_time_increase_percent": 20,
    "any_count_per_package": 5
  },
  "feature_flags": {
    "turbo_boundaries": true,
    "ai_smell_detection": false,
    "weighted_scoring": false
  }
}
```

### Dependency Cruiser (`.dependency-cruiser.cjs`)

Root-level configuration with all layer and vendor rules. To add a new vendor abstraction rule:

```javascript
{
  name: "vendor-only-newtool",
  comment: "Use @vendor/newtool instead of newtool directly",
  severity: "error",
  from: { pathNot: "^vendor/newtool/" },
  to: { path: "^newtool$" },
}
```

### Knip (`knip.config.ts`)

Workspace-aware configuration for unused code detection. Entry points are configured per workspace type (apps, api, packages, vendor, db, core).

## Troubleshooting

### "Command not found: dependency-cruiser"

```bash
cd internal/arch-eval
pnpm install
pnpm build
```

### "Pipeline exits with code 1"

This is **expected** when Tier 1 findings exist. The pipeline is designed to fail fast on critical violations.

### "Too many false positives"

1. Review findings in Markdown summary
2. Add legitimate exceptions to `.arch-eval-ignore.json`
3. If a rule is fundamentally flawed, create an issue or update `.dependency-cruiser.cjs`

### "knip reports errors from vendor/db"

This is a known issue with packages that have environment variable validation. These are excluded via `ignoreWorkspaces` in `knip.config.ts`.

## Development

### Project Structure

```
internal/arch-eval/
├── src/
│   ├── types.ts              # TypeScript interfaces
│   ├── config.ts             # Config loader
│   ├── collectors/           # Data collection from tools
│   │   ├── dependency-cruiser.ts
│   │   ├── knip.ts
│   │   ├── turbo-boundaries.ts
│   │   └── turbo-summary.ts
│   ├── analyzers/            # Finding classification
│   │   ├── boundary-integrity.ts
│   │   ├── dependency-health.ts
│   │   ├── build-efficiency.ts
│   │   └── type-safety.ts
│   ├── reporters/            # Output generation
│   │   ├── json-reporter.ts
│   │   └── markdown-reporter.ts
│   └── index.ts              # Pipeline orchestrator
├── .dependency-cruiser.cjs   # Boundary rules
├── knip.config.ts            # Unused code config
├── pipeline.config.json      # Pipeline settings
└── package.json
```

### Adding a New Collector

1. Create `src/collectors/new-tool.ts`:
```typescript
import type { CollectorOutput } from "../types.js";

export function collectNewTool(): CollectorOutput {
  // Run tool and parse output
  return {
    tool: "new-tool",
    raw_findings: [...],
    duration_ms: 0,
  };
}
```

2. Add to `src/collectors/index.ts`:
```typescript
import { collectNewTool } from "./new-tool.js";

export async function runAllCollectors(...) {
  outputs.push(collectNewTool());
}
```

3. Create analyzer in `src/analyzers/` to process the findings

### Adding a New Rule

1. Edit `.dependency-cruiser.cjs` to add the rule
2. Run `pnpm lint:deps` to test
3. Document the rule in this README
4. Add examples to ADR-001 if significant

## Architecture Decision Records

- **ADR-000**: [Adopt Architecture Decision Records](../../thoughts/shared/adrs/ADR-000-adopt-adrs.md)
- **ADR-001**: [Use dependency-cruiser for boundary enforcement](../../thoughts/shared/adrs/ADR-001-dependency-cruiser-for-boundary-enforcement.md)
- **ADR-002**: [Promote CI checks to blocking](../../thoughts/shared/adrs/ADR-002-promote-ci-to-blocking.md) *(pending)*

## Claude Code Skill

Run evaluations directly from Claude Code:

```
/arch-eval              # Full evaluation
/arch-eval --quick      # Quick mode
/arch-eval --compare    # Compare with previous run
```

## Support

- **Issues**: https://github.com/lightfastai/lightfast/issues
- **Discussions**: Use `arch-eval` label
- **Slack**: #architecture channel (internal)

## References

- [Implementation Plan](../../thoughts/shared/plans/2026-02-07-arch-eval-pipeline-implementation.md)
- [Initial Baseline](../../thoughts/shared/evaluations/baselines/2026-02-07-initial-baseline.json)
- [dependency-cruiser docs](https://github.com/sverweij/dependency-cruiser)
- [knip docs](https://knip.dev/)
- [Turbo boundaries](https://turbo.build/repo/docs/reference/boundaries)
