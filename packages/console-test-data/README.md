# @repo/console-test-data

Workflow-driven test data generation for neural memory E2E testing.

**Key Design**: Test data uses **raw webhook payloads** (GitHub, Vercel, Sentry, Linear format) that flow through production transformers before being injected via the real Inngest workflow (`apps-console/neural/observation.capture`). This ensures tests exercise the full production pipeline including webhook transformation, significance scoring, entity extraction, multi-view embeddings, cluster assignment, and actor resolution.

## Prerequisites

Inngest dev server must be running:

```bash
pnpm dev:console  # Starts Inngest via ngrok
```

## CLI Usage

```bash
# Inject sandbox-1 scenario (18 events - production incident)
pnpm --filter @repo/console-test-data inject -- -w <workspace_id>

# Inject a specific scenario
pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s sandbox-2

# Inject balanced mix
pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s balanced -c 10

# Stress test (100 events)
pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s stress -c 100

# Reset demo environment and inject fresh data
pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i

# Verify all datasets load correctly
pnpm --filter @repo/console-test-data verify

# Verify a specific dataset
pnpm --filter @repo/console-test-data verify sandbox-1
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-w, --workspace` | Workspace ID (required for inject/reset-demo) |
| `-s, --scenario` | Dataset name or path (default: `sandbox-1`) |
| `-c, --count` | Event count for balanced/stress scenarios |
| `--dry-run` | Show what would be done without executing (reset-demo) |

## Programmatic Usage

```typescript
import {
  loadDataset,
  listDatasets,
  balancedScenario,
  stressScenario,
  triggerObservationCapture,
} from '@repo/console-test-data';

// 1. Load events from a dataset (webhooks are transformed to SourceEvents)
const dataset = loadDataset('sandbox-1');
const events = dataset.events;

// Or use scenario helpers
const balanced = balancedScenario(10);  // Shuffled mix from all datasets
const stress = stressScenario(100);     // Repeated events for load testing

// 2. Trigger workflow
const triggerResult = await triggerObservationCapture(events, {
  workspaceId: 'xxx',
  onProgress: (current, total) => console.log(`${current}/${total}`),
});
```

## Datasets

Test data is defined as **raw webhook payloads** in JSON files in the `datasets/` directory. These webhooks flow through production transformers (GitHub, Vercel) and mock transformers (Sentry, Linear).

All datasets use the `lightfastai/lightfast` repository with real developer names, real dates (Dec 2025 - Feb 2026), and realistic scenarios derived from actual Lightfast architecture.

| Dataset | Webhooks | Sources | Description |
|---------|----------|---------|-------------|
| `sandbox-1` | 18 | GitHub, Vercel, Sentry, Linear | Production incident: Pinecone embedding dimension mismatch cascade |
| `sandbox-2` | 20 | GitHub, Vercel, Linear | Feature development: Answer API + workspace rework (PR #352/#353) |
| `sandbox-3` | 23 | GitHub, Vercel, Sentry, Linear | Infrastructure, security & observability (Dec 2025 - Feb 2026) |
| `balanced` | n | Mixed | Shuffled mix from all datasets |
| `stress` | n | Mixed | Repeated/varied events for load testing |

### Creating Custom Datasets

Create a JSON file following the schema in `datasets/webhook-schema.json`. Datasets contain **raw webhook payloads** for 4 supported sources:

```json
{
  "$schema": "./webhook-schema.json",
  "name": "my-dataset",
  "description": "Custom test webhooks",
  "webhooks": [
    {
      "source": "github",
      "eventType": "push",
      "payload": { "ref": "refs/heads/main", "commits": [...], ... }
    },
    {
      "source": "vercel",
      "eventType": "deployment.succeeded",
      "payload": { "id": "hook_123", "type": "deployment.succeeded", "createdAt": 1704988800000, "payload": { ... } }
    },
    {
      "source": "sentry",
      "eventType": "issue.created",
      "payload": { "action": "created", "data": { "issue": { ... } }, "installation": { ... }, "actor": { ... } }
    },
    {
      "source": "linear",
      "eventType": "Issue",
      "payload": { "action": "create", "type": "Issue", "data": { ... }, "organizationId": "...", ... }
    }
  ]
}
```

### Supported Event Types

**GitHub** (production transformers from `@repo/console-webhooks`):
- `push` - Code pushes to branches
- `pull_request` - PR opened, closed, merged, etc.
- `issues` - Issue opened, closed, labeled, etc.
- `release` - Release published, created
- `discussion` - Discussion created, answered

**Vercel** (production transformer from `@repo/console-webhooks`):
- `deployment.created` - Deployment started
- `deployment.succeeded` - Deployment completed successfully
- `deployment.ready` - Deployment ready to serve traffic
- `deployment.canceled` - Deployment canceled
- `deployment.error` - Deployment failed

**Sentry** (mock transformer):
- `issue.created`, `issue.resolved`, `issue.assigned`, `issue.ignored` - Issue state changes
- `error` - Individual error events
- `event_alert` - Alert rule triggers
- `metric_alert` - Metric-based alerts

**Linear** (mock transformer):
- `Issue` - Issue created, updated, deleted
- `Comment` - Comment created, updated, deleted
- `Project` - Project state changes
- `Cycle` - Sprint/cycle updates
- `ProjectUpdate` - Project status updates

## Architecture

```
Raw Webhook  -->  transformWebhook()  -->  SourceEvent  -->  inngest.send()  -->  observation.capture
     |                  |
     |          ┌───────┴───────┐
     |          |               |
  4 sources   Production    Mock Transformers
              (GitHub,      (Sentry, Linear)
              Vercel)
```

The `transformWebhook()` function routes by source:
- **GitHub/Vercel**: Production transformers from `@repo/console-webhooks`
- **Sentry/Linear**: Mock transformers in `src/transformers/`

All events get `:test:N` suffix on `sourceId` and `testData: true` in metadata.

## Package Structure

```
packages/console-test-data/
├── datasets/                  # JSON dataset files (raw webhook format)
│   ├── webhook-schema.json    # JSON Schema for validation
│   ├── sandbox-1.json         # Production incident (Sentry + Linear + GitHub + Vercel)
│   ├── sandbox-2.json         # Feature development (GitHub + Vercel + Linear)
│   └── sandbox-3.json         # Infrastructure & security (GitHub + Vercel + Sentry + Linear)
├── src/
│   ├── loader/                # Webhook dataset loading + transformation
│   │   ├── index.ts           # loadDataset, listDatasets, balancedScenario, stressScenario
│   │   └── transform.ts       # transformWebhook (routes to production + mock transformers)
│   ├── transformers/          # Mock transformers for non-production sources
│   │   ├── sentry.ts          # Sentry webhook → SourceEvent
│   │   ├── linear.ts          # Linear webhook → SourceEvent
│   │   └── index.ts
│   ├── trigger/               # Workflow triggering
│   │   ├── trigger.ts         # triggerObservationCapture
│   │   └── index.ts
│   ├── cli/
│   │   ├── inject.ts          # CLI for injecting test data
│   │   ├── reset-demo.ts      # CLI for resetting demo environment
│   │   └── verify-datasets.ts # Pre-flight dataset verification
│   └── index.ts
└── package.json
```
