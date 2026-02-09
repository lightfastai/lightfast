# Testing the AI Evaluation Pipeline

This guide walks through the end-to-end testing of the evaluation pipeline, from workspace setup to regression detection.

## Prerequisites

### 1. Environment Variables

Add these to `apps/console/.vercel/.env.development.local`:

```bash
# Eval workspace credentials (from Console UI)
EVAL_WORKSPACE_ID=ws_abc123        # Your eval workspace ID
EVAL_API_KEY=lf_sk_xyz789          # API key for eval workspace

# Braintrust (for experiment tracking)
BRAINTRUST_API_KEY=your_key_here   # Get from https://www.braintrust.dev/

# Console API URL (usually localhost in dev)
CONSOLE_API_URL=http://localhost:3024
```

### 2. Create Eval Workspace

1. Start the Console app: `pnpm dev:console`
2. Navigate to Console UI (http://localhost:3024)
3. Create a new workspace named "Eval Workspace" (or similar)
4. Generate an API key for this workspace
5. Copy the workspace ID and API key to your `.env.development.local`

### 3. Get Braintrust API Key

1. Sign up at https://www.braintrust.dev/
2. Create a new project (e.g., "lightfast-eval")
3. Generate an API key
4. Add to `.env.development.local`

---

## Testing Steps

### Step 1: Inject Test Data (One-Time Setup)

The eval pipeline needs test data in the database. We need to:

1. **Generate corpus from templates**:
   ```bash
   cd packages/console-eval
   pnpm generate-corpus
   ```

   This creates `corpus-events.json` with deterministic test data (GitHub pushes, PRs, Sentry errors).

2. **Inject corpus into eval workspace**:

   **⚠️ TODO**: Need to create injection scripts similar to `packages/console-test-data/src/cli.ts`:

   ```bash
   pnpm inject-corpus
   ```

   This should:
   - Read `corpus-events.json`
   - Trigger Inngest workflows to process events
   - Wait for ingestion to complete (~2-3 minutes)

3. **Verify corpus ingested successfully**:

   **⚠️ TODO**: Create verification script:

   ```bash
   pnpm verify-corpus
   ```

   This should query the database to confirm all events exist as observations.

**Current Status**: These scripts (`generate-corpus`, `inject-corpus`, `verify-corpus`) are referenced in the plan but **NOT YET IMPLEMENTED**. You'll need to create them before testing.

---

### Step 2: Generate Golden Dataset

Once test data is in the database:

```bash
cd packages/console-eval
pnpm generate-dataset
```

**What this does**:
- Loads corpus events from database
- Uses Claude Haiku to generate 60+ diverse queries
- Uses Claude Sonnet to score/filter queries (critic)
- Maps queries to ground truth observation IDs
- Outputs `src/datasets/golden-v1.json` (50 high-quality cases)

**Expected output**: `golden-v1.json` with structure:
```json
{
  "version": "v1",
  "generatedAt": "2026-02-07T...",
  "cases": [
    {
      "id": "case-1",
      "query": "What caused the payment processor to fail?",
      "queryType": "technical",
      "expectedObservationIds": ["obs_123", "obs_456"],
      "complexity": "medium",
      "source": "synthetic",
      ...
    }
  ]
}
```

**Cost**: ~$0.13 (one-time)
**Duration**: 10-15 minutes

---

### Step 3: Run Baseline Eval

Run the evaluation against your search API:

```bash
cd packages/console-eval
pnpm run --tier=retrieval --mode=balanced
```

**What this does**:
- Loads `golden-v1.json`
- Executes 50 search queries via `/v1/search` HTTP API
- Computes retrieval metrics (MRR, Recall@K, Precision@K, NDCG@K)
- Logs experiment to Braintrust
- Saves result to `eval-result-<timestamp>.json`

**Expected output**:
```
Loading dataset: .../golden-v1.json
Loaded 50 eval cases
Running retrieval eval with balanced mode
...
=== Eval Results ===
Duration: 180000ms
Cases: 50

Aggregate Metrics:
  MRR: 0.623
  Recall@5: 0.740
  Recall@10: 0.850
  Precision@5: 0.680
  NDCG@5: 0.715

Braintrust: https://www.braintrust.dev/app/...
```

**Cost**: $0 (no LLM calls, pure retrieval metrics)
**Duration**: 3-5 minutes

Save this result as your baseline:
```bash
mv eval-result-*.json baseline.json
```

---

### Step 4: Run Candidate Eval

Make a code change (or run the same code to test statistical comparison):

```bash
pnpm run --tier=retrieval --mode=balanced
mv eval-result-*.json candidate.json
```

---

### Step 5: Compare Results

Run regression detection:

```bash
pnpm compare -b baseline.json -c candidate.json
```

**What this does**:
- Loads both result files
- Extracts per-case metrics
- Runs paired bootstrap test (10,000 samples)
- Computes p-values, effect sizes, confidence intervals
- Checks for regressions (delta < threshold AND p < 0.05)
- Outputs markdown report

**Expected output**:
```
Loading eval results...
Baseline: 50 cases
Candidate: 50 cases

Running statistical comparison...

Report written to: eval-comparison-report.md

# Eval Comparison Report

| Metric | Baseline | Candidate | Delta | Delta % | p-value | Effect Size | Status |
|--------|----------|-----------|-------|---------|---------|-------------|--------|
| mrr | 0.623 | 0.621 | -0.002 | -0.3% | 0.612 | -0.05 | ⚪ |
| recall@5 | 0.740 | 0.742 | +0.002 | +0.3% | 0.478 | 0.08 | ⚪ |
...

## Summary

- **Regressions**: 0
- **Improvements**: 0
- **No significant change**: 7

✅ No regressions detected
```

**Exit code**:
- `0` = no regressions (CI passes)
- `1` = regressions detected (CI fails)

**Cost**: $0 (pure math)
**Duration**: <10 seconds

---

### Step 6: Test Synthetic Regression

Verify that the regression detection works by artificially degrading performance:

1. **Modify search client** to return empty results for 30% of queries:

   Edit `packages/console-eval/src/clients/search-client.ts`:
   ```typescript
   export async function searchAPI(...) {
     // TEMPORARY: Synthetic regression
     if (Math.random() < 0.3) {
       return { results: [], total: 0 };
     }

     // Normal execution...
   }
   ```

2. **Run degraded eval**:
   ```bash
   pnpm run --tier=retrieval --mode=balanced
   mv eval-result-*.json degraded.json
   ```

3. **Compare with baseline**:
   ```bash
   pnpm compare -b baseline.json -c degraded.json
   ```

**Expected output**:
```
⚠️ Regressions Detected

- **mrr**: -18.5% drop (p=0.001)
- **recall@5**: -22.3% drop (p=0.000)

❌ Regressions detected!
```

**Exit code**: `1` (regression detected)

4. **Revert the change** after testing

---

## What's NOT Implemented Yet

These are mentioned in the plan but not created during Phase 1-3:

### Missing CLI Scripts

1. **`pnpm generate-corpus`** - Generate corpus-events.json from templates
2. **`pnpm inject-corpus`** - Inject corpus into database via Inngest
3. **`pnpm verify-corpus`** - Verify all events ingested successfully

These need to be built before end-to-end testing is possible.

### Missing Files

- No SETUP.md documentation yet
- No corpus injection scripts in `src/cli/`

---

## Troubleshooting

### "Cannot find module '@repo/console-reserved-names'"

This is an upstream dependency issue in `console-validation`. It doesn't affect the eval package build, only typecheck. Safe to ignore for now.

### "Database query timeout"

Ensure:
1. Console dev server is running: `pnpm dev:console`
2. Database is accessible
3. Eval workspace exists and has data

### "Search API error: 401"

Check:
1. `EVAL_API_KEY` is set correctly
2. API key belongs to the eval workspace
3. `EVAL_WORKSPACE_ID` matches the workspace

### "Braintrust API error"

Check:
1. `BRAINTRUST_API_KEY` is set
2. Key is valid (test at https://www.braintrust.dev/)
3. Project exists in Braintrust

---

## Next Steps

To make this fully testable:

1. **Create corpus injection scripts** (highest priority):
   - `src/cli/generate-corpus.ts`
   - `src/cli/inject-corpus.ts`
   - `src/cli/verify-corpus.ts`

2. **Add package.json scripts**:
   ```json
   {
     "generate-corpus": "pnpm with-env tsx src/cli/generate-corpus.ts",
     "inject-corpus": "pnpm with-env tsx src/cli/inject-corpus.ts",
     "verify-corpus": "pnpm with-env tsx src/cli/verify-corpus.ts"
   }
   ```

3. **Test end-to-end** following this guide

4. **Document in SETUP.md** for future developers
