---
date: 2026-02-07
researcher: architect-agent
topic: "Architecture evaluation pipeline for Lightfast"
tags: [research, architecture, evaluation, pipeline, design]
status: complete
revision: 2
based_on:
  - 2026-02-07-arch-eval-pipeline-codebase-deep-dive.md
  - 2026-02-07-arch-eval-pipeline-external-research.md
  - 2026-02-07-arch-eval-pipeline-review.md
---

# Architecture Design: Lightfast Architecture Evaluation Pipeline (Revised)

## Research Question

End-to-end pipeline for evaluating Lightfast architecture with iterative improvement — how to measure architecture health, how to version the evaluation methodology itself, and how to know if the evaluation is getting better over time.

## Revision Notes

This is revision 2, incorporating senior dev review feedback:
1. `turbo boundaries` verified as available (Turborepo 2.5.8) but used as supplementary fast-pass; dependency-cruiser is primary enforcement
2. Phase 1 split into 1a (tools + manual runs) and 1b (config + baseline + ADR + Turbo integration)
3. Weighted scoring deferred to Phase 3; Phase 1-2 output tier-classified findings only
4. Versioning simplified to single git-based version (no three-version model)
5. Meta-evaluation relabeled as Phase 3-4 exploration, not core pipeline stage
6. dependency-cruiser pnpm workspace configuration guidance added from external research
7. Open questions reduced — design decisions with clear answers are now decided

## Executive Summary

Lightfast is a mature pnpm/Turborepo monorepo with ~80+ packages, strict layered dependencies (`apps` → `api` → `packages` → `vendor` → `db`), and a formalized research-to-implementation flow (`thoughts/shared/research/` → `thoughts/shared/plans/` → Claude Code skills). The codebase has strong conventions but lacks formal architecture evaluation: no ADRs, no automated testing for the console ecosystem, no CI for the console app, no architecture health metrics, and no dependency boundary enforcement beyond convention.

External research reveals that the industry has converged on a findings-first approach: ATAM's utility tree for identifying quality attribute scenarios → fitness functions for continuous enforcement → tier-classified findings for actionability. For TypeScript monorepos, `dependency-cruiser` is the primary enforcement tool (stable, 945K weekly npm downloads, full regex rule support), complemented by `turbo boundaries` as a fast first-pass check (experimental but available in Turborepo 2.5.8) and `knip` for unused code detection.

This design produces a pipeline that: outputs tier-classified findings (not scores) in early phases; maps onto Lightfast's existing `thoughts/` → plans → implementation workflow; uses git history as the version trail; and is implementable incrementally — Phase 1a is achievable in 1-2 days with immediate value from the first-ever boundary audit of the monorepo.

## Existing Foundation

### What We're Building On

**Monorepo Infrastructure (Strong)**
- 7 workspace groups with clear layering: `apps/` → `api/` → `packages/` → `vendor/` → `db/`
- `pnpm-workspace.yaml` with `catalog:` for shared external versions and named catalogs for version variants
- Turborepo 2.5.8 with cached `lint`, `typecheck`, `build` tasks + interactive `eval` task
- `workspace:*` protocol for all internal deps
- `turbo boundaries` available and working (scans 1753 files across 71 packages, finds 16 issues)

**Quality Gates (Partial)**
- `pnpm lint && pnpm typecheck && pnpm build:console` locally enforced
- CI exists but only covers `core/lightfast` and `core/mcp` (SDK packages)
- Changesets for versioned public releases
- Drizzle Kit for schema migration generation (27 migrations, never manual SQL)

**Research Flow (Mature)**
- `thoughts/shared/research/` — 40+ dated research documents with frontmatter
- `thoughts/shared/plans/` — 65+ dated implementation plans with strict templates
- Claude Code skills: `/create_plan`, `/implement_plan`, `/validate_plan`, `/research-team`
- Parallel research agents pattern via `/create_plan` (codebase-locator, codebase-analyzer, thoughts-locator)

**Pipeline Patterns (Proven)**
- Inngest workflows: 25+ Zod-typed events, step-based orchestration with concurrency limits, cancellation, timeouts, `onFailure` handlers
- tRPC: discriminated union auth context, three-router split (user/org/m2m), standardized error handling
- Data flow: GitHub webhooks → tRPC → Inngest → Drizzle → PlanetScale/Pinecone

### Gaps the Pipeline Must Address

| Gap | Impact | Priority |
|-----|--------|----------|
| No formal ADRs | Decisions scattered across CLAUDE.md, comments, git history | High — needed for evaluation context |
| No console CI | Architecture changes unverified on PRs for primary app | High — needed for fitness function enforcement |
| No dependency boundary tooling | Layer violations detectable only by convention | High — most immediate ROI |
| No architecture metrics | No coupling, complexity, or health measurements | Medium — needed for trending |
| No performance baselines | No bundle size, LCP, or API latency tracking | Medium — needed for regression detection |
| No test coverage for console | Zero tests across ~37 packages + API + app | Low-Medium — not blocking evaluation, but limits validation |
| No schema for research docs | Frontmatter exists but isn't validated | Low — nice-to-have for pipeline automation |

