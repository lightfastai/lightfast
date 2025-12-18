# Debug: Generate Neural Memory Test Data

Generate a robust set of 20-40 GitHub + Vercel webhook events to populate the neural memory system for E2E testing.

## Context

We need realistic test data that flows through the **full production pipeline**:
- Webhook transformation (GitHub/Vercel formats)
- Significance scoring
- Entity extraction
- Multi-view embeddings (title, content, summary)
- Cluster assignment
- Actor resolution

## Prerequisites

1. **Dev environment running**: `pnpm dev:app` (includes Inngest via ngrok)
2. **Workspace configured** with Pinecone index

## Task

### Step 1: Get Workspace Details

First, find the target workspace:

```bash
# Check Drizzle Studio for workspace info, or use known values:
# - Workspace ID: (from org_workspaces table)
# - Clerk Org ID: (from organizations table)
# - Pinecone Index: (from workspace.indexName)
```

### Step 2: Generate Test Data

Use the `@repo/console-test-data` package to inject events:

```bash
# Option A: Balanced mix (recommended for 20-40 events)
pnpm --filter @repo/console-test-data inject -- \
  -w <workspace_id> \
  -o <clerk_org_id> \
  -i <pinecone_index> \
  -s balanced \
  -c 30

# Option B: Create comprehensive dataset first, then inject
# (see Step 3 for custom dataset creation)
```

### Step 3: (Optional) Create Comprehensive Dataset

If balanced scenario doesn't provide enough variety, create a new dataset at `packages/console-test-data/datasets/comprehensive.json`:

**Target: 30-40 events covering:**

| Source | Event Type | Count | Topics |
|--------|------------|-------|--------|
| GitHub | push | 8 | feature commits, hotfixes, config changes |
| GitHub | pull_request (opened) | 4 | new features, bug fixes |
| GitHub | pull_request (merged) | 6 | completed features, security patches |
| GitHub | pull_request (closed) | 2 | rejected/abandoned PRs |
| GitHub | issues (opened) | 4 | bugs, feature requests |
| GitHub | issues (closed) | 3 | resolved issues |
| GitHub | release | 2 | version releases |
| Vercel | deployment.succeeded | 6 | production deploys |
| Vercel | deployment.error | 2 | failed deploys |
| Vercel | deployment.canceled | 1 | canceled deploy |

**Themes to cover:**
- Authentication/security (OAuth, API keys, credentials)
- Performance (caching, optimization, monitoring)
- Infrastructure (deployments, CI/CD, configs)
- Features (new capabilities, UI changes)
- Bug fixes (error handling, edge cases)
- Documentation (README, API docs)

### Step 4: Verify Injection

After injection, verify the data:

```bash
pnpm --filter @repo/console-test-data verify -- \
  -w <workspace_id> \
  -o <clerk_org_id> \
  -i <pinecone_index>
```

**Expected output:**
- 30-40 observations in database
- Entities extracted (branches, files, users, repos)
- Multi-view embeddings in Pinecone (3x per observation)
- Clusters assigned
- Actor profiles created

### Step 5: Test Search

Once data is populated, test the search:

1. Navigate to `http://localhost:3024/{org}/{workspace}/search`
2. Try queries like:
   - "authentication changes"
   - "deployment failures"
   - "performance optimization"
3. Verify results load correctly and "Find Similar" / content expansion work

## Success Criteria

- [ ] 30+ observations in `workspace_neural_observations` table
- [ ] Entities extracted in `workspace_neural_entities` table
- [ ] 3 embeddings per observation in Pinecone (title, content, summary views)
- [ ] At least 3-5 clusters formed
- [ ] Actor profiles created for committers
- [ ] Search returns relevant results
- [ ] Content expansion shows full content (no "missing ID" errors)

## Troubleshooting

**Inngest not processing:**
- Check http://localhost:8288 for function runs
- Verify ngrok tunnel is active: `curl http://localhost:4040/api/tunnels`

**Embeddings missing:**
- Check Pinecone namespace matches workspace config
- Verify embedding model credentials in env

**Content not found after search:**
- This was a bug where Pinecone had IDs but PlanetScale didn't
- Using `inject` command ensures both are populated via real workflow
