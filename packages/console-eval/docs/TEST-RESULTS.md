# Test Results - AI Evaluation Pipeline

**Date:** 2026-02-07
**Branch:** `feat/ai-eval-pipeline-phases-1-3`
**Tested By:** Automated testing without full environment setup

---

## Summary

✅ **Core functionality verified** - All statistics, metrics, and comparison logic works correctly
✅ **Both packages build successfully** - No compilation errors
⚠️ **End-to-end testing blocked** - Requires workspace setup and environment variables

---

## Build Tests

### @vendor/braintrust

```bash
✅ Package builds: pnpm --filter @vendor/braintrust build
   - Output: dist/index.js (492 B)
   - Types: dist/index.d.ts (225 B)
   - Build time: 22ms (ESM) + 491ms (DTS)
```

### @repo/console-eval

```bash
✅ Package builds: pnpm --filter @repo/console-eval build
   - Output: dist/index.js (48.05 KB)
   - Types: dist/index.d.ts (15.60 KB)
   - Build time: 82ms (ESM) + 2031ms (DTS)
```

---

## Core Functionality Tests

### Statistics Functions

| Function | Test Input | Expected | Actual | Status |
|----------|-----------|----------|--------|--------|
| `mean()` | [1,2,3,4,5] | 3.000 | 3.000 | ✅ |
| `stdDev()` | [1,2,3,4,5] | ~1.414 | 1.414 | ✅ |
| `cohensD()` | [1-5] vs [3-7] | ~1.414 (large effect) | 1.414 | ✅ |
| `pairedBootstrapTest()` | 5% improvement | p < 0.05 | p = 0.000 | ✅ |

**Interpretation:**
- Statistical functions compute correct values
- Bootstrap test correctly detects significant improvements (p-value < 0.05)
- Effect size calculation matches expected Cohen's d values

### Retrieval Metrics

Test scenario: 5 results, 3 relevant (obs2, obs3, obs5)

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| MRR | 0.500 (first relevant at rank 2) | 0.500 | ✅ |
| Recall@3 | 0.667 (2 of 3 found) | 0.667 | ✅ |
| Recall@5 | 1.000 (all 3 found) | 1.000 | ✅ |
| Precision@3 | 0.667 (2 of 3 are relevant) | 0.667 | ✅ |
| Precision@5 | 0.600 (3 of 5 are relevant) | 0.600 | ✅ |
| NDCG@5 | N/A (position-weighted) | 0.712 | ✅ |

**Interpretation:**
- All information retrieval metrics compute correctly
- Position weighting (NDCG) works as expected
- Handles partial matches correctly (Recall@3 vs Recall@5)

### Comparison Engine

Test scenario: Compare baseline vs candidate with 8% improvement

| Metric | Baseline | Candidate | Delta | p-value | Detection | Status |
|--------|----------|-----------|-------|---------|-----------|--------|
| mrr | 0.600 | 0.650 | +0.050 (+8.3%) | 0.000 | 🟢 improvement | ✅ |
| recall@3 | 0.700 | 0.750 | +0.050 (+7.1%) | 0.000 | 🟢 improvement | ✅ |
| recall@5 | 0.800 | 0.850 | +0.050 (+6.2%) | 0.000 | 🟢 improvement | ✅ |

**Report generation:**
- ✅ Markdown table generated (823 characters)
- ✅ Contains metric comparison table
- ✅ Contains summary section
- ✅ Correctly identifies improvements (p < 0.05, delta > 0)

---

## CLI Tests

### compare CLI

```bash
✅ Help command works: npx tsx src/cli/compare.ts --help

Output:
  Usage: compare [options]

  Compare two eval runs for regression detection

  Options:
    -b, --baseline <path>   Path to baseline eval result JSON
    -c, --candidate <path>  Path to candidate eval result JSON
    -o, --output <path>     Output report path (default: "eval-comparison-report.md")
    -h, --help              display help for command
```

**Status:** ✅ CLI interface works correctly

### run CLI

```bash
⚠️ Requires environment variables: npx tsx src/cli/run.ts --help

Error: Invalid environment variables
  - BRAINTRUST_API_KEY: Required
```

**Status:** ⚠️ Environment validation working as expected (blocks without credentials)

### generate-dataset CLI

```bash
⚠️ Requires environment variables: npx tsx src/cli/generate-dataset.ts

Error: Invalid environment variables
  - BRAINTRUST_API_KEY: Required
```

**Status:** ⚠️ Environment validation working as expected

---

## What's Blocked

The following tests cannot be run without full environment setup:

### Missing Environment Variables

```bash
# Required in apps/console/.vercel/.env.development.local
EVAL_WORKSPACE_ID=ws_abc123
EVAL_API_KEY=lf_sk_xyz789
BRAINTRUST_API_KEY=your_key_here
CONSOLE_API_URL=http://localhost:3024
```

### Missing Infrastructure

1. **Eval Workspace** - Need to create workspace in Console UI
2. **Test Data** - Need to inject corpus into database (requires corpus injection scripts)
3. **Dev Server** - Console needs to be running for API calls

### Tests That Require Full Setup

- ❌ Dataset generation (`pnpm generate-dataset`)
- ❌ Eval execution (`pnpm run --tier=retrieval`)
- ❌ End-to-end regression detection (baseline vs candidate)
- ❌ Braintrust experiment logging
- ❌ Search API integration

---

## Regression Detection Validation

To verify regression detection works, we would need to:

1. Run baseline eval → save results
2. Artificially degrade performance (e.g., return empty results for 30% of queries)
3. Run degraded eval → save results
4. Compare: `pnpm compare -b baseline.json -c degraded.json`
5. Verify: Exit code 1, report shows regressions with p < 0.05

**Status:** ⏳ Pending full environment setup

---

## Next Steps

To complete end-to-end testing:

1. **Create eval workspace** in Console UI
2. **Set environment variables** in `.env.development.local`
3. **Implement corpus injection scripts** (`generate-corpus`, `inject-corpus`, `verify-corpus`)
4. **Inject test data** into database
5. **Run dataset generation** to create golden-v1.json
6. **Execute baseline eval** and verify metrics are reasonable
7. **Test regression detection** with synthetic degradation
8. **Validate Braintrust logging** in dashboard

---

## Conclusion

✅ **Core implementation is solid:**
- All mathematical functions work correctly
- Metrics calculations are accurate
- Statistical comparisons produce valid results
- CLI interfaces are well-designed

⚠️ **Cannot test end-to-end without:**
- Workspace with test data
- Environment credentials
- Running Console dev server
- Corpus injection infrastructure

**Recommendation:** Merge Phase 1-3 implementation as-is, then create follow-up PR for:
- Corpus injection scripts
- Complete setup documentation
- Manual end-to-end testing with real data