## External Capabilities

### Key Findings That Shape the Design

**1. ATAM Utility Tree → Fitness Functions (Core Pattern)**
Extract quality attribute scenarios from ATAM's utility tree and encode them as automated fitness functions. Rather than heavyweight ATAM workshops, define a utility tree once, then continuously enforce it through CI.

**2. Immutable Results + Git-Based Versioning (Pipeline Evolution)**
Every evaluation run produces immutable results tagged with `git_sha` and `timestamp`. The pipeline config lives in git — git history IS the version trail. No need for separate version numbers until the pipeline is consumed by multiple independent systems.

**3. Signal-to-Noise Ratio as the Core Quality Indicator**
Track Tier 1 (critical) + Tier 2 (important) findings vs total findings. Target > 60% signal ratio. This prevents the evaluation pipeline from drowning in noise as it grows. A finding is "signal" if it leads to a concrete improvement (finding → plan → merged PR).

**4. dependency-cruiser as Primary + turbo boundaries as Fast First-Pass (Complementary Toolchain)**
- `dependency-cruiser` (primary): Package boundary rules, circular dependency detection, layer enforcement, vendor abstraction rules, stability metrics, visualization. Stable, 945K weekly downloads, 6+ years mature.
- `turbo boundaries` (supplementary): Undeclared dependency detection, cross-package file imports. Experimental (introduced Turborepo 2.4, Jan 2025), but zero-config, Rust-based, runs in milliseconds. API may change — config is minimal so migration cost is low.
- `knip`: Unused files, dependencies, exports, types. Monorepo-aware.

**5. DORA as Outcome Indicator, Not Input Metric**
DORA metrics indicate architecture health indirectly. Poor lead time = tight coupling. High change failure rate = missing quality gates. Defer to Phase 3+ once the pipeline has enough data to correlate findings with outcomes.

**6. AI-Assisted Analysis as Complement, Not Replacement**
LLMs excel at architecture smell detection but suffer from hallucination and inconsistency. Use AI analysis to surface candidates for human review, not as automated pass/fail gates. Feature-flag from the start; enable only in Phase 3+.

## Proposed Design

### Overview

The pipeline has three core stages (Phases 1-2) with two exploration stages (Phases 3-4):

```
┌────────────────────────────────────────────────────────────────────────────────┐
│              Architecture Evaluation Pipeline (Core — Phases 1-2)              │
│                                                                                │
│  Stage 1: Collect            Stage 2: Analyze          Stage 3: Report        │
│  ┌──────────────────┐       ┌──────────────────┐      ┌──────────────────┐   │
│  │ dependency-cruiser│       │ Layer rules       │      │ Tier-classified  │   │
│  │ turbo boundaries  │  →    │ Vendor rules      │  →   │ findings list   │   │
│  │ knip              │       │ Circular dep check│      │ Immutable JSON  │   │
│  │ turbo --summarize │       │ Unused code check │      │ Markdown summary│   │
│  └──────────────────┘       │ Threshold checks  │      └──────────────────┘   │
│                              └──────────────────┘                              │
│                                                                                │
│  Versioning: git history (pipeline config + results tracked via git commits)  │
│  Storage: thoughts/shared/evaluations/                                         │
│  Integration: turbo.json tasks + CI pipeline                                   │
│                                                                                │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│            Future Exploration (Phases 3-4)                                     │
│                                                                                │
│  Weighted Scoring    AI Smell Detection    DORA Metrics    Meta-Evaluation     │
│  (Phase 3)           (Phase 3)             (Phase 3)       (Phase 3-4)        │
│                                                                                │
│  Dashboard           Automated ADRs        Anomaly Alerts                     │
│  (Phase 4)           (Phase 4)             (Phase 4)                          │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages (Core)

#### Stage 1: Data Collection

Collect raw data from the monorepo using automated tooling.

**Phase 1a Collectors (dependency-cruiser + knip):**

| Collector | What It Measures | Tool | Notes |
|-----------|-----------------|------|-------|
| Dependency Rules | Layer violations, circular deps, vendor bypasses | `dependency-cruiser` | Primary enforcement — regex path rules |
| Import Boundaries | Cross-package file imports, undeclared deps | `turbo boundaries` | Supplementary fast check — zero config |
| Unused Code | Dead files, unused deps/exports/types | `knip` | Workspace-aware, configurable entry points |

**Phase 1b Collectors (build metrics):**

| Collector | What It Measures | Tool | Notes |
|-----------|-----------------|------|-------|
| Build Performance | Cache hit rate, build times, task graph depth | `turbo --summarize` | Parse JSON output from `.turbo/runs/` |
| Type Coverage | `any` usage count per package | ESLint `@typescript-eslint/no-explicit-any` | Extend existing lint config |

**Phase 2+ Collectors (deferred):**

| Collector | What It Measures | Tool | Phase |
|-----------|-----------------|------|-------|
| Bundle Analysis | Per-app bundle sizes, chunk composition | `@next/bundle-analyzer` | Phase 2 |
| Package Fan-out | How many packages a typical change touches | Git analysis script | Phase 2 |
| DORA Metrics | Deploy frequency, lead time, MTTR, CFR | GitHub API script | Phase 3 |
| Architecture Smells | God Components, feature envy | Claude Code analysis | Phase 3 (feature-flagged) |

#### Stage 2: Analysis

Transform raw data into tier-classified findings.

**Rule-Based Analysis (dependency-cruiser):**

Layer enforcement rules:
```
apps/ → api/, packages/, vendor/         ✓ allowed
api/  → packages/, vendor/, db/          ✓ allowed
packages/ → vendor/, db/                 ✓ allowed
vendor/ → db/, external packages         ✓ allowed
db/ → (nothing internal)                 ✓ allowed

