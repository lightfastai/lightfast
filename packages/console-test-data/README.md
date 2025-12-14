# @repo/console-test-data

Workflow-driven test data generation for neural memory E2E testing.

**Key Design**: Test data uses **raw webhook payloads** (GitHub/Vercel format) that flow through production transformers before being injected via the real Inngest workflow (`apps-console/neural/observation.capture`). This ensures tests exercise the full production pipeline including webhook transformation, significance scoring, entity extraction, multi-view embeddings, cluster assignment, and actor resolution.

## Prerequisites

Inngest dev server must be running:

```bash
pnpm dev:console  # Starts Inngest via ngrok
```

## CLI Usage

```bash
# Inject security scenario (3 events)
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> \
  -o <org_id> \
  -i <pinecone_index>

# Inject performance scenario
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> -o <org_id> -i <index> \
  -s performance

# Inject balanced mix
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> -o <org_id> -i <index> \
  -s balanced -c 6

# Stress test (100 events)
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> -o <org_id> -i <index> \
  -s stress -c 100 --skip-verify

# Use a custom dataset
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> -o <org_id> -i <index> \
  -s /path/to/custom.json

# Verify data
pnpm --filter @repo/console-test-data verify -- \
  -w <workspace_id> -o <org_id> -i <index>
```

### CLI Options

| Option | Description |
|--------|-------------|
| `-w, --workspace` | Workspace ID (required) |
| `-o, --org` | Clerk Org ID (required) |
| `-i, --index` | Pinecone index name (required) |
| `-s, --scenario` | Dataset name or path (default: `security`) |
| `-c, --count` | Event count for balanced/stress scenarios |
| `--skip-wait` | Don't wait for workflow completion |
| `--skip-verify` | Don't run verification after injection |

## Programmatic Usage

```typescript
import {
  loadDataset,
  listDatasets,
  balancedScenario,
  stressScenario,
  triggerObservationCapture,
  waitForCapture,
  verify,
  printReport,
} from '@repo/console-test-data';

// 1. Load events from a dataset (webhooks are transformed to SourceEvents)
const dataset = loadDataset('security');  // or 'performance', or path to JSON
const events = dataset.events;

// Or use scenario helpers
const balanced = balancedScenario(6);  // Shuffled mix from all datasets
const stress = stressScenario(100);    // Repeated events for load testing

// 2. Trigger workflow
const triggerResult = await triggerObservationCapture(events, {
  workspaceId: 'xxx',
  onProgress: (current, total) => console.log(`${current}/${total}`),
});

// 3. Wait for completion
const waitResult = await waitForCapture({
  workspaceId: 'xxx',
  sourceIds: triggerResult.sourceIds,
  timeoutMs: 120000,
});

// 4. Verify results
const result = await verify({
  workspaceId: 'xxx',
  clerkOrgId: 'org_xxx',
  indexName: 'my-index',
});
printReport(result);
```

## Datasets

Test data is defined as **raw webhook payloads** in JSON files in the `datasets/` directory. These webhooks flow through the same production transformers used in real webhook handlers.

| Dataset | Webhooks | Description |
|---------|----------|-------------|
| `security` | 3 | OAuth PR (merged), API keys issue (opened), credential rotation push |
| `performance` | 3 | Redis caching PR (merged), dashboard issue (opened), Vercel deployment |
| `balanced` | n | Shuffled mix from all datasets |
| `stress` | n | Repeated/varied events for load testing |

### Creating Custom Datasets

Create a JSON file following the schema in `datasets/webhook-schema.json`. Datasets contain **raw webhook payloads** that match GitHub/Vercel webhook formats:

