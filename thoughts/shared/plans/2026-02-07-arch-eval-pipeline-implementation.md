# Architecture Evaluation Pipeline Implementation Plan

## Overview

Implement the architecture evaluation pipeline for Lightfast — a system that audits the monorepo's dependency boundaries, detects unused code, enforces the vendor abstraction layer, and reports tier-classified findings. This covers Phase 1a (tooling + first audit), Phase 1b (config + baseline + Turbo integration), and Phase 2 (fully automated pipeline with CI integration and `/arch-eval` skill).

## Current State Analysis

### What Exists
- **Monorepo infrastructure**: pnpm workspace with 7 groups (`apps/`, `api/`, `packages/`, `vendor/`, `db/`, `internal/`, `core/`), Turborepo 2.5.8+ with cached tasks
- **3 internal tooling packages**: `@repo/eslint-config`, `@repo/prettier-config`, `@repo/typescript-config` in `internal/`
- **17 vendor abstraction packages** in `vendor/` wrapping third-party SDKs (Clerk, PlanetScale, Upstash, Sentry, etc.)
- **Research documents**: 4 comprehensive research docs covering design, codebase analysis, external tooling research, and senior review
- **Existing quality gates**: `pnpm lint`, `pnpm typecheck`, `pnpm build:console`

### What's Missing
- No `internal/arch-eval/` package
- No `dependency-cruiser` installed or configured
- No `knip` installed or configured
- No `thoughts/shared/evaluations/` directory
- No `thoughts/shared/adrs/` directory
- No architecture boundary enforcement beyond convention
- No CI for the console ecosystem (only `core/lightfast` and `core/mcp`)

### Key Discoveries
- **Real vendor abstraction violations exist**: ~29 direct `@sentry/nextjs` imports, ~17 direct `@clerk/nextjs` imports, ~5 direct `inngest` imports, ~2 direct `@upstash/redis` imports across apps and API packages
- **Internal package pattern**: `@repo/*` namespace, `private: true`, `type: module`, standard scripts (`clean`, `format`, `typecheck`), extends `@repo/typescript-config/base.json`
- **`internal/*` glob already in `pnpm-workspace.yaml:7`**: new packages are auto-discovered
- **Turbo boundaries available**: Turborepo ^2.5.5 in catalog, v2.8.3 globally — experimental but zero-config
- **Existing `eval` Turbo task**: Used for AI model evaluations (Braintrust) — architecture eval needs a distinct task name

## Desired End State

After this plan is complete:

1. **`internal/arch-eval/`** exists as a private workspace package (`@repo/arch-eval`) with TypeScript source code
2. **`dependency-cruiser`** enforces layer rules (7 forbidden patterns) and vendor abstraction rules (17 vendor packages) via `.dependency-cruiser.cjs`
3. **`knip`** detects unused files, dependencies, exports, and types across all 71+ packages
4. **`turbo boundaries`** runs as a supplementary fast check for undeclared dependencies
5. **Pipeline automation**: Running `pnpm arch-eval` executes the full pipeline (collect → analyze → report)
6. **Immutable results**: Each run produces a JSON file in `thoughts/shared/evaluations/results/` and a Markdown summary in `thoughts/shared/evaluations/summaries/`
7. **CI integration**: `lint:deps` + `turbo boundaries` run on PRs (initially as warnings, promoted to blocking when false positive rate < 15%)
8. **`/arch-eval` Claude Code skill** enables on-demand evaluation runs
9. **ADR system bootstrapped** with template and first two records
10. **Baselines established** for dependency health, build performance, and type safety

### How to Verify
- `pnpm arch-eval` runs without errors and produces JSON results + Markdown summary
- `pnpm lint:deps` runs dependency-cruiser across the monorepo
- `pnpm lint:unused` runs knip across the monorepo
- `turbo boundaries` exits with known violations count
- CI workflow runs on PR and posts findings as comments
- `thoughts/shared/evaluations/results/` contains at least one baseline JSON file
- `thoughts/shared/evaluations/summaries/` contains at least one Markdown summary
- `thoughts/shared/adrs/` contains ADR-000 and ADR-001

## What We're NOT Doing

- **Weighted scoring** — Deferred to Phase 3. Findings are tier-classified only (Tier 1/2/3)
- **AI-assisted smell detection** — Feature-flagged off. Phase 3+ exploration
- **DORA metrics** — Requires GitHub API integration and months of data. Phase 3+
- **Meta-evaluation framework** — Phase 3-4 exploration
- **Dashboard** — Phase 4 future capability
- **Per-package dependency-cruiser configs** — Start with root-level config; migrate only if hitting 25-30+ package-specific overrides
- **Fixing the violations found** — This plan creates the detection tooling. Fixes are separate plans via `/create_plan`
- **Bundle analysis** — Mentioned in design as Phase 2 but deferred to keep scope focused on boundaries + dependency health
- **Performance baselines (CWV, API latency)** — Phase 3+

## Implementation Approach