apps/ → db/                              ✗ forbidden (bypass API layer)
packages/ → api/                         ✗ forbidden (reverse dependency)
vendor/ → packages/, api/, apps/         ✗ forbidden (abstraction violation)
any → @planetscale/*, @clerk/*, etc.     ✗ forbidden (bypass vendor abstraction)
circular dependencies                    ✗ forbidden
```

**Threshold-Based Analysis (Phase 1b+):**
- Unused export counts per package (knip baseline + threshold)
- Build time regression detection (> 20% increase from baseline)
- Cache hit rate minimum (establish baseline first, then set threshold)
- TypeScript `any` count thresholds per package (baseline first)

**Finding Classification (all phases):**

| Tier | Category | Example | Action |
|------|----------|---------|--------|
| **Tier 1: Critical** | Breaking architectural constraint | Circular dependency between packages | Fix immediately |
| **Tier 1: Critical** | Security boundary violation | `vendor/` importing from `api/` | Fix immediately |
| **Tier 2: Important** | Maintainability degradation | 15+ unused exports in a package | Plan fix via `/create_plan` |
| **Tier 2: Important** | Performance regression | Build time increase > 20% | Investigate |
| **Tier 2: Important** | Coupling increase | Undeclared dependency detected | Fix in next sprint |
| **Tier 3: Informational** | Observation | Minor unused type export | Track, don't act |
| **Tier 3: Informational** | Cosmetic | Package naming inconsistency | Defer |

#### Stage 3: Reporting

Generate immutable results and human-readable summaries.

**Machine-Readable Output:**
```json
{
  "timestamp": "2026-02-07T15:30:00Z",
  "git_sha": "abc123def",
  "branch": "main",
  "findings": [
    {
      "id": "BND-001",
      "tier": 2,
      "dimension": "boundary_integrity",
      "title": "vendor/knock imports from packages/console-types",
      "description": "vendor/ packages should not import from packages/ — they are abstraction layers for third-party SDKs only",
      "file": "vendor/knock/src/components/provider.tsx",
      "line": 12,
      "rule": "vendor-no-import-packages",
      "tool": "dependency-cruiser",
      "auto_fixable": false,
      "status": "open"
    }
  ],
  "summary": {
    "total_findings": 38,
    "tier1_count": 1,
    "tier2_count": 19,
    "tier3_count": 18,
    "signal_ratio": 0.53,
    "packages_evaluated": 71,
    "packages_total": 71,
    "tools_used": ["dependency-cruiser@17", "knip@5", "turbo-boundaries@2.5.8"]
  }
}
```

**Human-Readable Output (Markdown):**
Written to `thoughts/shared/evaluations/summaries/YYYY-MM-DD-arch-eval.md`:
```markdown
---
date: 2026-02-07
git_sha: abc123def
---

# Architecture Evaluation — 2026-02-07

## Summary
- **Total findings**: 38 (1 critical, 19 important, 18 informational)
- **Signal ratio**: 53% (target: >60%)
- **Packages evaluated**: 71/71

## Critical Findings (Tier 1) — Fix Immediately
1. **[BND-007]** Circular dependency: @repo/console-types ↔ @repo/console-validation

## Important Findings (Tier 2) — Plan Fix
1. **[BND-001]** vendor/knock imports from packages/console-types
2. **[DEP-003]** 15 unused exports in @repo/console-types
3. **[DEP-008]** Undeclared dependency: apps/console uses @repo/ai-tools without package.json entry
...

## Informational (Tier 3)
18 findings — see full results JSON for details.

## Recommended Actions
1. Fix circular dependency BND-007 immediately
2. `/create_plan "Fix vendor/knock boundary violation (BND-001)"`
3. Run `knip --fix` to clean up unused exports (DEP-003)

## Changes Since Last Run
- 2 new findings (BND-007, DEP-008)
- 1 finding resolved (BND-002 — fixed in PR #347)
```

### Tooling Configuration

#### dependency-cruiser Configuration

Based on external research: at Lightfast's current scale (~71 packages), start with a **root-level configuration** with a shared base. Extract to per-package configs when hitting 25-30+ package-specific overrides.

**Root config** (`.dependency-cruiser.cjs` at monorepo root):
```javascript
module.exports = {
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: './tsconfig.json' },
    // Required for pnpm hoisted node_modules
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
  forbidden: [
    // === VENDOR ABSTRACTION ENFORCEMENT ===
    {
      name: 'vendor-only-planetscale',
      comment: 'Use @vendor/db instead of @planetscale/* directly (CLAUDE.md rule)',
      severity: 'error',
      from: { pathNot: '^vendor/db/' },
      to: { path: '^@planetscale' }
    },
    {
      name: 'vendor-only-clerk',
      comment: 'Use @vendor/clerk instead of @clerk/* directly',
      severity: 'error',
      from: { pathNot: '^vendor/clerk/' },
      to: { path: '^@clerk' }
    },
    {
      name: 'vendor-only-upstash',
      comment: 'Use @vendor/upstash instead of @upstash/* directly',
      severity: 'error',
      from: { pathNot: '^vendor/upstash/' },
      to: { path: '^@upstash' }
    },
    // Repeat for all 17 vendor packages...

    // === LAYER RULES ===
    {
      name: 'no-app-to-app-imports',
      comment: 'Apps must not import from other apps',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^apps/', pathNot: '$from.dir' }
    },
    {
      name: 'no-package-to-app-imports',
      comment: 'Packages must not import from apps',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' }
    },
    {
      name: 'no-vendor-to-package-imports',
      comment: 'Vendor abstractions must not import from packages',
      severity: 'error',
      from: { path: '^vendor/' },
      to: { path: '^packages/' }
    },
    {
      name: 'no-vendor-to-api-imports',
      comment: 'Vendor abstractions must not import from API layer',
      severity: 'error',
      from: { path: '^vendor/' },
      to: { path: '^api/' }
    },
    {
      name: 'no-package-to-api-imports',
      comment: 'Packages must not import from API layer (reverse dependency)',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^api/' }
    },
    {
      name: 'no-app-to-db-imports',
      comment: 'Apps must not import from DB directly (go through API)',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^db/' }
    },
    {
      name: 'no-circular-packages',
      comment: 'No circular dependencies between workspace packages',
      severity: 'error',
      from: {},
      to: { circular: true }
    },

    // === SCOPE RULES ===
    {
      name: 'console-packages-domain-boundary',
      comment: '@repo/console-* packages should not be imported by non-console apps',
      severity: 'warn',
      from: { path: '^apps/(?!console)' },
      to: { path: '@repo/console-' }
    }
  ]
};
```

**Known pnpm workspace issues and workarounds:**
- `combinedDependencies: true` is required when shared deps live in root `package.json` (pnpm hoisting)
- At 80+ packages, if root-level runs become slow (>30s) or hit `baseDir` resolution bugs ([#859](https://github.com/sverweij/dependency-cruiser/issues/859)), migrate to per-package configs extending a shared base
- For per-package setup: each package gets `.dependency-cruiser.cjs` with `extends: '../../.dependency-cruiser-base.cjs'`, run via Turbo `lint:deps` task for parallelization and caching
- Visualization (`--output-type dot`) should be scoped to specific package subsets — generating graphs for 80+ packages is impractical

**Vendor abstraction mapping** (all 17 vendor packages need rules):
| Vendor Package | Third-Party SDKs Wrapped |
|----------------|-------------------------|
| `@vendor/analytics` | `posthog-*` |
| `@vendor/clerk` | `@clerk/*` |
| `@vendor/cms` | `basehub` |
| `@vendor/db` | `@planetscale/*`, `drizzle-orm` |
| `@vendor/email` | `resend` |
| `@vendor/embed` | `@browserbase/*` |
| `@vendor/inngest` | `inngest` |
| `@vendor/knock` | `@knocklabs/*` |
| `@vendor/mastra` | `@mastra/*` |
| `@vendor/next` | (Next.js utilities) |
| `@vendor/observability` | `@sentry/*`, `@logtail/*` |
| `@vendor/pinecone` | `@pinecone-database/*` |
| `@vendor/security` | `@arcjet/*` |
| `@vendor/seo` | (SEO utilities) |
| `@vendor/storage` | `@vercel/blob` |
| `@vendor/upstash` | `@upstash/*` |
| `@vendor/upstash-workflow` | `@upstash/workflow` |

Note: Not all vendor packages wrap third-party SDKs (e.g., `@vendor/next`, `@vendor/seo` may be utility packages). During Phase 1a, run dependency-cruiser first to discover which packages actually have direct third-party imports that should go through vendor abstractions, then add rules for confirmed violations.

#### turbo boundaries Configuration

`turbo boundaries` is available (Turborepo 2.5.8) and already works with zero config for basic violations. For tag-based rules, add to per-package `turbo.json`:

```jsonc
// vendor/db/turbo.json
{ "tags": ["vendor"] }

// apps/console/turbo.json
{ "tags": ["app"] }
```

And root-level rules:
```jsonc
// turbo.json (boundaries section)
{
  "boundaries": {
    "tags": {
      "vendor": {
        "dependencies": {
          "deny": ["app"]  // vendor packages cannot depend on apps
        }
      }
    }
  }
}
```

**Maturity caveat**: `turbo boundaries` is experimental (RFC active since Nov 2024, shipped in v2.4 Jan 2025). The API may change. Use it as a supplementary fast check, not as the sole enforcement mechanism. Migration cost is low since config is minimal JSON.

### Versioning Model

**Single git-based version.** The pipeline config file (`internal/arch-eval/pipeline.config.json`) lives in git. Git history provides the version trail:

- Each config change is a git commit with a descriptive message
- Each evaluation run records the `git_sha` of the commit it ran against
- To compare evaluation methodology across time, diff the config file at different commits
- To understand why criteria changed, read the commit message and linked ADR

**No separate version numbers** until the pipeline is consumed by multiple independent systems. The `git_sha` in each results file is sufficient to reconstruct exactly what criteria, thresholds, and tools were active for any historical run.

**Pipeline Config** (`internal/arch-eval/pipeline.config.json`):
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
    "weighted_scoring": false,
    "dora_metrics": false,
    "cwv_tracking": false
  }
}
```

**When to introduce explicit versioning (future):**
- The pipeline is consumed by an external dashboard or API
- Multiple teams run different evaluation configs against the same codebase
- You need to compare results produced by different criteria versions programmatically
At that point, add a single `version` field to the config and bump it with each criteria change.

### Migration Strategy

**Going from one config to the next:**

1. **Change config in a PR** — modify `pipeline.config.json` with new rules/thresholds
2. **Run evaluation twice** — once with old config (from main), once with new config (from PR branch)
3. **Compare findings** — new config should catch everything old config did, plus improvements
4. **Merge when satisfied** — git history preserves the old config, results remain immutable

**Backward compatibility:**
- New fields in results JSON always have default values
- Old results can be read alongside new results (additive-only)
- The immutable results in `thoughts/shared/evaluations/results/` are never modified

### Evaluation Dimensions

Dimensions are categories for organizing findings. In Phases 1-2, they are labels only — no scoring. In Phase 3+, they optionally receive weighted scores.

#### 1. Boundary Integrity

Enforces Lightfast's layered architecture.

**Rules (dependency-cruiser):**
- Layer enforcement (7 forbidden rules — see configuration above)
- Vendor abstraction enforcement (17 vendor packages — rules per wrapper)
- Circular dependency detection
- Domain boundary enforcement (`@repo/console-*` scope)

**Rules (turbo boundaries):**
- Undeclared dependencies (importing package not in `package.json`)
- Cross-package file imports (importing a file path instead of package export)

**Mapping to Lightfast:**
- 17 `vendor/` packages serve as third-party abstraction boundaries
- The `@repo/console-*` packages (14 packages) should form a cohesive domain
- tRPC router split (user/org/m2m) creates implicit boundaries within `api/console`

#### 2. Dependency Health

Measures unused code and dependency declaration correctness.

**Key Checks:**
- Unused dependencies per `package.json` (knip)
- Unused exports per package (knip)
- Undeclared dependencies (turbo boundaries)
- Phantom dependencies — relying on hoisted packages not explicitly declared (turbo boundaries)
- Version alignment — packages using versions outside `catalog:` (future: custom script)

#### 3. Build Efficiency

Measures how well the monorepo's build graph is optimized.

**Key Metrics (from `turbo --summarize`):**
- Turborepo cache hit rate
- Total build time for `pnpm build:console`
- Task graph depth (max sequential chain length)
- Packages rebuilt on a typical PR

**Baselines:** Established in Phase 1b by running `turbo --summarize` and recording initial values.

#### 4. Type Safety

Measures TypeScript strictness.

**Key Checks:**
- `strict: true` in all tsconfig files
- `any` type usage count per package (ESLint `@typescript-eslint/no-explicit-any`)
- Type assertion count (`as` casts) — tracked but not initially threshold-gated

#### 5. Modularity (Phase 2+)

Measures coupling and cohesion across the package graph.

**Key Metrics:**
- Package afferent coupling (Ca) — how many packages depend on this one
- Package efferent coupling (Ce) — how many packages this one depends on
- Instability: I = Ce / (Ca + Ce)
- Fan-out per change — how many packages does a typical commit touch

**Lightfast-Specific Concerns:**
- `@repo/lib` and `@repo/ui` are likely high-Ca (many dependents) — acceptable if stable
- `api/console` is high-Ce (many dependencies) — acceptable for an orchestration layer
- Watch for packages with both high Ca AND high Ce — these are architectural bottlenecks

#### 6. Performance (Phase 2+)

**Key Metrics:**
- Next.js bundle sizes per route
- Core Web Vitals per key page
- API response times for critical routes

#### 7. Documentation (Phase 2+)

**Key Checks:**
- ADR coverage — are key decisions documented?
- CLAUDE.md accuracy — do instructions match actual patterns?
- Research → Plan traceability

### Integration with Existing Research Flow

#### Mapping to thoughts/ → plans → implementation

The evaluation pipeline integrates with the existing workflow at four touchpoints:

**1. Evaluation Run → Research Document**
Each evaluation run generates a summary in `thoughts/shared/evaluations/summaries/`. These serve the same role as research documents — they capture the current state of the architecture.

**2. Findings → Plans**
Tier 1 and Tier 2 findings can be used as inputs to `/create_plan`. The finding's file/line reference, rule name, and description provide the context `/create_plan` needs to propose a fix.

```
Evaluation finding (BND-001) → /create_plan "Fix vendor/knock boundary violation"
  → thoughts/shared/plans/2026-02-08-vendor-knock-boundary-fix.md
  → /implement_plan
  → /validate_plan
```

**3. Pipeline Improvement → ADRs**
When evaluation criteria are changed (adding/removing rules, adjusting thresholds), the change is documented as an ADR in `thoughts/shared/adrs/`:
```
ADR-001: Use dependency-cruiser for boundary enforcement
ADR-002: Set bundle size budget at 300KB for console app
ADR-003: Disable AI smell detection due to high false positive rate
```

**4. Research Agents → Evaluation Pipeline**
The `/research-team` command can be extended to include architecture evaluation as a research dimension. When investigating a codebase topic, agents can query the latest evaluation results for context.

#### How Claude Code Skills Integrate

**New skill: `/arch-eval`**
```
/arch-eval              — Run full evaluation pipeline
/arch-eval --quick      — Run dependency-cruiser + turbo boundaries only
/arch-eval --compare    — Compare with last run
```

**Enhanced existing skills:**
- `/create_plan` — Can reference evaluation findings as plan inputs
- `/validate_plan` — Can check if implementation addresses evaluation findings
- `/research-team` — Can include architecture evaluation as a research task

### Interfaces & Contracts

```typescript
// internal/arch-eval/src/types.ts

/** Pipeline configuration — stored in pipeline.config.json, versioned via git */
interface PipelineConfig {
  dimensions: DimensionId[];
  thresholds: Record<string, number>;
  feature_flags: Record<string, boolean>;
}