```json
{
  "$schema": "./webhook-schema.json",
  "name": "my-dataset",
  "description": "Custom test webhooks",
  "webhooks": [
    {
      "source": "github",
      "eventType": "push",
      "payload": {
        "ref": "refs/heads/main",
        "before": "aaa111bbb222",
        "after": "def789abc012",
        "created": false,
        "deleted": false,
        "forced": false,
        "commits": [
          {
            "id": "def789abc012",
            "message": "fix: resolve bug",
            "timestamp": "2024-01-12T16:00:00Z",
            "author": {
              "name": "alice",
              "email": "alice@example.com",
              "username": "alice"
            },
            "added": [],
            "removed": [],
            "modified": ["src/index.ts"]
          }
        ],
        "head_commit": {
          "id": "def789abc012",
          "message": "fix: resolve bug",
          "timestamp": "2024-01-12T16:00:00Z",
          "author": {
            "name": "alice",
            "email": "alice@example.com",
            "username": "alice"
          },
          "added": [],
          "removed": [],
          "modified": ["src/index.ts"]
        },
        "repository": {
          "id": 123456,
          "name": "repo",
          "full_name": "org/repo",
          "html_url": "https://github.com/org/repo"
        },
        "pusher": {
          "name": "alice",
          "email": "alice@example.com"
        },
        "sender": {
          "login": "alice",
          "id": 12345
        }
      }
    },
    {
      "source": "vercel",
      "eventType": "deployment.succeeded",
      "payload": {
        "id": "hook_123",
        "type": "deployment.succeeded",
        "createdAt": 1704988800000,
        "payload": {
          "deployment": {
            "id": "dpl_abc123",
            "name": "my-app",
            "url": "my-app.vercel.app",
            "meta": {
              "githubCommitSha": "abc123",
              "githubCommitRef": "main",
              "githubCommitMessage": "feat: add feature",
              "githubCommitAuthorName": "alice"
            }
          },
          "project": {
            "id": "prj_123",
            "name": "my-app"
          }
        }
      }
    }
  ]
}
```

### Supported Event Types

**GitHub:**
- `push` - Code pushes to branches
- `pull_request` - PR opened, closed, merged, etc.
- `issues` - Issue opened, closed, labeled, etc.
- `release` - Release published, created
- `discussion` - Discussion created, answered

**Vercel:**
- `deployment.created` - Deployment started
- `deployment.succeeded` - Deployment completed successfully
- `deployment.ready` - Deployment ready to serve traffic
- `deployment.canceled` - Deployment canceled
- `deployment.error` - Deployment failed

## Verification

The verifier checks post-workflow state:

```typescript
const result = await verify({ workspaceId, clerkOrgId, indexName });

// result.database
//   .observations    - Total observation count
//   .entities        - Extracted entity count
//   .clusters        - Cluster count
//   .actorProfiles   - Actor profile count
//   .observationsByType
//   .entitiesByCategory

// result.pinecone
//   .titleVectors    - Title view embeddings
//   .contentVectors  - Content view embeddings
//   .summaryVectors  - Summary view embeddings

// result.health
//   .multiViewComplete  - All observations have 3 embeddings
//   .entitiesExtracted  - At least some entities found
//   .clustersAssigned   - Observations assigned to clusters
```

## Architecture

```
Raw Webhook → transformWebhook() → SourceEvent → inngest.send() → observation.capture
     ↑                                                                    ↓
 (GitHub/Vercel format)                                          Significance Gate
                                                                         ↓
                                                   ┌─────────────────────┼─────────────────────┐
                                                   ↓                     ↓                     ↓
                                              Classify              Embed (3x)         Extract Entities
                                                   ↓                     ↓                     ↓
                                                   └─────────────────────┼─────────────────────┘
                                                                         ↓
                                                                 Cluster Assignment
                                                                         ↓
                                                                 Actor Resolution
                                                                         ↓
                                                                      Store
```

The `transformWebhook()` function uses the same production transformers from `@repo/console-webhooks`:
- `transformGitHubPush`, `transformGitHubPullRequest`, `transformGitHubIssue`, etc.
- `transformVercelDeployment`

This ensures test data exercises the exact same transformation logic as production webhooks.

## Package Structure

```
packages/console-test-data/
├── datasets/               # JSON dataset files (raw webhook format)
│   ├── webhook-schema.json # JSON Schema for validation
│   ├── security.json       # Security-focused webhooks
│   └── performance.json    # Performance-focused webhooks
├── src/
│   ├── loader/             # Webhook dataset loading + transformation
│   │   ├── index.ts        # loadDataset, listDatasets, balancedScenario, stressScenario
│   │   └── transform.ts    # transformWebhook (routes to production transformers)
│   ├── trigger/            # Workflow triggering
│   │   ├── trigger.ts      # triggerObservationCapture
│   │   ├── wait.ts         # waitForCapture
│   │   └── index.ts
│   ├── verifier/           # Post-workflow verification
│   │   ├── verifier.ts     # verify, printReport
│   │   └── index.ts
│   ├── cli/
│   │   ├── inject.ts
│   │   └── verify.ts
│   └── index.ts
└── package.json
```