Build incrementally: install tools and prove they work manually first (Phase 1a), then formalize config and integrate with Turbo (Phase 1b), then automate the full pipeline and add CI (Phase 2). Each phase produces standalone value — the plan can be paused after any phase.

---

## Phase 1a: Tools + First Audit

### Overview
Install `dependency-cruiser` and `knip`, configure them for the monorepo's layered architecture and vendor abstraction rules, and run the first-ever architecture boundary audit. This phase is manual — tools are run from the command line, output is reviewed by hand.

### Changes Required

#### 1. Create `internal/arch-eval/` package scaffold

**File**: `internal/arch-eval/package.json`
```json
{
  "name": "@repo/arch-eval",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules dist",
    "format": "prettier --check . --ignore-path ../../.gitignore",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "lint:deps": "depcruise . --config .dependency-cruiser.cjs",
    "lint:unused": "knip"
  },
  "dependencies": {
    "dependency-cruiser": "^16.10.0",
    "knip": "^5.44.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/prettier-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^24.3.0",
    "prettier": "catalog:",
    "typescript": "catalog:"
  },
  "prettier": "@repo/prettier-config"
}
```

**File**: `internal/arch-eval/tsconfig.json`
```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**File**: `internal/arch-eval/eslint.config.js`
```javascript
import baseConfig from "@repo/eslint-config/base";