/** Evaluation result types */
type DimensionId =
  | 'boundary_integrity'
  | 'dependency_health'
  | 'build_efficiency'
  | 'type_safety'
  | 'modularity'
  | 'performance'
  | 'documentation';

type FindingTier = 1 | 2 | 3;
type FindingStatus = 'open' | 'addressed' | 'deferred' | 'dismissed' | 'false_positive';

interface EvaluationResult {
  timestamp: string;                // ISO 8601
  git_sha: string;
  branch: string;
  findings: Finding[];
  summary: EvaluationSummary;
}

interface Finding {
  id: string;                       // e.g., "BND-001"
  tier: FindingTier;
  dimension: DimensionId;
  title: string;
  description: string;
  file?: string;                    // file path
  line?: number;                    // line number
  rule: string;                     // rule that triggered this
  tool: string;                     // tool that detected this
  auto_fixable: boolean;
  status: FindingStatus;
  first_seen?: string;              // timestamp of first detection
}

interface EvaluationSummary {
  total_findings: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  signal_ratio: number;             // (tier1 + tier2) / total
  packages_evaluated: number;
  packages_total: number;
  tools_used: string[];
}

/** Phase 3+ types — weighted scoring */
interface ScoredEvaluationResult extends EvaluationResult {
  dimensions: Record<DimensionId, DimensionResult>;
  overall_score: number;            // 0-100
}

