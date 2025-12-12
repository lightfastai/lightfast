# @repo/console-test-data

Test data generation and injection for neural memory E2E testing.

## Installation

This package is part of the Lightfast monorepo and is available as a workspace dependency.

```json
{
  "dependencies": {
    "@repo/console-test-data": "workspace:*"
  }
}
```

## Quick Start

```typescript
import {
  ObservationFactory,
  TestDataInjector,
  scenarios,
  factory
} from '@repo/console-test-data';

// Inject pre-built scenario
const injector = new TestDataInjector({
  workspaceId: 'xxx',
  clerkOrgId: 'org_xxx'
});
await injector.injectScenario(scenarios.day2Retrieval);
```

## CLI Usage

```bash
# Inject Day 2 retrieval test data (20 observations)
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> \
  -o <org_id>

# Inject stress test (500 observations)
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> -o <org_id> \
  -s stress-medium

# Inject custom count
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> -o <org_id> \
  -s balanced -c 1000

# Verify data in DB and Pinecone
pnpm --filter @repo/console-test-data verify -- \
  -w <workspace_id> -o <org_id>

# Clean up test data
pnpm --filter @repo/console-test-data clean -- \
  -w <workspace_id> -o <org_id> --confirm
```

## API

### ObservationFactory

Fluent builder for generating test observations.

```typescript
const observations = new ObservationFactory()
  .withActors(['alice', 'bob', 'charlie'])  // Set actors
  .withDateRange(30)                         // Last 30 days
  .security(20)                              // 20 security observations
  .performance(20)                           // 20 performance observations
  .bugfixes(20)                              // 20 bug fix observations
  .features(20)                              // 20 feature observations
  .devops(20)                                // 20 devops observations
  .buildShuffled();                          // Build with random order
```

### Quick Factory Methods

```typescript
import { factory } from '@repo/console-test-data';

factory.small();              // 20 balanced observations
factory.medium();             // 100 balanced observations
factory.large();              // 500 balanced observations
factory.stress(1000);         // 1000 balanced observations
factory.securityFocused(50);  // 60% security, 20% bugfixes, 20% features
factory.performanceFocused(50); // 60% performance, 20% bugfixes, 20% devops
```

### TestDataInjector

Handles injection into database and Pinecone.

```typescript
const injector = new TestDataInjector({
  workspaceId: 'xxx',
  clerkOrgId: 'org_xxx'
});

// Inject observations
const result = await injector.inject(observations, {
  dryRun: false,           // Set true to preview
  batchSize: 100,          // Pinecone batch size
  clearExisting: false,    // Clear existing data first
  sourceIdPrefix: 'test',  // Prefix for deduplication
  onProgress: (current, total, obs) => {
    console.log(`${current}/${total}: ${obs.title}`);
  }
});

// Inject pre-built scenario
await injector.injectScenario(scenarios.day2Retrieval);

// Clear test data
await injector.clearTestData('test');
```

### TestDataVerifier

Verifies data exists in database and Pinecone.

```typescript
import { TestDataVerifier } from '@repo/console-test-data';

const verifier = new TestDataVerifier({
  workspaceId: 'xxx',
  clerkOrgId: 'org_xxx'
});

const result = await verifier.verify();
// {
//   success: true,
//   database: { count: 20, byType: {...}, byActor: {...}, bySource: {...} },
//   pinecone: { count: 20, byType: {...} },
//   mismatches: []
// }

// Print formatted report
await verifier.printReport();
```

### Pre-built Scenarios

```typescript
import { scenarios } from '@repo/console-test-data';

scenarios.day2Retrieval  // 20 obs for Day 2 retrieval testing
scenarios.stressSmall    // 100 balanced observations
scenarios.stressMedium   // 500 balanced observations
scenarios.stressLarge    // 1000 balanced observations
scenarios.stressXL       // 5000 balanced observations
```

### Workspace Resolvers

```typescript
import {
  findWorkspaceByName,
  findWorkspaceById,
  findConfiguredWorkspaces,
  findWorkspacesByOrg
} from '@repo/console-test-data';

// Find by name
const target = await findWorkspaceByName('my-org', 'my-workspace');

// Find all configured for neural memory
const workspaces = await findConfiguredWorkspaces();
```

## Template Categories

| Category | Count | Description |
|----------|-------|-------------|
| Security | 6 | OAuth, JWT, API keys, rate limiting, CSP |
| Performance | 6 | Caching, virtualization, bundle optimization |
| Bug Fixes | 6 | Race conditions, null checks, memory leaks |
| Features | 6 | Search, notifications, exports, dark mode |
| DevOps | 6 | Deployments, CI/CD, E2E tests |
| Docs | 3 | API reference, setup guides |

## Test Scenarios

### Day 2 Retrieval (20 observations)

Tests for:
- Metadata filters (sourceTypes, observationTypes, actorNames, dateRange)
- LLM relevance gating (triggers when >5 results)
- Latency tracking
- Filter UI functionality

### Stress Tests

| Scenario | Count | Use Case |
|----------|-------|----------|
| Small | 100 | Quick validation |
| Medium | 500 | Performance testing |
| Large | 1000 | Load testing |
| XL | 5000 | Capacity testing |

## Types

```typescript
interface TestObservation {
  source: 'github' | 'vercel';
  sourceType: string;
  title: string;
  body: string;
  actorName: string;
  daysAgo: number;
  category?: string;
  tags?: string[];
}

interface WorkspaceTarget {
  workspaceId: string;
  clerkOrgId: string;
}

interface InjectionResult {
  success: boolean;
  observationsCreated: number;
  vectorsUpserted: number;
  errors: string[];
  namespace: string;
  duration: number;
}
```
