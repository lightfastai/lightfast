---
date: 2026-02-07
reviewer: senior-dev
topic: "Architecture evaluation pipeline review"
tags: [review, architecture, evaluation, pipeline]
status: complete
decision: needs-work
---

# Senior Review: Architecture Evaluation Pipeline Design

## Decision: NEEDS WORK

The design is ambitious and well-researched, but has several issues that need addressing before it's ready for implementation planning. The core pipeline concept is sound, but the design is over-engineered for where Lightfast is today, contains a factual error about `turbo boundaries`, and lacks a concrete enough Phase 1 to actually be implementable in 1-2 days as claimed.

## Issues Found

### Issue 1: `turbo boundaries` Does Not Exist in Lightfast's Turborepo Version

**Severity: High — factual error in design**
**Assign to: codebase + architect**

The architecture design relies heavily on `turbo boundaries` as a core Stage 1 collector and a proposed Turbo task (`arch-eval:boundaries`). However:

- `turbo boundaries` appears nowhere in the actual codebase (confirmed via grep)
- It's not defined as a task in `turbo.json`
- The external research document correctly lists it as a Turborepo feature, but it's a relatively new addition (`turbo boundaries` was introduced in Turborepo 2.4+)
- The codebase deep dive mentions it without verifying it's available in the current Turborepo version

The design needs to either: (a) confirm the installed Turborepo version supports `boundaries` and test it works with the monorepo, or (b) replace `turbo boundaries` with equivalent `dependency-cruiser` rules for import enforcement and undeclared dependency detection. `dependency-cruiser` can already handle both use cases — `turbo boundaries` is a nice-to-have, not a prerequisite.

### Issue 2: Phase 1 Scope is Not Achievable in 1-2 Days

**Severity: Medium — scope underestimation**
**Assign to: architect**

Phase 1 claims "1-2 days" but includes 8 tasks:
1. Create `internal/arch-eval/` package
2. Add `dependency-cruiser` with full layer rules
3. Add `knip` with workspace-aware config
4. Run both tools and capture output
5. Create `pipeline.config.json` with v1.0.0 criteria
6. Write baseline results
7. Create `thoughts/shared/adrs/` with template + ADR-000
8. Add `arch-eval:boundaries` Turbo task

Tasks 1-4 alone are realistic for 1-2 days. But configuring `dependency-cruiser` for a monorepo with 80+ packages, 17 vendor abstractions, and the specific layered architecture rules described is non-trivial — there will be false positives to tune. Adding knip, a pipeline config, ADR bootstrapping, AND Turbo task integration pushes this to 3-5 days minimum.

**Recommendation**: Split Phase 1 into Phase 1a (dependency-cruiser + knip, manual runs, raw output) and Phase 1b (pipeline config, baseline results, ADR system, Turbo tasks). Phase 1a is achievable in 1-2 days. Phase 1b is another 1-2 days.

### Issue 3: Weighted Scoring is Premature

**Severity: Medium — over-engineering**
**Assign to: architect**

The design introduces 7 weighted dimensions with specific percentages (Boundary Integrity 25%, Dependency Health 20%, etc.) and an overall letter-grade scoring system in Phase 2. This is premature for several reasons:

1. **No baseline data exists** — How do you know Boundary Integrity should be 25% vs 15% without seeing the initial results?
2. **Weights are arbitrary** — The percentages aren't derived from any analysis of what actually matters most for Lightfast's specific architecture concerns
3. **Letter grades oversimplify** — A project scoring "B (78)" tells you very little. The individual findings are what matter.
4. **Adds implementation complexity** — The scoring engine with weighted averages, grade boundaries, and trend calculation is a significant chunk of code that provides minimal value in early phases

**Recommendation**: Phase 1-2 should focus on findings only — a list of violations with tier classifications. Scoring can be introduced in Phase 3 once there's enough data to calibrate weights meaningfully. The design already has the finding-level detail (tier 1/2/3); that's sufficient for early phases.

### Issue 4: Three-Version Model is Overcomplicated

**Severity: Low-Medium — unnecessary complexity**
**Assign to: architect**

Three independent versions (`pipeline_version`, `criteria_version`, `schema_version`) create a combinatorial versioning problem. For a team of this size running evaluations weekly:

- Who decides when to bump which version?
- What does `pipeline_version: 1.2.0, criteria_version: 1.3.0, schema_version: 1.1.0` mean in practice?
- The additive-only schema evolution and migration scripts in `internal/arch-eval/migrations/` feel like building for a scale that doesn't exist yet

**Recommendation**: Use a single version for the pipeline (the config file already has a date + git_sha per run). If criteria change, that's a new run with updated config. The config file itself lives in git — git history provides the version trail. Only split versioning if/when the pipeline is consumed by multiple independent systems.