interface DimensionResult {
  score: number;                    // 0-100
  weight: number;                   // 0-1
  findings_count: number;
  tier1: number;
  tier2: number;
  tier3: number;
}

/** Phase 3+ types — meta-evaluation */
interface MetaEvaluationRecord {
  evaluation_git_sha: string;       // reference to EvaluationResult
  finding_id: string;
  classification: 'true_positive' | 'false_positive' | 'disputed';
  outcome: 'addressed' | 'deferred' | 'dismissed' | 'pending';
  plan_reference?: string;          // path to plan file
  pr_reference?: string;            // GitHub PR URL
  reviewed_by: string;
  reviewed_at: string;
}
```

### File/Package Structure

The pipeline lives in `internal/arch-eval/` following the existing `internal/` convention (alongside `internal/eslint`, `internal/prettier`, `internal/typescript`):

```
internal/arch-eval/
├── package.json                       # @internal/arch-eval, private: true
├── tsconfig.json                      # extends @repo/typescript-config
├── src/
│   ├── index.ts                       # Main entry — orchestrates pipeline stages
│   ├── types.ts                       # TypeScript interfaces (above)
│   ├── config.ts                      # Reads pipeline.config.json
│   ├── collectors/
│   │   ├── dependency-cruiser.ts      # Run dep-cruiser, parse output
│   │   ├── knip.ts                    # Run knip, parse output
│   │   ├── turbo-boundaries.ts        # Run turbo boundaries, parse output
│   │   ├── turbo-summary.ts           # Run turbo --summarize, parse output
│   │   └── git-analysis.ts            # Package fan-out, change frequency (Phase 2)
│   ├── analyzers/
│   │   ├── boundary-integrity.ts      # Analyze dep-cruiser + turbo-boundaries output
│   │   ├── dependency-health.ts       # Analyze knip output
│   │   ├── build-efficiency.ts        # Analyze turbo-summary output
│   │   └── type-safety.ts             # TypeScript strictness analysis
│   └── reporters/
│       ├── json-reporter.ts           # Generate immutable JSON results
│       └── markdown-reporter.ts       # Generate human-readable summary
├── pipeline.config.json               # Pipeline configuration (versioned via git)
├── .dependency-cruiser.cjs            # dependency-cruiser rules
└── knip.config.ts                     # knip configuration

