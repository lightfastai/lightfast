---
date: 2026-03-08T00:00:00+00:00
researcher: claude-sonnet-4-6
topic: "Biome vs ESLint vs Ultracite speed, and TypeScript typecheck alternatives"
tags: [research, web-analysis, biome, eslint, ultracite, typescript, typecheck, performance, monorepo, turborepo]
status: complete
created_at: 2026-03-08
confidence: high
sources_count: 22
---

# Web Research: Linting & TypeCheck Speed Optimization

**Date**: 2026-03-08
**Topic**: Biome vs ESLint vs Ultracite, and TypeScript `tsc --noEmit` alternatives
**Confidence**: High — based on official benchmarks, Microsoft announcements, and real-world case studies

---

## Research Question

How fast is Biome vs ESLint vs Ultracite? What are the fastest alternatives to `pnpm typecheck` (`tsc --noEmit`)? Optimize to the extreme fullest for a large pnpm/Turborepo monorepo.

---

## Executive Summary

**For linting**: Biome is the clear winner — 15x faster than ESLint for linting, 25x faster for formatting. Ultracite is NOT an independent linter; it's a Biome preset/orchestrator — its speed IS Biome's speed. Switch to Biome unless you depend on `@typescript-eslint` type-aware rules (where Biome v2's coverage is ~75-85%).

**For type checking**: Nothing replaces `tsc --noEmit` today (stc is dead, oxc has no standalone type checker). The winning strategy is **Turborepo remote cache + `tsc --incremental` + `.tsbuildinfo` in outputs** — effectively making typecheck a near-zero-time cache hit on unchanged code. TypeScript 7 (native Go port) is ~10x faster and targeting early 2026 — not production-ready yet.

---

## Part 1: Linting — Biome vs ESLint vs Ultracite

### Official Biome Benchmarks (M1 MacBook Pro)

| Operation | ESLint / Prettier | Biome | Speedup |
|---|---|---|---|
| Lint 1,000 files | 8.3s | 0.55s | **15x** |
| Format 1,000 files | 12.5s | 0.5s | **25x** |
| Format + Lint combined | 20.8s | 0.9s | **23x** |
| Watch mode re-check | 2.1s | 0.08s | **26x** |
| Memory (monorepo) | 2.5GB | 280MB | **89% reduction** |

Source: [biomejs/biome benchmark](https://github.com/biomejs/biome/blob/main/benchmark/README.md), [Biome v2 blog](https://biomejs.dev/blog/biome-v2) (Jun 17, 2025)

### Real-World Developer Benchmarks

| Project | Files | ESLint + Prettier | Biome | Speedup |
|---|---|---|---|---|
| Small Next.js landing page | 45 | 3.2s | 0.4s | 8x |
| Medium e-commerce dashboard | 180 | 12.8s | 1.1s | 11.6x |
| Large React Native app | 450+ | 38.4s | 2.9s | 13.2x |
| Dev.to case study | 312 | 28s | 1.3s | **20x** |
| LinkedIn case study | 10,000 | 45.2s | 0.8s | **56x** |

Source: amillionmonkeys.co.uk, dev.to/@themachinepulse, LinkedIn (Jan 2026)

### Oxlint vs ESLint (Another Rust-based Alternative)

| Tool | Files | Time | Notes |
|---|---|---|---|
| ESLint | 5,360 | ~2m 27s | Single-threaded, type-aware rules |
| Oxlint | 5,360 | ~1.3s | 11 threads, 134 rules |
| Prettier | 6,111 | ~13.9s | — |
| Oxfmt | 6,111 | ~2.1s | 11 threads |

Oxlint ~113x faster than ESLint on this production codebase.
Source: [Reddit r/webdev, March 2026](https://www.reddit.com/r/webdev/comments/1rkmt1k/migrated_from_eslint_prettier_to_oxlint_oxfmt/)

### What is Ultracite?

Ultracite is a **meta-linter preset/orchestrator**, NOT an independent linting engine.

- **Ultracite v6** (Nov 2025): Biome-only backend
- **Ultracite v7** (Jan 2026): Multi-provider (Biome default, can also use ESLint+Prettier+Stylelint or Oxlint+Oxfmt)
- Performance = Biome's performance — there are no independent Ultracite benchmarks
- Reduces configuration overhead by ~95% vs manual ESLint setup
- Users: Vercel, Clerk, ElevenLabs

Source: [Ultracite GitHub](https://github.com/haydenbleasel/ultracite), [aisaasdev.com/tools/ultracite-v7](https://aisaasdev.com/tools/ultracite-v7)

### Biome Limitations

- No ESLint plugin ecosystem compatibility (no `eslint-plugin-import`, custom rules require GritQL in v2)
- Type-aware linting (v2, Jun 2025): uses its own type inference, NOT tsc-backed — covers ~75-85% of `typescript-eslint` type-aware rules
- Single `biome.json` at monorepo root handles all packages (no per-package startup overhead unlike ESLint)

### Linting Decision Matrix

| Requirement | Tool |
|---|---|
| Maximum speed, minimal ecosystem constraints | **Biome** |
| Zero-config preset on top of Biome | **Ultracite v6/v7** (same performance as Biome) |
| Full `@typescript-eslint` type-aware rule coverage | **ESLint** (stay) OR **Oxlint `--type-aware`** alpha |
| Mix fast linting + ESLint type-aware only | **Oxlint first + ESLint type-aware only** |

---

## Part 2: TypeScript Type Checking

### Current Landscape

| Tool | Status | Notes |
|---|---|---|
| `tsc --noEmit` | Production | Baseline, single-threaded, slow |
| `tsc --incremental` | Production | 50-90% faster on rebuilds |
| TypeScript 7 / tsgo (Go port) | Nightly preview | 9-13.5x faster — NOT stable yet |
| stc (Rust) | **ABANDONED** Mar 12, 2025 | Do not use |
| oxc type checker | Does not exist | oxc is a linter only |
| Bun typecheck | Does not exist | Bun strips types, no checking |
| SWC typecheck | Does not exist | Transpile only, zero type checking |

### TypeScript 7 (Native Go Port) — The Future

Microsoft is rewriting TypeScript in Go ("Project Corsa" / `tsgo`). This is the most significant development for TypeScript performance.

**Official Microsoft benchmarks** (announced May 22, 2025):

| Codebase | LOC | tsc (JS) | tsgo (Go) | Speedup |
|---|---|---|---|---|
| VS Code | 1,505,000 | 77.8s | 7.5s | **10.4x** |
| Playwright | 356,000 | 11.1s | 1.1s | **10.1x** |
| TypeORM | 270,000 | 17.5s | 1.3s | **13.5x** |
| date-fns | 104,000 | 6.5s | 0.7s | **9.5x** |
| tRPC | 18,000 | 5.5s | 0.6s | **9.1x** |
| Sentry | — | 133s | 16s | **8.3x** |

**Why it's faster**: 50% from native Go (vs Node.js), 50% from multi-core parallelism via goroutines (current tsc is single-threaded).

**Status**: TypeScript 6.0 Beta (Feb 11, 2026) is the LAST JS-based release. TypeScript 7.0 (Go-based) targets "early 2026." Nightly builds available as `tsgo` CLI.

Source: [MS Blog May 2025](https://devblogs.microsoft.com/typescript/typescript-native-port/), [Dec 2025 Progress](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)

### Available Now: `tsc --incremental` + `.tsbuildinfo`

Enable in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true,
    "assumeChangesOnlyAffectDirectDependencies": true
  }
}
```

- **50-90% faster** on subsequent runs (only re-checks changed files)
- `skipLibCheck: true` alone can save significant time on `.d.ts` processing
- First run is slightly slower (building cache)
- **CRITICAL for Turborepo**: include `.tsbuildinfo` in task `outputs` so remote cache persists it

```json
// turbo.json
{
  "tasks": {
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["**/*.ts", "**/*.tsx", "tsconfig.json", "tsconfig.*.json"],
      "outputs": [".tsbuildinfo", "**/*.tsbuildinfo"]
    }
  }
}
```

### Turborepo Remote Cache — The Ultimate Speedup

With correct configuration, Turborepo makes typecheck a **cache hit** — near-zero time on unchanged code.

Real-world numbers:
- 23 packages: 14 minutes → 2 minutes (Turborepo caching)
- CI time reduced by 85% with remote cache
- 6 patterns cut CI time by 70% (dev.to, March 2026)
- Cache hits: ~100% time savings (just replays logs)

**The key insight**: If no TypeScript files changed in a package, Turborepo's cache hit means `tsc` never runs at all. With `.tsbuildinfo` in outputs, even on a cache miss, `tsc --incremental` only checks what changed since last cache.

### `isolatedDeclarations` (TypeScript 5.5+) — For Declaration Emit

```json
{ "compilerOptions": { "isolatedDeclarations": true } }
```

Not a type-check replacement, but **eliminates sequential type-checking bottleneck for monorepo builds**:

| Approach | Without isolatedDeclarations | With isolatedDeclarations |
|---|---|---|
| Build A → B → C → D | 40s sequential | ~100ms parallel |
| Speedup | 1x | **3-15x** |

Tradeoff: All public exports must have explicit type annotations. Oxc's isolated declarations DTS emit is 40x faster than TSC.

Source: [void.ma guide](https://void.ma/en/publications/typescript-5-5-isolated-declarations-monorepo-performance/)

### Project References + Batch Mode

TypeScript project references (`"composite": true`) allow independent compilation of packages. Nx benchmark using large monorepo:

- Batch mode (single `tsc` process): **1.16x to 7.73x faster** than per-package `tsc` processes
- Avoids expensive per-package `ts.Program` instantiation
- Works with Turborepo `.tsbuildinfo` caching

---

## Optimal Configuration for Lightfast (Turborepo Monorepo)

### Linting Stack

```
Biome → replaces ESLint + Prettier entirely
Ultracite v7 → optional preset layer on top of Biome (same speed)
```

If type-aware linting needed:
```
Oxlint (syntax, 113x faster than ESLint) + ESLint type-aware rules only
```

### TypeCheck Stack (Today)

```
tsc --noEmit --incremental
+ .tsbuildinfo in Turborepo outputs
+ skipLibCheck: true
+ Turborepo remote cache (cache hits = zero time)
```

### TypeCheck Stack (When TS 7 Releases)

```
tsgo --noEmit (10x faster than tsc, built-in parallelism)
```

---

## Trade-off Analysis

### Biome vs ESLint (for Lightfast)

| Factor | ESLint | Biome |
|---|---|---|
| Speed | 1x baseline | 15x faster |
| Memory | 2.5GB (monorepo) | 280MB |
| Config | Complex ecosystem | Single biome.json |
| Type-aware rules | 100% coverage | ~75-85% coverage |
| Plugin ecosystem | Huge | Growing (GritQL) |
| Migration effort | — | Medium (config rewrite) |
| Watch mode | 2.1s | 0.08s |

### TypeCheck Strategy Comparison

| Strategy | Speed | Effort | Status |
|---|---|---|---|
| `tsc --noEmit` (baseline) | 1x | Zero | Production |
| + `--incremental` + tsbuildinfo | 1.5-10x | Low | Production |
| + `skipLibCheck` | +10-30% | Zero | Production |
| + Turborepo cache hit | ~∞ speedup | Config only | Production |
| + Project references | 1.16-7.73x | High | Production |
| `tsgo` (TypeScript 7) | 9-13.5x | Wait | Nightly only |

---

## Recommendations

1. **Switch linting to Biome immediately**: 15-56x faster, 89% less memory. Single `biome.json` at repo root. Ultracite v7 can wrap it for opinionated config with zero extra perf cost.

2. **Enable `tsc --incremental` + `.tsbuildinfo` in Turborepo outputs today**: Lowest-effort, highest-impact change for typecheck. Cache hits make typecheck free. Cache misses become 50-90% faster.

3. **Add `skipLibCheck: true` and `assumeChangesOnlyAffectDirectDependencies: true`**: Zero-cost speed improvements.

4. **Configure Turborepo remote cache for `typecheck` tasks**: The single highest-leverage CI optimization — unchanged packages never re-run typecheck.

5. **Watch TypeScript 7 (tsgo) for GA**: When released (targeting early 2026), upgrading gives 9-13.5x type checking speedup with zero code changes required.

6. **Do NOT use stc** (abandoned March 2025) or expect oxc to replace tsc (it can't — it's a linter).

---

## Open Questions

- Does the current Lightfast `turbo.json` include `.tsbuildinfo` in typecheck outputs?
- Are type-aware linting rules from `@typescript-eslint` in active use? (Determines if Biome v2 covers the gap)
- Is Biome v2's coverage of current ESLint rules sufficient for Lightfast's rule set?

---

## Sources

### Official Documentation & Announcements
- [Biome v2 Blog](https://biomejs.dev/blog/biome-v2) — Biome Team, Jun 17, 2025
- [Biome Benchmark README](https://github.com/biomejs/biome/blob/main/benchmark/README.md) — Biome Team
- [Microsoft TypeScript Native Port](https://devblogs.microsoft.com/typescript/typescript-native-port/) — Anders Hejlsberg, May 22, 2025
- [TypeScript 7 December 2025 Progress](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/) — Microsoft, Dec 2025
- [Oxlint Type-Aware Alpha](https://oxc.rs/blog/2025-12-08-type-aware-alpha) — Oxc Team, Dec 8, 2025
- [Ultracite GitHub](https://github.com/haydenbleasel/ultracite) — Hayden Bleasel
- [stc Abandonment Issue](https://github.com/dudykr/stc/issues/1101) — Oct 2023 → archived Mar 2025

### Performance & Benchmarks
- [Real-world Biome vs ESLint](https://www.amillionmonkeys.co.uk/blog/biome-vs-eslint-prettier) — 8 client projects, M2 MacBook Pro
- [Oxlint vs ESLint Reddit Benchmark](https://www.reddit.com/r/webdev/comments/1rkmt1k/migrated_from_eslint_prettier_to_oxlint_oxfmt/) — March 2026
- [Nx TSC Batch Mode Benchmarks](https://nx.dev/docs/reference/benchmarks/tsc-batch-mode) — Nx Team
- [isolatedDeclarations Performance Guide](https://void.ma/en/publications/typescript-5-5-isolated-declarations-monorepo-performance/) — void.ma

### Turborepo Caching
- [Turborepo TypeScript Guide](https://turborepo.dev/docs/guides/tools/typescript) — Turborepo Docs
- [Turborepo CI Optimization](https://jsmanifest.com) — jsmanifest.com

---

**Last Updated**: 2026-03-08
**Confidence Level**: High — Official benchmarks + real-world case studies from 2025-2026
**Next Steps**: Audit current `turbo.json` typecheck config, evaluate Biome migration feasibility vs current ESLint rule set
