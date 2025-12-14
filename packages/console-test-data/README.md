# @repo/console-test-data

Workflow-driven test data generation for neural memory E2E testing.

**Key Design**: Test data is injected via the real Inngest workflow (`apps-console/neural/observation.capture`), ensuring tests exercise the full production pipeline including significance scoring, entity extraction, multi-view embeddings, cluster assignment, and actor resolution.

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

// 1. Load events from a dataset
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

Test data is defined in JSON files in the `datasets/` directory.

| Dataset | Events | Description |
|---------|--------|-------------|
| `security` | 3 | OAuth PR, API keys issue, credential rotation |
| `performance` | 3 | Redis caching PR, dashboard issue, deployment |
| `balanced` | n | Shuffled mix from all datasets |
| `stress` | n | Repeated/varied events for load testing |

### Creating Custom Datasets

Create a JSON file following the schema in `datasets/schema.json`:

```json
{
  "$schema": "./schema.json",
  "name": "my-dataset",
  "description": "Custom test events",
  "events": [
    {
      "source": "github",
      "sourceType": "push",
      "sourceId": "push:org/repo:abc123",
      "title": "[Push] fix: resolve bug",
      "body": "Fixed the bug\n\nDetails here...",
      "actor": { "id": "github:alice", "name": "alice" },
      "occurredAt": "-1d",
      "references": [
        { "type": "commit", "id": "abc123" },
        { "type": "branch", "id": "main" }
      ],
      "metadata": {
        "testData": true,
        "repoFullName": "org/repo"
      }
    }
  ]
}
```

**Relative timestamps**: Use `-Nd` (days), `-Nh` (hours), `-Nw` (weeks), `-Nm` (months):
- `-2d` = 2 days ago
- `-1w` = 1 week ago
- `-3h` = 3 hours ago

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
SourceEvent → inngest.send() → observation.capture workflow
                                      ↓
                              Significance Gate
                                      ↓
                    ┌─────────────────┼─────────────────┐
                    ↓                 ↓                 ↓
               Classify          Embed (3x)        Extract Entities
                    ↓                 ↓                 ↓
                    └─────────────────┼─────────────────┘
                                      ↓
                              Cluster Assignment
                                      ↓
                              Actor Resolution
                                      ↓
                                   Store
```

## Package Structure

```
packages/console-test-data/
├── datasets/           # JSON dataset files
│   ├── schema.json     # JSON Schema for validation
│   ├── security.json   # Security-focused events
│   └── performance.json # Performance-focused events
├── src/
│   ├── loader/         # JSON dataset loading
│   │   └── index.ts    # loadDataset, listDatasets, balancedScenario, stressScenario
│   ├── trigger/        # Workflow triggering
│   │   ├── trigger.ts  # triggerObservationCapture
│   │   ├── wait.ts     # waitForCapture
│   │   └── index.ts
│   ├── verifier/       # Post-workflow verification
│   │   ├── verifier.ts # verify, printReport
│   │   └── index.ts
│   ├── cli/
│   │   ├── inject.ts
│   │   └── verify.ts
│   └── index.ts
└── package.json
```