thoughts/shared/
├── evaluations/                       # NEW — evaluation outputs
│   ├── results/                       # Immutable JSON results per run
│   ├── summaries/                     # Human-readable markdown summaries per run
│   └── baselines/                     # Initial baselines (Phase 1b)
├── adrs/                              # NEW — Architecture Decision Records
│   ├── template.md
│   ├── ADR-000-use-adrs.md
│   └── README.md
├── research/                          # Existing — evaluation research docs live here
└── plans/                             # Existing — evaluation improvement plans here
```

**Turborepo Integration:**

Add to `turbo.json`:
```json
{
  "lint:deps": {
    "dependsOn": ["^build"],
    "outputs": [".cache/.dependency-cruiser-cache"]
  },
  "lint:unused": {
    "outputs": [".cache/.knip-cache"]
  },
  "arch-eval": {
    "cache": false,
    "dependsOn": ["^build"]
  }
}
```

Add to root `package.json`:
```json
{
  "scripts": {
    "lint:deps": "depcruise . --config .dependency-cruiser.cjs",
    "lint:unused": "knip",
    "arch-eval": "turbo run arch-eval --filter=@internal/arch-eval"
  }
}
```

### Data Flow

```
┌─────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│   pnpm arch-eval│      │ Collectors           │      │ Analyzers        │
│   (trigger)     │─────→│                      │─────→│                  │
│                 │      │ dependency-cruiser    │      │ boundary check   │
│ CI: on PR       │      │ turbo boundaries     │      │ health check     │
│ Local: manual   │      │ knip                 │      │ efficiency check │
│                 │      │ turbo --summarize     │      │ type safety check│
└─────────────────┘      └─────────────────────┘      └────────┬─────────┘
                                                                │
                              ┌──────────────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ Reporters        │
                    │                  │
                    │ JSON → results/  │
                    │ MD → summaries/  │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ thoughts/shared/ │
                    │ evaluations/     │
                    │ results/*.json   │
                    │ summaries/*.md   │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Integration      │
                    │                  │
                    │ /create_plan     │
                    │ /arch-eval       │
                    │ CI PR comments   │
                    │ ADR references   │
                    └──────────────────┘
```

## Implementation Phases

### Phase 1a: Tools + First Audit (1-2 days)

**Goal:** Install tooling and run the first-ever architecture boundary audit.

**Tasks:**
1. Create `internal/arch-eval/` package with `package.json`, `tsconfig.json`
2. Install `dependency-cruiser` and write `.dependency-cruiser.cjs` with layer rules + top vendor abstraction rules
3. Install `knip` with workspace-aware configuration
4. Run both tools manually from the command line, capture raw output
5. Run `turbo boundaries` to capture its 16 known issues
6. Triage findings: classify each as Tier 1 / 2 / 3 and determine which are real violations vs false positives
7. Tune rules to eliminate false positives (this is the main time investment)

**Immediate Value:**
- First-ever dependency boundary audit of the monorepo
- Unused code identified across 71+ packages
- Know exactly which vendor abstraction rules are being violated
- Understand false positive rate of initial rules

**What This Doesn't Include:**
- No pipeline automation (tools run manually)
- No Turbo task integration
- No results storage
- No ADR system

### Phase 1b: Config + Baseline + Integration (1-2 days)

**Goal:** Formalize the pipeline config, establish baselines, and integrate with Turbo.

**Tasks:**
1. Create `pipeline.config.json` with dimensions, tuned thresholds from Phase 1a findings
2. Write baseline results to `thoughts/shared/evaluations/baselines/`
3. Create `thoughts/shared/adrs/` directory with template and ADR-000 (adopting ADRs) and ADR-001 (using dependency-cruiser for boundary enforcement)
4. Add `lint:deps` and `lint:unused` Turbo tasks
5. Run `turbo --summarize` and record build performance baseline
6. Write initial markdown summary to `thoughts/shared/evaluations/summaries/`

**Value Added:**
- Formal baseline for tracking architecture health over time
- ADR system bootstrapped with first two records
- Turbo-integrated boundary checking (cacheable, parallelizable)
- Build performance baseline recorded

### Phase 2: Automated Pipeline + CI (1-2 weeks)

**Goal:** Full pipeline running locally and in CI, outputting tier-classified findings.

**Tasks:**
1. Implement collector modules in `internal/arch-eval/src/collectors/`
2. Implement analyzer modules in `internal/arch-eval/src/analyzers/`
3. Implement JSON and Markdown reporters in `internal/arch-eval/src/reporters/`
4. Add `arch-eval` Turbo task that orchestrates the full pipeline
5. Add CI pipeline step: run `lint:deps` + `turbo boundaries` on PRs (warn, don't block for first 2-4 weeks, then promote to blocking once false positive rate < 15%)
6. Create `/arch-eval` Claude Code skill
7. Add bundle size analysis via `@next/bundle-analyzer`
8. Implement git-based change tracking (diff against previous run)

**Value Added:**
- Automated tier-classified findings on every PR
- Human-readable summaries per run
- CI catches boundary violations before merge
- `/arch-eval` skill for on-demand evaluation
- Trend tracking begins (comparison with baseline)

### Phase 3: Scoring + AI + Meta-Evaluation (Exploration, 2-4 weeks)

**Goal:** Add weighted scoring, AI-assisted analysis, and begin meta-evaluation.

**Tasks:**
1. Implement weighted dimension scoring (calibrate weights from accumulated findings data)
2. Implement AI-assisted smell detection (feature-flagged)
3. Add DORA metrics collection from GitHub API
4. Begin meta-evaluation: signal/noise tracking, outcome tracking (finding → plan → PR)
5. Implement `--compare` mode for cross-run analysis
6. Add CWV tracking from Vercel Analytics
7. Establish quarterly retrospective process
8. Shadow-mode for new criteria before graduation

**What makes this "exploration":**
- Weighted scoring requires enough data to calibrate weights meaningfully — arbitrary weights are worse than no weights
- AI smell detection precision/recall is unknown until tested
- Meta-evaluation requires months of data to be meaningful
- These are all valuable but not essential — the pipeline delivers value without them

### Phase 4: Continuous Architecture Intelligence (Future)

**Goal:** Real-time monitoring and proactive recommendations.

**Potential capabilities:**
- Weekly automated runs (scheduled CI)
- Architecture health dashboard (page in console app)
- Automated ADR generation from PR analysis
- Integration with `/research-team` for architecture investigation
- Package registry with health scores (lightweight Backstage-style)
- Anomaly detection — alert on sudden architecture degradation

## Integration with Existing Systems

### Turborepo

- New tasks: `lint:deps`, `lint:unused`, `arch-eval`
- Leverages `turbo --summarize` for build metrics
- Leverages `turbo boundaries` as supplementary import check
- Respects `^build` dependency for tasks that need compiled output

### CI/CD (GitHub Actions)

- Phase 2: Add `lint:deps` + `turbo boundaries` to PR checks (non-blocking initially, promote to blocking after 2-4 weeks when false positive rate < 15%)
- Phase 3: Add full `arch-eval` to weekly scheduled workflow
- Results posted as PR comments for boundary violations
- Extends existing `ci.yml` pattern (change detection → targeted jobs)

### tRPC / Inngest

- No direct integration in Phases 1-2
- Phase 3+: DORA metrics could track deployment events
- Phase 4: Architecture health could be exposed via internal tRPC route for dashboard

### Existing Quality Gates

- `pnpm lint` — Extended with `lint:deps` (dependency-cruiser) and `lint:unused` (knip)
- `pnpm typecheck` — Metrics extracted for type safety dimension
- `pnpm build:console` — Build time and cache metrics extracted
- New: `pnpm arch-eval` — Dedicated architecture evaluation command

### Research Flow

- Evaluation summaries stored alongside research in `thoughts/shared/`
- Findings feed into `/create_plan` as improvement inputs
- Pipeline changes documented as ADRs
- Meta-evaluation retrospectives (Phase 3+) are research documents

## Design Decisions (Resolved)

These were previously open questions that now have clear answers:

1. **Package location**: `internal/arch-eval/` — follows existing convention alongside `internal/eslint`, `internal/prettier`, `internal/typescript`. The evaluation pipeline is infrastructure tooling, same category as linting configs.

2. **CI blocking behavior**: Start as warnings (non-blocking) for 2-4 weeks. Promote to blocking after false positive rate is established as < 15%. This is standard practice for introducing new lint rules.

3. **ADR scope**: Broad — any significant technical decision gets an ADR. The evaluation pipeline is just one consumer. Start with ADR-000 (adopting ADRs) and ADR-001 (dependency-cruiser for boundaries).

4. **Results storage**: Git, in `thoughts/shared/evaluations/`. Follows existing patterns. Add `.gitkeep` files to empty directories. If results accumulate significantly (>100 files), add a retention policy later.

5. **Primary enforcement tool**: `dependency-cruiser` (stable, mature, full regex rules) with `turbo boundaries` as supplementary fast check (experimental but zero-config and instant).

## Open Questions (Remaining)

These genuinely require user input or more data:

1. **Evaluation frequency**: How often should the full pipeline run?
   - **Recommendation**: `lint:deps` + `turbo boundaries` on every PR; full `arch-eval` weekly or on-demand.
   - Needs user confirmation on CI budget.

2. **Monorepo-specific DORA** (Phase 3): How to meaningfully measure deployment frequency per-package when Vercel deploys via microfrontends?
   - Options: PR merge frequency per package as proxy, Vercel deployment frequency per app, `turbo-ignore` outcomes
   - Needs investigation once Phase 3 begins.

3. **Braintrust integration** (Phase 3): The existing `eval` task and Braintrust configuration suggest AI evaluation infrastructure exists. Should architecture evaluation integrate with Braintrust for AI-assisted analysis tracking, or use its own storage?
   - Needs investigation of current Braintrust usage scope.