export default [...baseConfig];
```

#### 2. Configure dependency-cruiser

**File**: `internal/arch-eval/.dependency-cruiser.cjs`

Root-level configuration with layer enforcement + vendor abstraction rules. This config is placed in `internal/arch-eval/` but runs against the monorepo root.

```javascript
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "../../tsconfig.json" },
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      json: { space: 2 },
    },
  },
  forbidden: [
    // === LAYER RULES ===
    {
      name: "no-app-to-app-imports",
      comment: "Apps must not import from other apps",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^apps/", pathNot: "$from.dir" },
    },
    {
      name: "no-package-to-app-imports",
      comment: "Packages must not import from apps",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "no-vendor-to-package-imports",
      comment: "Vendor abstractions must not import from packages",
      severity: "error",
      from: { path: "^vendor/" },
      to: { path: "^packages/" },
    },
    {
      name: "no-vendor-to-api-imports",
      comment: "Vendor abstractions must not import from API layer",
      severity: "error",
      from: { path: "^vendor/" },
      to: { path: "^api/" },
    },
    {
      name: "no-package-to-api-imports",
      comment: "Packages must not import from API layer (reverse dependency)",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^api/" },
    },
    {
      name: "no-app-to-db-imports",
      comment: "Apps must not import from DB directly (go through API)",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^db/" },
    },
    {
      name: "no-circular-packages",
      comment: "No circular dependencies between workspace packages",
      severity: "error",
      from: {},
      to: { circular: true },
    },

    // === VENDOR ABSTRACTION ENFORCEMENT ===
    // Each rule ensures third-party SDKs are only imported within their vendor wrapper package
    {
      name: "vendor-only-planetscale",
      comment: "Use @vendor/db instead of @planetscale/* directly",
      severity: "error",
      from: { pathNot: "^vendor/db/" },
      to: { path: "^@planetscale" },
    },
    {
      name: "vendor-only-clerk",
      comment: "Use @vendor/clerk instead of @clerk/* directly",
      severity: "error",
      from: { pathNot: "^vendor/clerk/" },
      to: { path: "^@clerk" },
    },
    {
      name: "vendor-only-upstash",
      comment: "Use @vendor/upstash instead of @upstash/redis directly",
      severity: "error",
      from: { pathNot: "^vendor/upstash/" },
      to: { path: "^@upstash/redis" },
    },
    {
      name: "vendor-only-upstash-workflow",
      comment: "Use @vendor/upstash-workflow instead of @upstash/workflow directly",
      severity: "error",
      from: { pathNot: "^vendor/upstash-workflow/" },
      to: { path: "^@upstash/workflow" },
    },
    {
      name: "vendor-only-inngest",
      comment: "Use @vendor/inngest instead of inngest directly",
      severity: "error",
      from: { pathNot: "^vendor/inngest/" },
      to: { path: "^inngest$" },
    },
    {
      name: "vendor-only-inngest-packages",
      comment: "Use @vendor/inngest instead of @inngest/* directly",
      severity: "error",
      from: { pathNot: "^vendor/inngest/" },
      to: { path: "^@inngest" },
    },
    {
      name: "vendor-only-sentry",
      comment: "Use @vendor/observability or @vendor/next instead of @sentry/* directly",
      severity: "error",
      from: { pathNot: "^vendor/(observability|next)/" },
      to: { path: "^@sentry" },
    },
    {
      name: "vendor-only-logtail",
      comment: "Use @vendor/observability or @vendor/next instead of @logtail/* directly",
      severity: "error",
      from: { pathNot: "^vendor/(observability|next)/" },
      to: { path: "^@logtail" },
    },
    {
      name: "vendor-only-pinecone",
      comment: "Use @vendor/pinecone instead of @pinecone-database/* directly",
      severity: "error",
      from: { pathNot: "^vendor/pinecone/" },
      to: { path: "^@pinecone-database" },
    },
    {
      name: "vendor-only-resend",
      comment: "Use @vendor/email instead of resend directly",
      severity: "error",
      from: { pathNot: "^vendor/email/" },
      to: { path: "^resend$" },
    },
    {
      name: "vendor-only-posthog",
      comment: "Use @vendor/analytics instead of posthog-* directly",
      severity: "error",
      from: { pathNot: "^vendor/analytics/" },
      to: { path: "^posthog" },
    },
    {
      name: "vendor-only-knocklabs",
      comment: "Use @vendor/knock instead of @knocklabs/* directly",
      severity: "error",
      from: { pathNot: "^vendor/knock/" },
      to: { path: "^@knocklabs" },
    },
    {
      name: "vendor-only-basehub",
      comment: "Use @vendor/cms instead of basehub directly",
      severity: "error",
      from: { pathNot: "^vendor/cms/" },
      to: { path: "^basehub$" },
    },
    {
      name: "vendor-only-arcjet",
      comment: "Use @vendor/security instead of @arcjet/* directly",
      severity: "error",
      from: { pathNot: "^vendor/security/" },
      to: { path: "^@arcjet" },
    },
    {
      name: "vendor-only-nosecone",
      comment: "Use @vendor/security instead of @nosecone/* or nosecone directly",
      severity: "error",
      from: { pathNot: "^vendor/security/" },
      to: { path: "^@?nosecone" },
    },
    {
      name: "vendor-only-mastra",
      comment: "Use @vendor/mastra instead of @mastra/* directly",
      severity: "error",
      from: { pathNot: "^vendor/mastra/" },
      to: { path: "^@mastra" },
    },
    {
      name: "vendor-only-cohere",
      comment: "Use @vendor/embed instead of cohere-ai directly",
      severity: "error",
      from: { pathNot: "^vendor/embed/" },
      to: { path: "^cohere-ai" },
    },
    {
      name: "vendor-only-vercel-blob",
      comment: "Use @vendor/storage instead of @vercel/blob directly",
      severity: "error",
      from: { pathNot: "^vendor/storage/" },
      to: { path: "^@vercel/blob" },
    },

    // === DOMAIN SCOPE RULES ===
    {
      name: "console-packages-domain-boundary",
      comment: "@repo/console-* packages should not be imported by non-console apps",
      severity: "warn",
      from: { path: "^apps/(?!console)" },
      to: { path: "@repo/console-" },
    },
  ],
};
```

**Note**: During Phase 1a execution, the rules will likely need tuning. Expected adjustments:
- Some vendor rules may need `pathNot` exceptions (e.g., `packages/console-pinecone` importing Pinecone types directly)
- `core/ai-sdk` has type-only `@upstash/redis` imports that may need exemption
- Sentry instrumentation files in `apps/*/instrumentation.ts` and `apps/*/sentry.*.config.ts` may need exceptions since Sentry requires direct imports for Next.js integration hooks

#### 3. Configure knip

**File**: `internal/arch-eval/knip.config.ts`
```typescript
import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["scripts/*.{js,ts}"],
      ignoreDependencies: ["turbo", "turbo-ignore"],
    },
    "apps/*": {
      entry: [
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/route.ts",
        "src/app/api/**/route.ts",
        "src/middleware.ts",
        "src/instrumentation.ts",
        "next.config.{js,ts,mjs}",
        "tailwind.config.{js,ts}",
        "postcss.config.{js,ts,mjs}",
        "sentry.*.config.ts",
      ],
      ignoreDependencies: ["@sentry/nextjs"],
    },
    "api/*": {
      entry: ["src/index.ts", "src/inngest/**/*.ts"],
    },
    "packages/*": {
      entry: ["src/index.ts", "src/index.tsx"],
    },
    "vendor/*": {
      entry: ["src/index.ts", "env.ts"],
    },
    "db/*": {
      entry: ["src/index.ts", "src/schema/**/*.ts"],
    },
    "core/*": {
      entry: ["src/index.ts"],
    },
    "internal/*": {
      entry: ["src/index.ts", "*.js", "*.json"],
      ignore: ["internal/arch-eval/**"],
    },
  },
  ignore: [
    "**/node_modules/**",
    "**/.turbo/**",
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "thoughts/**",
    "examples/**",
  ],
  ignoreDependencies: [
    "@repo/eslint-config",
    "@repo/prettier-config",
    "@repo/typescript-config",
  ],
};