### Issue 5: Meta-Evaluation Framework is Too Abstract for Phase 1-2

**Severity: Low — acceptable if deferred properly**
**Assign to: architect**

The meta-evaluation framework (signal ratio, precision, outcome rate, quarterly retrospectives, A/B testing of methodologies) is academically rigorous but reads more like a research paper than an implementation plan. Specifically:

- "Surprise Rate" (architecture issues found in production that pipeline didn't catch) requires production incident data that Lightfast doesn't systematically collect
- "Developer Satisfaction" survey for a small team is likely informal conversation, not a scored metric
- "A/B testing evaluation methodologies" is impractical with weekly run cadence — you'd need months to get statistical significance
- The triple-loop learning model (finding → question criteria → question evaluation design) is interesting theory but impossible to operationalize mechanically

This is fine as a Phase 3-4 aspiration but should not appear in the architecture design as if it's a core component. Label it clearly as "future exploration" rather than "Stage 5" — the numbering implies it's part of the pipeline flow.

### Issue 6: Missing Practical Detail on dependency-cruiser Configuration

**Severity: Low-Medium — implementation gap**
**Assign to: external + architect**

The design specifies dependency-cruiser rules conceptually but doesn't address practical challenges:

- How to handle the `catalog:` and `workspace:*` resolution in dependency-cruiser (it needs to understand pnpm workspaces)
- Whether dependency-cruiser supports the monorepo structure with 80+ packages efficiently, or if it needs to be scoped per-workspace-group
- No mention of `.dependency-cruiser.cjs` configuration patterns specific to pnpm Turborepo setups
- The vendor abstraction rule ("no direct imports of third-party SDKs that have @vendor/* wrappers") needs careful implementation — which third-party packages map to which vendor wrappers?

The external research mentions dependency-cruiser but doesn't dig into pnpm monorepo-specific configuration patterns.

## What's Working Well

Despite the issues above, the design has strong foundations:

1. **Correct identification of gaps** — The gap analysis (no ADRs, no console CI, no boundary tooling, no metrics) is accurate and well-prioritized
2. **Integration with existing patterns** — Placing evaluation outputs in `thoughts/shared/evaluations/`, using Turbo tasks, and connecting to the `/create_plan` workflow is the right approach
3. **Finding → Plan → PR traceability** — This is the most valuable concept in the entire design. Making evaluation findings actionable through the existing plan/implement/validate workflow is excellent.
4. **Signal-to-noise framework** — The tier 1/2/3 classification is practical and prevents the pipeline from drowning in noise
5. **TypeScript interfaces** — The type definitions are well-thought-out and would serve as good contracts for implementation
6. **Feature flags for incremental rollout** — Smart approach for AI-assisted analysis and other experimental capabilities
7. **`internal/arch-eval/` placement** — Correct location following existing conventions

## Specific Feedback for Each Agent

### Codebase Agent
- **Re-investigate**: What is the installed Turborepo version? Does it support `turbo boundaries`? Run `npx turbo --version` and check the Turborepo changelog.
- **Re-investigate**: Are there any existing dependency-cruiser configs anywhere in the monorepo or `node_modules` that could be referenced?
- **No additional work needed** on the rest — the codebase analysis was thorough and accurate.

### External Agent
- **Re-research**: dependency-cruiser configuration patterns specifically for pnpm workspaces / Turborepo monorepos. Are there real-world examples of 80+ package monorepos using dependency-cruiser? What are the performance characteristics? Are there gotchas with `workspace:*` protocol?
- **Re-research**: `turbo boundaries` — what Turborepo version introduced it, what are its actual capabilities vs dependency-cruiser, and is it production-ready or experimental?
- **No additional work needed** on the rest — excellent breadth and sourcing.

### Architect
Revise the design with these changes:
1. **Remove `turbo boundaries` dependency** from Phase 1-2 (or gate it behind version check). Replace with dependency-cruiser equivalents.
2. **Split Phase 1** into 1a (tools + manual runs) and 1b (config + baseline + ADR + Turbo integration). Re-estimate timelines.
3. **Defer weighted scoring** to Phase 3. Phase 1-2 should output findings only (with tier classification).
4. **Simplify versioning** to single pipeline version tracked via git. Remove three-version model.
5. **Relabel meta-evaluation** as Phase 3-4 exploration, not Stage 5 of the core pipeline.
6. **Add practical dependency-cruiser details** — especially the vendor abstraction mapping and pnpm workspace handling.
7. **Clarify open questions** — the 8 open questions at the end are good but several should be decided by the architect (e.g., #1 package location, #2 CI blocking behavior, #6 results storage). Don't leave design decisions that have clear answers as "open questions."
