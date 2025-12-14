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
| `-s, --scenario` | Scenario: `security`, `performance`, `balanced`, `stress` |
| `-c, --count` | Event count for balanced/stress scenarios |
| `--skip-wait` | Don't wait for workflow completion |
| `--skip-verify` | Don't run verification after injection |

## Programmatic Usage

```typescript
import {
  securityScenario,
  performanceScenario,
  balancedScenario,
  stressScenario,
  triggerObservationCapture,
  waitForCapture,
  verify,
  printReport,
} from '@repo/console-test-data';

// 1. Generate events
const events = securityScenario();  // or performanceScenario(), etc.

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

## Scenarios

| Scenario | Events | Description |
|----------|--------|-------------|
| `securityScenario()` | 3 | OAuth PR, API keys issue, credential rotation |
| `performanceScenario()` | 3 | Redis caching PR, dashboard issue, deployment |
| `balancedScenario(n)` | n | Shuffled mix from all scenarios |
| `stressScenario(n)` | n | Repeated/varied events for load testing |

## Event Builders

Build individual `SourceEvent` objects matching webhook transformer output:

```typescript
import { githubPush, githubPR, githubIssue, vercelDeployment } from '@repo/console-test-data';

const pushEvent = githubPush({
  repo: 'org/repo',
  branch: 'main',
  commitMessage: 'fix: resolve bug',
  author: 'alice',
  daysAgo: 1,
});

const prEvent = githubPR({
  repo: 'org/repo',
  prNumber: 123,
  title: 'feat: add feature',
  body: 'Description here',
  action: 'merged',
  author: 'bob',
  labels: ['feature'],
});

const issueEvent = githubIssue({
  repo: 'org/repo',
  issueNumber: 456,
  title: 'Bug: something broken',
  body: 'Steps to reproduce...',
  action: 'opened',
  author: 'charlie',
  labels: ['bug'],
});

const deployEvent = vercelDeployment({
  projectName: 'my-app',
  event: 'deployment.succeeded',
  branch: 'main',
  environment: 'production',
});
```

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
src/
├── events/           # SourceEvent builders
│   ├── github.ts     # githubPush, githubPR, githubIssue
│   ├── vercel.ts     # vercelDeployment
│   └── index.ts
├── scenarios/        # Pre-built event sets
│   ├── security.ts
│   ├── performance.ts
│   └── index.ts      # balancedScenario, stressScenario
├── trigger/          # Workflow triggering
│   ├── trigger.ts    # triggerObservationCapture
│   ├── wait.ts       # waitForCapture
│   └── index.ts
├── verifier/         # Post-workflow verification
│   ├── verifier.ts   # verify, printReport
│   └── index.ts
├── cli/
│   ├── inject.ts
│   └── verify.ts
├── types.ts
└── index.ts
```
