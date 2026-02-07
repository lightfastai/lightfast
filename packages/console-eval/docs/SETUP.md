# Eval Workspace Setup

## Prerequisites

1. Create a dedicated eval workspace in the Console UI
2. Generate an API key for the workspace
3. Note the workspace ID and API key

## Environment Variables

Add to `apps/console/.vercel/.env.development.local`:

```bash
# Eval workspace credentials
EVAL_WORKSPACE_ID=ws_abc123
EVAL_API_KEY=lf_sk_xyz789
```

## One-Time Test Data Injection

Inject deterministic corpus into eval workspace:

```bash
cd packages/console-eval
pnpm generate-corpus     # Generates webhooks from templates
pnpm inject-corpus       # Triggers Inngest ingestion (uses existing pnpm inject pattern)
```

Wait for ingestion to complete (~2-3 minutes for 30 events). Verify:

```bash
pnpm verify-corpus       # Checks all events ingested successfully
```

## Generate Golden Dataset

After corpus is fully ingested:

```bash
pnpm generate-dataset    # Runs full LLM pipeline, outputs golden-v1.json
```

The dataset is now ready for eval runs.