export default config;
```

**Note**: Knip config will require significant tuning in Phase 1a. Next.js apps have unconventional entry points (file-based routing, middleware, instrumentation hooks, Sentry config files) that knip needs to be told about. The initial config above is a starting point — expect 30-60 minutes of iteration.

#### 4. Run tools manually and triage findings

This is manual work during implementation, not code changes. The implementer should:

1. Run `dependency-cruiser` from the monorepo root:
   ```bash
   cd /Users/jeevanpillay/Code/@lightfastai/lightfast-arch-eval
   npx depcruise apps/ api/ packages/ vendor/ db/ core/ --config internal/arch-eval/.dependency-cruiser.cjs --output-type json > /tmp/depcruise-output.json
   npx depcruise apps/ api/ packages/ vendor/ db/ core/ --config internal/arch-eval/.dependency-cruiser.cjs --output-type err
   ```

2. Run `knip` from the monorepo root:
   ```bash
   npx knip --config internal/arch-eval/knip.config.ts
   ```

3. Run `turbo boundaries`:
   ```bash
   npx turbo boundaries
   ```

4. For each finding, classify as:
   - **Tier 1 (Critical)**: Circular dependencies, reverse layer imports
   - **Tier 2 (Important)**: Vendor abstraction bypasses, undeclared dependencies, significant unused code
   - **Tier 3 (Informational)**: Minor unused exports, naming inconsistencies

5. Tune rules to eliminate false positives. Expected false positives:
   - Sentry requires direct `@sentry/nextjs` imports in Next.js config files (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`)
   - `packages/console-pinecone` may legitimately import Pinecone types
   - `core/ai-sdk` has type-only imports from `@upstash/redis`
   - Some `basehub` imports may exist in CMS workflow packages outside `vendor/cms`

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` succeeds with new package: `pnpm install`
- [x] TypeScript compiles: `cd internal/arch-eval && pnpm typecheck`
- [x] dependency-cruiser runs without config errors: `npx depcruise apps/ --config internal/arch-eval/.dependency-cruiser.cjs --output-type err`
- [x] knip runs without config errors: `npx knip --config internal/arch-eval/knip.config.ts` (Note: knip needs additional tuning for complex monorepo - deferred to Phase 1b)
- [x] turbo boundaries runs: `npx turbo boundaries`

#### Manual Verification:
- [ ] dependency-cruiser output contains real layer violations (not just false positives)
- [ ] knip output identifies genuinely unused dependencies/exports
- [ ] False positive rate after tuning is < 30% (acceptable for first pass)
- [ ] All 17 vendor abstraction rules are tested and produce expected results

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the tools produce meaningful results and rules are tuned before proceeding to Phase 1b.

---

## Phase 1b: Config + Baseline + Integration

### Overview
Formalize the pipeline configuration, establish baselines from Phase 1a findings, bootstrap the ADR system, and integrate boundary checking with Turbo tasks.

### Changes Required

#### 1. Create pipeline configuration

**File**: `internal/arch-eval/pipeline.config.json`
```json
{
  "dimensions": [
    "boundary_integrity",
    "dependency_health",
    "build_efficiency",
    "type_safety"
  ],
  "thresholds": {
    "unused_exports_per_package": 10,
    "build_time_increase_percent": 20,
    "any_count_per_package": 5
  },
  "feature_flags": {
    "turbo_boundaries": true,
    "ai_smell_detection": false,
    "weighted_scoring": false,
    "dora_metrics": false,
    "bundle_analysis": false
  }
}
```

#### 2. Create evaluation output directories

```
thoughts/shared/evaluations/
├── results/          # Immutable JSON results per run
│   └── .gitkeep
├── summaries/        # Human-readable markdown summaries
│   └── .gitkeep
└── baselines/        # Initial baselines from Phase 1a
    └── .gitkeep
```

#### 3. Write baseline results

**File**: `thoughts/shared/evaluations/baselines/YYYY-MM-DD-initial-baseline.json`

This file is generated during implementation by running the tools and capturing output. Structure follows the `EvaluationResult` interface from the design document:

```json
{
  "timestamp": "<ISO 8601 timestamp>",
  "git_sha": "<current HEAD sha>",
  "branch": "main",
  "findings": [
    // Populated from Phase 1a triage results
  ],
  "summary": {
    "total_findings": 0,
    "tier1_count": 0,
    "tier2_count": 0,
    "tier3_count": 0,
    "signal_ratio": 0,
    "packages_evaluated": 71,
    "packages_total": 71,
    "tools_used": ["dependency-cruiser@16", "knip@5", "turbo-boundaries@2.8"]
  }
}
```

#### 4. Bootstrap ADR system

**File**: `thoughts/shared/adrs/README.md`
```markdown
# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Lightfast monorepo.

## Format

Each ADR follows the template in `template.md`. Files are named `ADR-NNN-short-description.md`.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| ADR-000 | Adopt Architecture Decision Records | Accepted | YYYY-MM-DD |
| ADR-001 | Use dependency-cruiser for boundary enforcement | Accepted | YYYY-MM-DD |
```

**File**: `thoughts/shared/adrs/template.md`
```markdown
# ADR-NNN: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-NNN]

## Context
[What is the issue that we're seeing that is motivating this decision or change?]

## Decision
[What is the change that we're proposing and/or doing?]

## Consequences
[What becomes easier or more difficult to do because of this change?]
```

**File**: `thoughts/shared/adrs/ADR-000-adopt-adrs.md`
```markdown
# ADR-000: Adopt Architecture Decision Records

## Status
Accepted

## Context
Lightfast has no formal system for recording architecture decisions. Decisions are scattered across CLAUDE.md, code comments, git history, and tribal knowledge. As the monorepo grows, it becomes harder to understand why specific patterns exist.

## Decision
Adopt lightweight ADRs in `thoughts/shared/adrs/`. Each significant technical decision gets a numbered record. ADRs are append-only — deprecated decisions are marked as such, not deleted.

## Consequences
- Decisions are discoverable and searchable
- New contributors can understand architectural rationale
- The evaluation pipeline can reference ADRs when explaining why certain rules exist
- Small overhead per decision (5-10 minutes to write)
```

**File**: `thoughts/shared/adrs/ADR-001-dependency-cruiser-for-boundary-enforcement.md`
```markdown
# ADR-001: Use dependency-cruiser for boundary enforcement

## Status
Accepted

## Context
Lightfast's monorepo has a strict layered architecture (apps → api → packages → vendor → db) and 17 vendor abstraction packages. These boundaries are enforced by convention only — no tooling prevents violations. Research identified ~74 vendor abstraction bypasses across the codebase.

## Decision
Use dependency-cruiser as the primary boundary enforcement tool. It provides:
- Regex-based path rules for layer enforcement
- Circular dependency detection
- Vendor abstraction enforcement (one rule per vendor package)
- JSON and error output formats for CI integration

turbo boundaries is used as a supplementary fast check for undeclared dependencies and cross-package file imports. It's experimental (introduced Turborepo 2.4, Jan 2025) but zero-config and runs in milliseconds.

knip is used for unused code detection (dead files, unused dependencies/exports/types).

## Consequences
- Layer violations are caught before merge (once added to CI)
- Vendor abstraction bypasses are detected automatically
- New team members get immediate feedback when violating boundaries
- dependency-cruiser config requires maintenance when new vendor packages are added
- ~74 existing violations need to be addressed or explicitly exempted
```

#### 5. Add Turbo tasks for boundary checking

**Edit**: `turbo.json` — add new tasks:

```jsonc
{
  // ... existing tasks ...
  "lint:deps": {
    "dependsOn": ["^build"],
    "outputs": [],
    "cache": false
  },
  "lint:unused": {
    "outputs": [],
    "cache": false
  },
  "arch-eval": {
    "cache": false,
    "dependsOn": ["^build"]
  }
}
```

**Edit**: Root `package.json` — add scripts:

```json
{
  "scripts": {
    // ... existing scripts ...
    "lint:deps": "depcruise apps/ api/ packages/ vendor/ db/ core/ --config internal/arch-eval/.dependency-cruiser.cjs --output-type err",
    "lint:unused": "knip --config internal/arch-eval/knip.config.ts",
    "arch-eval": "node --import tsx internal/arch-eval/src/index.ts"
  }
}
```

#### 6. Record build performance baseline

Run during implementation:
```bash
turbo run build --summarize
```

Parse output from `.turbo/runs/` and record in `thoughts/shared/evaluations/baselines/`.

#### 7. Write initial markdown summary

**File**: `thoughts/shared/evaluations/summaries/YYYY-MM-DD-arch-eval.md`

Generated from baseline results. Follows the template from the design document — see Stage 3: Reporting in the architecture design.

### Success Criteria

#### Automated Verification:
- [x] `pnpm lint:deps` runs and outputs findings: `pnpm lint:deps`
- [x] `pnpm lint:unused` runs and outputs findings: `pnpm lint:unused` (Note: requires additional tuning - see Phase 1a note)
- [x] Baseline JSON exists: `ls thoughts/shared/evaluations/baselines/*.json`
- [x] ADR files exist: `ls thoughts/shared/adrs/ADR-00*.md`
- [x] New Turbo tasks are recognized: `turbo run lint:deps --dry`

#### Manual Verification:
- [ ] Baseline JSON accurately reflects Phase 1a findings
- [ ] Markdown summary is human-readable and actionable
- [ ] ADR-000 and ADR-001 capture the actual decisions made
- [ ] `pnpm lint:deps` takes < 60 seconds to complete

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that baselines are accurate and the Turbo integration works correctly before proceeding to Phase 2.

---

## Phase 2: Automated Pipeline + CI

### Overview
Implement the full pipeline as TypeScript modules — collectors that run the tools and parse output, analyzers that classify findings, and reporters that generate immutable results. Add CI integration for PR checks and create the `/arch-eval` Claude Code skill.

### Changes Required

#### 1. TypeScript interfaces

**File**: `internal/arch-eval/src/types.ts`

```typescript
export type DimensionId =
  | "boundary_integrity"
  | "dependency_health"
  | "build_efficiency"
  | "type_safety"
  | "modularity"
  | "performance"
  | "documentation";

export type FindingTier = 1 | 2 | 3;

export type FindingStatus =
  | "open"
  | "addressed"
  | "deferred"
  | "dismissed"
  | "false_positive";

export interface Finding {
  id: string;
  tier: FindingTier;
  dimension: DimensionId;
  title: string;
  description: string;
  file?: string;
  line?: number;
  rule: string;
  tool: string;
  auto_fixable: boolean;
  status: FindingStatus;
  first_seen?: string;
}

export interface EvaluationSummary {
  total_findings: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  signal_ratio: number;
  packages_evaluated: number;
  packages_total: number;
  tools_used: string[];
}

export interface EvaluationResult {
  timestamp: string;
  git_sha: string;
  branch: string;
  findings: Finding[];
  summary: EvaluationSummary;
}

export interface PipelineConfig {
  dimensions: DimensionId[];
  thresholds: Record<string, number>;
  feature_flags: Record<string, boolean>;
}

export interface CollectorOutput {
  tool: string;
  raw_findings: RawFinding[];
  duration_ms: number;
}

export interface RawFinding {
  rule: string;
  message: string;
  file?: string;
  line?: number;
  severity: "error" | "warn" | "info";
  meta?: Record<string, unknown>;
}
```

#### 2. Config reader

**File**: `internal/arch-eval/src/config.ts`

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PipelineConfig } from "./types.js";

const CONFIG_PATH = resolve(
  import.meta.dirname,
  "../pipeline.config.json"
);

export function loadConfig(): PipelineConfig {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw) as PipelineConfig;
}
```

#### 3. Collectors

Each collector module runs a tool and returns structured output.

**File**: `internal/arch-eval/src/collectors/dependency-cruiser.ts`

Runs `dependency-cruiser` via `child_process.execSync`, parses JSON output, maps violations to `RawFinding[]`.

Key implementation details:
- Run against `apps/`, `api/`, `packages/`, `vendor/`, `db/`, `core/` directories
- Use `--output-type json` for machine-readable output
- Parse the `violations` array from JSON output
- Map each violation to a `RawFinding` with `rule`, `message`, `file`, `line`, `severity`
- Capture execution time via `performance.now()`

**File**: `internal/arch-eval/src/collectors/knip.ts`

Runs `knip` via `child_process.execSync`, parses JSON output (knip supports `--reporter json`), maps to `RawFinding[]`.

Key implementation details:
- Run with `--config internal/arch-eval/knip.config.ts --reporter json`
- Parse unused files, dependencies, exports, and types from JSON output
- Map each finding type to appropriate severity (`error` for unused deps, `warn` for unused exports, `info` for unused types)

**File**: `internal/arch-eval/src/collectors/turbo-boundaries.ts`

Runs `turbo boundaries` via `child_process.execSync`, parses text output (turbo boundaries outputs human-readable text), maps to `RawFinding[]`.

Key implementation details:
- Run `npx turbo boundaries` and capture stdout
- Parse line-by-line for violation patterns
- Map each to a `RawFinding`
- Guard with feature flag check from config

**File**: `internal/arch-eval/src/collectors/turbo-summary.ts`

Runs `turbo run build --summarize --dry` or reads cached summary from `.turbo/runs/`, extracts build metrics.

Key implementation details:
- Parse JSON output for cache hit rate, build times, task count
- Extract max sequential chain depth from task graph
- Map threshold violations (e.g., build time regression) to `RawFinding[]`

**File**: `internal/arch-eval/src/collectors/index.ts`

Exports all collectors and provides a `runAllCollectors()` function that executes them in sequence (or parallel where safe) and returns `CollectorOutput[]`.

#### 4. Analyzers

Each analyzer takes collector output and produces tier-classified `Finding[]`.

**File**: `internal/arch-eval/src/analyzers/boundary-integrity.ts`

Analyzes dependency-cruiser + turbo-boundaries output:
- Layer violations → Tier 1
- Vendor abstraction bypasses → Tier 2 (unless circular → Tier 1)
- Circular dependencies → Tier 1
- Undeclared dependencies → Tier 2
- Domain boundary warnings → Tier 3
- Assigns finding IDs: `BND-001`, `BND-002`, etc.

**File**: `internal/arch-eval/src/analyzers/dependency-health.ts`

Analyzes knip output:
- Unused dependencies → Tier 2
- Packages with > `threshold.unused_exports_per_package` unused exports → Tier 2
- Unused files → Tier 2
- Minor unused exports (below threshold) → Tier 3
- Assigns finding IDs: `DEP-001`, `DEP-002`, etc.

**File**: `internal/arch-eval/src/analyzers/build-efficiency.ts`

Analyzes turbo-summary output:
- Build time regression > `threshold.build_time_increase_percent` → Tier 2
- Cache hit rate drop → Tier 2
- High task graph depth → Tier 3
- Assigns finding IDs: `BLD-001`, `BLD-002`, etc.

**File**: `internal/arch-eval/src/analyzers/type-safety.ts`

Analyzes TypeScript strictness:
- Check all `tsconfig.json` files have `strict: true` → missing strict → Tier 1
- Count `any` usage per package (via grep or ESLint rule output) → above threshold → Tier 2
- Assigns finding IDs: `TYP-001`, `TYP-002`, etc.

**File**: `internal/arch-eval/src/analyzers/index.ts`

Exports all analyzers and provides a `analyzeAll(collectorOutputs)` function that runs all analyzers and returns unified `Finding[]`.

#### 5. Reporters

**File**: `internal/arch-eval/src/reporters/json-reporter.ts`

Generates immutable JSON results:
- Takes `Finding[]` and metadata (timestamp, git_sha, branch)
- Computes summary (counts by tier, signal ratio, tools used)
- Writes to `thoughts/shared/evaluations/results/YYYY-MM-DD-HHMMSS-arch-eval.json`
- Returns the `EvaluationResult` object

Key implementation:
```typescript
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { EvaluationResult, Finding } from "../types.js";

export function generateJsonReport(findings: Finding[]): EvaluationResult {
  const timestamp = new Date().toISOString();
  const git_sha = execSync("git rev-parse HEAD").toString().trim();
  const branch = execSync("git branch --show-current").toString().trim();

  const result: EvaluationResult = {
    timestamp,
    git_sha,
    branch,
    findings,
    summary: {
      total_findings: findings.length,
      tier1_count: findings.filter((f) => f.tier === 1).length,
      tier2_count: findings.filter((f) => f.tier === 2).length,
      tier3_count: findings.filter((f) => f.tier === 3).length,
      signal_ratio:
        findings.length > 0
          ? (findings.filter((f) => f.tier <= 2).length) / findings.length
          : 1,
      packages_evaluated: 0, // Populated by collector metadata
      packages_total: 0,
      tools_used: [],
    },
  };

  const dateStr = timestamp.slice(0, 10);
  const timeStr = timestamp.slice(11, 19).replace(/:/g, "");
  const filename = `${dateStr}-${timeStr}-arch-eval.json`;

  const resultsDir = resolve(
    import.meta.dirname,
    "../../../../thoughts/shared/evaluations/results"
  );
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(
    resolve(resultsDir, filename),
    JSON.stringify(result, null, 2)
  );

  return result;
}
```

**File**: `internal/arch-eval/src/reporters/markdown-reporter.ts`

Generates human-readable Markdown summary:
- Groups findings by tier
- Includes recommended actions for Tier 1 and Tier 2
- Includes "Changes Since Last Run" section by comparing with previous results
- Writes to `thoughts/shared/evaluations/summaries/YYYY-MM-DD-arch-eval.md`
- Follows the template from the architecture design document

Key implementation:
- Read previous results JSON (most recent file in `results/`)
- Compute diff: new findings, resolved findings
- Generate Markdown with frontmatter (date, git_sha)
- Write to summaries directory

#### 6. Pipeline orchestrator

**File**: `internal/arch-eval/src/index.ts`

Main entry point that orchestrates the full pipeline:

```typescript
import { loadConfig } from "./config.js";
import { runAllCollectors } from "./collectors/index.js";
import { analyzeAll } from "./analyzers/index.js";
import { generateJsonReport } from "./reporters/json-reporter.js";
import { generateMarkdownReport } from "./reporters/markdown-reporter.js";

async function main() {
  const args = process.argv.slice(2);
  const isQuick = args.includes("--quick");
  const isCompare = args.includes("--compare");

  console.log("Architecture Evaluation Pipeline");
  console.log("================================\n");

  // Load config
  const config = loadConfig();
  console.log(`Dimensions: ${config.dimensions.join(", ")}`);
  console.log(`Feature flags: ${JSON.stringify(config.feature_flags)}\n`);

  // Stage 1: Collect
  console.log("Stage 1: Collecting data...");
  const collectorOutputs = await runAllCollectors(config, { quick: isQuick });

  for (const output of collectorOutputs) {
    console.log(
      `  ${output.tool}: ${output.raw_findings.length} raw findings (${output.duration_ms}ms)`
    );
  }

  // Stage 2: Analyze
  console.log("\nStage 2: Analyzing findings...");
  const findings = analyzeAll(collectorOutputs, config);
  console.log(`  Total findings: ${findings.length}`);
  console.log(`  Tier 1: ${findings.filter((f) => f.tier === 1).length}`);
  console.log(`  Tier 2: ${findings.filter((f) => f.tier === 2).length}`);
  console.log(`  Tier 3: ${findings.filter((f) => f.tier === 3).length}`);

  // Stage 3: Report
  console.log("\nStage 3: Generating reports...");
  const result = generateJsonReport(findings);
  const markdownPath = generateMarkdownReport(result, { compare: isCompare });

  console.log(`\nJSON results: thoughts/shared/evaluations/results/`);
  console.log(`Markdown summary: ${markdownPath}`);
  console.log(
    `\nSignal ratio: ${(result.summary.signal_ratio * 100).toFixed(0)}%`
  );

  // Exit with error if Tier 1 findings exist
  if (result.summary.tier1_count > 0) {
    console.log(
      `\n${result.summary.tier1_count} critical finding(s) — see report for details.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(2);
});
```

#### 7. CI integration

**File**: `.github/workflows/arch-eval.yml`

```yaml
name: Architecture Evaluation

on:
  pull_request:
    branches: [main]

jobs:
  boundary-check:
    name: Boundary Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.5.2

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Run dependency boundary check
        run: pnpm lint:deps
        continue-on-error: true  # Non-blocking initially

      - name: Run turbo boundaries
        run: npx turbo boundaries
        continue-on-error: true  # Non-blocking initially

      - name: Run unused code detection
        run: pnpm lint:unused
        continue-on-error: true  # Non-blocking initially
```

**Note**: `continue-on-error: true` makes these non-blocking initially. After 2-4 weeks, once the false positive rate is confirmed < 15%, change to blocking by removing `continue-on-error`. This should be an explicit decision documented as an ADR.

#### 8. Create `/arch-eval` Claude Code skill

**File**: `.claude/skills/arch-eval.md`

```markdown
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
```

#### 9. Diff tracking (comparison with previous runs)

Built into the markdown reporter (Phase 2, step 5 above). The `--compare` flag triggers:
1. Load the most recent previous results JSON from `thoughts/shared/evaluations/results/`
2. Compare finding IDs: identify new findings, resolved findings, unchanged findings
3. Include a "Changes Since Last Run" section in the Markdown summary

### Success Criteria

#### Automated Verification:
- [ ] Package builds: `cd internal/arch-eval && pnpm build`
- [ ] TypeScript compiles: `cd internal/arch-eval && pnpm typecheck`
- [ ] Full pipeline runs: `pnpm arch-eval`
- [ ] Quick mode runs: `pnpm arch-eval -- --quick`
- [ ] JSON results file is generated: `ls thoughts/shared/evaluations/results/*.json`
- [ ] Markdown summary is generated: `ls thoughts/shared/evaluations/summaries/*.md`
- [ ] Pipeline exits with code 1 if Tier 1 findings exist
- [ ] Pipeline exits with code 0 if no Tier 1 findings
- [ ] CI workflow file is valid YAML: `yamllint .github/workflows/arch-eval.yml` (or validate via `gh workflow list`)
- [ ] Lint passes: `cd internal/arch-eval && pnpm format`

#### Manual Verification:
- [ ] JSON results match expected schema (all `Finding` fields present)
- [ ] Markdown summary is human-readable and includes all tier groups
- [ ] `--compare` mode correctly identifies new and resolved findings vs previous run
- [ ] CI workflow runs on a test PR without errors
- [ ] `/arch-eval` skill works in Claude Code
- [ ] Pipeline completes in < 120 seconds for the full monorepo
- [ ] No regressions to existing `pnpm lint` or `pnpm typecheck`

**Implementation Note**: After completing Phase 2 and all automated verification passes, pause for manual confirmation. In particular, verify the CI workflow on an actual PR and confirm the `/arch-eval` skill works end-to-end.

---

## Testing Strategy

### Unit Tests
Not planned for Phase 1-2. The pipeline's correctness is validated by running it against the real monorepo and checking output. Phase 3 should add unit tests for analyzers (given finding inputs, verify correct tier classification).

### Integration Tests
- Run `pnpm arch-eval` on the monorepo and verify exit code
- Run `pnpm arch-eval -- --quick` and verify it skips knip/turbo-summary
- Run `pnpm arch-eval -- --compare` and verify diff output

### Manual Testing Steps
1. Run `pnpm arch-eval` and review the Markdown summary
2. Verify each Tier 1 finding is genuinely critical
3. Verify Tier 2 findings are actionable
4. Verify no false positives in Tier 1 (zero tolerance for false Tier 1)
5. Create a branch that introduces a new layer violation, run `pnpm lint:deps`, verify detection
6. Create a branch that adds a direct `@clerk/nextjs` import in a new file, run `pnpm lint:deps`, verify detection
7. Open a PR and verify the CI workflow runs

## Performance Considerations

- **dependency-cruiser on 80+ packages**: May be slow (30-60s). If > 60s, consider scoping to specific directories or running per-workspace-group via Turbo
- **knip on 80+ packages**: Known to be slow on large monorepos. Start without caching, add `--cache` if needed
- **Full pipeline target**: < 120 seconds total. If exceeded, parallelize collectors

## Migration Notes

- No data migration needed — this is greenfield
- Existing `pnpm lint` is not affected (separate task)
- Existing `eval` Turbo task (for AI model evaluation) is not affected (different task name)
- CI workflow is additive — no changes to existing CI workflows

## References

- Architecture design: `thoughts/shared/research/2026-02-07-arch-eval-pipeline-architecture-design.md`
- Codebase deep dive: `thoughts/shared/research/2026-02-07-arch-eval-pipeline-codebase-deep-dive.md`
- External research: `thoughts/shared/research/2026-02-07-arch-eval-pipeline-external-research.md`
- Senior review: `thoughts/shared/research/2026-02-07-arch-eval-pipeline-review.md`
