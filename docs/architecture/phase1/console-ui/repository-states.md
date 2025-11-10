---
title: Repository States & UI Handling
description: Complete state machine for connected repositories and how UI responds to all scenarios
status: proposed
owner: product + engineering
audience: engineering, design
last_updated: 2025-11-10
tags: [ui, states, edge-cases, error-handling]
---

# Repository States & UI Handling

Complete specification for how the Console UI handles all repository states, including edge cases like config deletion, parse errors, and ingestion failures.

---

## State Machine Overview

### Core States

```
┌─────────────────────────────────────────────────────┐
│                  REPOSITORY STATES                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. NOT_CONNECTED                                   │
│     └─> User hasn't connected this repo yet         │
│                                                      │
│  2. CONNECTED_NO_CONFIG                             │
│     └─> Connected, but no lightfast.yml found       │
│                                                      │
│  3. SETUP_IN_PROGRESS                               │
│     ├─> PR created, waiting for merge               │
│     └─> OR manual setup, waiting for commit         │
│                                                      │
│  4. CONFIGURED                                       │
│     └─> lightfast.yml exists and is valid           │
│                                                      │
│  5. INDEXING                                         │
│     └─> Job running, processing files               │
│                                                      │
│  6. READY                                            │
│     └─> Indexed successfully, ready for search      │
│                                                      │
│  7. CONFIG_DELETED (Edge Case!)                     │
│     └─> Was configured, now lightfast.yml missing   │
│                                                      │
│  8. CONFIG_INVALID                                   │
│     └─> lightfast.yml exists but has errors         │
│                                                      │
│  9. INGESTION_FAILED                                 │
│     └─> Job failed, needs attention                 │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## State Transitions

### Happy Path

```
NOT_CONNECTED
    │
    ↓ [User clicks "Connect"]
CONNECTED_NO_CONFIG
    │
    ↓ [User creates PR or manual config]
SETUP_IN_PROGRESS
    │
    ↓ [PR merged or config pushed]
CONFIGURED
    │
    ↓ [Webhook fires, job triggered]
INDEXING
    │
    ↓ [Job completes successfully]
READY
    │
    ↓ [User pushes changes]
INDEXING
    │
    ↓ [Job completes]
READY (updated)
```

### Edge Case Paths

```
READY
    │
    ↓ [User deletes lightfast.yml]
CONFIG_DELETED
    │
    ↓ [User re-adds config]
CONFIGURED → INDEXING → READY

CONFIGURED
    │
    ↓ [Invalid YAML syntax]
CONFIG_INVALID
    │
    ↓ [User fixes config]
CONFIGURED → INDEXING → READY

INDEXING
    │
    ↓ [Job fails]
INGESTION_FAILED
    │
    ↓ [User fixes issue, retries]
INDEXING → READY
```

---

## UI State Representations

### 1. NOT_CONNECTED

**Not shown in repository list** (repo hasn't been connected yet)

**Available in:** "Connect Repository" dialog (pre-connection)

---

### 2. CONNECTED_NO_CONFIG

**When this happens:**
- User just connected repo
- No lightfast.yml exists in default branch

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ⚠️ Setup required                                   │
│                                                      │
│  No lightfast.yml found                             │
│  [Setup Configuration →]                            │
└─────────────────────────────────────────────────────┘
```

**Settings Page Detail:**
```
┌─────────────────────────────────────────────────────┐
│  Repository: lightfastai/docs                       │
│  Status: ⚠️ Setup Required                          │
│                                                      │
│  This repository needs a lightfast.yml file to      │
│  start indexing documentation.                      │
│                                                      │
│  [Create Configuration]                             │
└─────────────────────────────────────────────────────┘
```

**View Config Dialog:**
```
┌─────────────────────────────────────────────────────┐
│  Repository Configuration                       [×] │
├─────────────────────────────────────────────────────┤
│  Repository: lightfastai/docs                       │
│  Status: ⚠️ No lightfast.yml found                  │
│                                                      │
│  This repository needs configuration to be indexed. │
│                                                      │
│  [Create Configuration]  [Close]                    │
└─────────────────────────────────────────────────────┘
```

**Search Interface:**
- Repo appears in dropdown but grayed out
- Tooltip: "Setup required - no lightfast.yml"
- Can't be selected for search

---

### 3. SETUP_IN_PROGRESS

**When this happens:**
- User created PR with config (waiting for merge)
- OR user said they'll add config manually

#### 3A. PR Created

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ⏳ Setup in progress                                │
│                                                      │
│  Waiting for PR #42 to be merged                    │
│  [View Pull Request →]  [Check Status]              │
└─────────────────────────────────────────────────────┘
```

**Settings Page Detail:**
```
┌─────────────────────────────────────────────────────┐
│  Repository: lightfastai/docs                       │
│  Status: ⏳ Pending Configuration                    │
│                                                      │
│  Pull Request #42: Add Lightfast configuration      │
│  Created: 10 minutes ago                            │
│                                                      │
│  Next steps:                                        │
│  1. Review the PR on GitHub                         │
│  2. Merge to main branch                            │
│  3. Indexing will start automatically               │
│                                                      │
│  [View PR on GitHub]  [Manual Setup Instead]        │
└─────────────────────────────────────────────────────┘
```

#### 3B. Manual Setup

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ⏳ Waiting for configuration                        │
│                                                      │
│  Push lightfast.yml to start indexing               │
│  [View Setup Guide]  [Create PR Instead]            │
└─────────────────────────────────────────────────────┘
```

**Auto-detection:**
- Poll for config every 30 seconds (or webhook detection)
- Auto-transition to CONFIGURED when detected

---

### 4. CONFIGURED

**When this happens:**
- lightfast.yml detected in repo
- Valid YAML syntax
- Waiting for first push or manual trigger

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ✅ Ready to index                                   │
│                                                      │
│  Configuration detected                             │
│  Push to main to start indexing                     │
│  [View Config]  [Manual Trigger]                    │
└─────────────────────────────────────────────────────┘
```

**View Config Dialog:**
```
┌─────────────────────────────────────────────────────┐
│  Repository Configuration                       [×] │
├─────────────────────────────────────────────────────┤
│  Repository: lightfastai/docs                       │
│  Status: ✅ Configured                               │
│                                                      │
│  lightfast.yml                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │ version: 1                                      ││
│  │ store: docs                                     ││
│  │ include:                                        ││
│  │   - "README.md"                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ℹ️  Not indexed yet. Push to main to start.        │
│                                                      │
│  [View in GitHub]  [Manual Trigger]  [Close]        │
└─────────────────────────────────────────────────────┘
```

---

### 5. INDEXING

**When this happens:**
- Webhook received push event
- Inngest job running
- Processing files

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  🔄 Indexing...                                      │
│                                                      │
│  Processing 47 files                                │
│  [View Progress]                                     │
│                                                      │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  47%                         │
└─────────────────────────────────────────────────────┘
```

**Settings Page Detail:**
```
┌─────────────────────────────────────────────────────┐
│  Repository: lightfastai/docs                       │
│  Status: 🔄 Indexing                                 │
│                                                      │
│  Current job:                                       │
│  • Started: 2 minutes ago                           │
│  • Files processed: 22 of 47                        │
│  • Progress: 47%                                    │
│                                                      │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░                              │
│                                                      │
│  [View Job Logs]  [Cancel Job]                      │
└─────────────────────────────────────────────────────┘
```

**Search Interface:**
- Repo shows with spinner icon
- Tooltip: "Indexing in progress (47%)"
- Can still search previously indexed content
- New content appears as it's indexed

---

### 6. READY

**When this happens:**
- Indexing completed successfully
- Documents are searchable

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ✅ Active                                           │
│                                                      │
│  47 documents indexed                               │
│  Last updated: 5 minutes ago                        │
│  [View Config]  [Re-index]                          │
└─────────────────────────────────────────────────────┘
```

**View Config Dialog:**
```
┌─────────────────────────────────────────────────────┐
│  Repository Configuration                       [×] │
├─────────────────────────────────────────────────────┤
│  Repository: lightfastai/docs                       │
│  Status: ✅ Active                                   │
│                                                      │
│  lightfast.yml                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │ version: 1                                      ││
│  │ store: docs                                     ││
│  │ include:                                        ││
│  │   - "README.md"                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  📊 Documents indexed: 47                            │
│  🕐 Last ingested: 5 minutes ago                     │
│  📦 Store: docs                                      │
│                                                      │
│  [View in GitHub]  [Re-index Now]  [Close]          │
└─────────────────────────────────────────────────────┘
```

**Search Interface:**
- Repo fully functional
- Green indicator
- Content searchable

---

### 7. CONFIG_DELETED ⚠️ (Critical Edge Case)

**When this happens:**
- Repository was READY
- User deletes lightfast.yml from repo
- Webhook detects deletion

**How we detect:**
```typescript
// In webhook handler
if (event === 'push') {
  const deletedFiles = payload.commits.flatMap(c => c.removed);

  if (deletedFiles.includes('lightfast.yml')) {
    // Config was deleted!
    await updateRepositoryStatus({
      id: repoId,
      configStatus: 'deleted',
      configPath: null,
      configDetectedAt: null
    });

    // Send notification
    await notifyConfigDeleted(repoId);
  }
}
```

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ⚠️ Configuration removed                            │
│                                                      │
│  lightfast.yml was deleted in commit abc1234        │
│  47 documents still searchable (not updated)        │
│                                                      │
│  [Restore Configuration]  [View Details]            │
└─────────────────────────────────────────────────────┘
```

**Settings Page Detail:**
```
┌─────────────────────────────────────────────────────┐
│  Repository: lightfastai/docs                       │
│  Status: ⚠️ Configuration Removed                    │
│                                                      │
│  ❌ lightfast.yml was deleted                        │
│  🕐 Deleted: 10 minutes ago (commit abc1234)         │
│  📦 Previously indexed: 47 documents                 │
│                                                      │
│  ⚠️  Existing documents are still searchable but    │
│     won't receive updates until config is restored. │
│                                                      │
│  What you can do:                                   │
│  • [Restore Config] - Create PR with previous config│
│  • [Create New Config] - Start fresh setup          │
│  • [Keep Archived] - Documents stay searchable      │
│  • [Disconnect] - Remove repo and delete docs       │
└─────────────────────────────────────────────────────┘
```

**View Config Dialog:**
```
┌─────────────────────────────────────────────────────┐
│  Repository Configuration                       [×] │
├─────────────────────────────────────────────────────┤
│  Repository: lightfastai/docs                       │
│  Status: ⚠️ Configuration Removed                    │
│                                                      │
│  ❌ lightfast.yml was deleted from this repository.  │
│                                                      │
│  Previous configuration (last seen 10 mins ago):    │
│  ┌─────────────────────────────────────────────────┐│
│  │ version: 1                                      ││
│  │ store: docs                                     ││
│  │ include:                                        ││
│  │   - "README.md"                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  📊 47 documents still searchable (frozen)           │
│  ⚠️  No updates until config is restored             │
│                                                      │
│  [Restore This Config]  [Create New]  [Close]       │
└─────────────────────────────────────────────────────┘
```

**Search Interface:**
- Repo shows with warning icon
- Tooltip: "Config removed - content frozen"
- Still searchable but marked as stale
- Badge: "⚠️ Not updating"

**Key Behaviors:**
1. **Documents stay searchable** (don't delete)
2. **No new indexing** until config restored
3. **Show last known config** (cached)
4. **Easy restoration** via PR

**Database Schema:**
```typescript
// Add to ConnectedRepository table
interface ConnectedRepository {
  // ... existing fields

  // Cache last known config for restoration
  lastKnownConfig: string | null;
  lastKnownConfigAt: Date | null;

  // Track deletion
  configDeletedAt: Date | null;
  configDeletedCommit: string | null;
}
```

---

### 8. CONFIG_INVALID

**When this happens:**
- lightfast.yml exists
- YAML syntax error OR validation error
- Webhook tries to parse, fails

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ❌ Configuration error                              │
│                                                      │
│  Invalid YAML syntax in lightfast.yml               │
│  [View Error]  [Fix Config]                         │
└─────────────────────────────────────────────────────┘
```

**Settings Page Detail:**
```
┌─────────────────────────────────────────────────────┐
│  Repository: lightfastai/docs                       │
│  Status: ❌ Configuration Error                      │
│                                                      │
│  lightfast.yml has errors:                          │
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │ Line 5: Invalid YAML syntax                    ││
│  │ Expected key-value pair, got scalar             ││
│  │                                                  ││
│  │   4 │ store: docs                               ││
│  │ > 5 │ include                    ← Missing colon││
│  │   6 │   - "README.md"                           ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  Fix this error to enable indexing.                 │
│                                                      │
│  [View in GitHub]  [View Docs]                      │
└─────────────────────────────────────────────────────┘
```

**View Config Dialog:**
```
┌─────────────────────────────────────────────────────┐
│  Repository Configuration                       [×] │
├─────────────────────────────────────────────────────┤
│  Repository: lightfastai/docs                       │
│  Status: ❌ Invalid Configuration                    │
│                                                      │
│  Error parsing lightfast.yml:                       │
│                                                      │
│  ❌ YAML Syntax Error (Line 5)                       │
│  Expected key-value pair, got scalar                │
│                                                      │
│  Current config (with error):                       │
│  ┌─────────────────────────────────────────────────┐│
│  │ 1  version: 1                                   ││
│  │ 2                                                ││
│  │ 3  # Store name                                 ││
│  │ 4  store: docs                                  ││
│  │ 5  include            ← Error here              ││
│  │ 6    - "README.md"                              ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  [View in GitHub]  [View Syntax Guide]  [Close]     │
└─────────────────────────────────────────────────────┘
```

**Search Interface:**
- Repo shows with error icon
- Tooltip: "Config invalid - fix errors"
- Not searchable (unless previously indexed)

**Error Types to Handle:**
1. **YAML Syntax Error**: Malformed YAML
2. **Schema Validation Error**: Missing required fields
3. **Invalid Glob Pattern**: Syntax error in patterns
4. **Duplicate Store Name**: Conflict with existing store

---

### 9. INGESTION_FAILED

**When this happens:**
- Config is valid
- Job started
- Job failed (network, rate limit, parse error, etc.)

**Repository List UI:**
```
┌─────────────────────────────────────────────────────┐
│  📦 lightfastai/docs                                 │
│  ❌ Indexing failed                                  │
│                                                      │
│  Last job failed: GitHub rate limit exceeded        │
│  [Retry]  [View Logs]                               │
└─────────────────────────────────────────────────────┘
```

**Settings Page Detail:**
```
┌─────────────────────────────────────────────────────┐
│  Repository: lightfastai/docs                       │
│  Status: ❌ Indexing Failed                          │
│                                                      │
│  Job failed at: 10 minutes ago                      │
│  Commit: abc1234 (main)                             │
│                                                      │
│  Error:                                             │
│  ┌─────────────────────────────────────────────────┐│
│  │ GitHub API rate limit exceeded                  ││
│  │                                                  ││
│  │ Please try again in 30 minutes or contact       ││
│  │ support if this persists.                       ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  Files processed: 15 of 47 (32%)                    │
│                                                      │
│  [Retry Indexing]  [View Full Logs]  [Get Help]    │
└─────────────────────────────────────────────────────┘
```

**Auto-retry Logic:**
```typescript
// In Inngest workflow
const result = await step.run('fetch-files', async () => {
  return fetchFilesFromGitHub();
}, {
  retries: 3,
  backoff: {
    type: 'exponential',
    base: 1000,
    max: 60000
  }
});

if (!result.success) {
  await step.run('notify-failure', async () => {
    await notifyUserOfFailure({
      repoId,
      error: result.error,
      retriesRemaining: 0
    });
  });
}
```

**Common Failure Types:**
1. **Rate Limit**: Auto-retry after cooldown
2. **Network Error**: Auto-retry 3x
3. **Parse Error**: No retry, needs config fix
4. **Permission Error**: Show helpful message

---

## State Transitions Matrix

| From State | Event | To State | Action |
|------------|-------|----------|--------|
| NOT_CONNECTED | User connects | CONNECTED_NO_CONFIG | Show setup prompt |
| CONNECTED_NO_CONFIG | PR created | SETUP_IN_PROGRESS (PR) | Poll for merge |
| CONNECTED_NO_CONFIG | Manual selected | SETUP_IN_PROGRESS (Manual) | Poll for commit |
| SETUP_IN_PROGRESS | Config detected | CONFIGURED | Show ready state |
| CONFIGURED | Push event | INDEXING | Start job |
| INDEXING | Job success | READY | Update counts |
| INDEXING | Job failure | INGESTION_FAILED | Show error |
| READY | Push event | INDEXING | Re-index |
| READY | Config deleted | CONFIG_DELETED | Cache config, warn |
| READY | Config invalid | CONFIG_INVALID | Show errors |
| CONFIG_DELETED | Config restored | CONFIGURED | Resume normal |
| CONFIG_INVALID | Config fixed | CONFIGURED | Resume normal |
| INGESTION_FAILED | Retry triggered | INDEXING | Retry job |

---

## Database Schema Updates

### Repository Status Tracking

```typescript
// db/console/src/schema/tables/connected-repository.ts

export const connectedRepositories = pgTable('lightfast_connected_repository', {
  // ... existing fields

  // Config status
  configStatus: varchar('config_status', { length: 50 }).$type<
    | 'unconfigured'
    | 'pending_pr'
    | 'pending_manual'
    | 'configured'
    | 'indexing'
    | 'ready'
    | 'deleted'
    | 'invalid'
    | 'failed'
  >().default('unconfigured'),

  configPath: varchar('config_path', { length: 255 }),
  configDetectedAt: timestamp('config_detected_at', { mode: 'date' }),

  // Cache last known config for restoration
  lastKnownConfig: text('last_known_config'),
  lastKnownConfigAt: timestamp('last_known_config_at', { mode: 'date' }),

  // Track deletion
  configDeletedAt: timestamp('config_deleted_at', { mode: 'date' }),
  configDeletedCommit: varchar('config_deleted_commit', { length: 40 }),

  // Validation errors
  configErrors: jsonb('config_errors').$type<Array<{
    line?: number;
    column?: number;
    message: string;
    type: 'syntax' | 'validation';
  }>>(),

  // Indexing status
  lastIndexedAt: timestamp('last_indexed_at', { mode: 'date' }),
  documentCount: integer('document_count').default(0),
  lastIndexJobId: varchar('last_index_job_id', { length: 255 }),
  lastIndexError: text('last_index_error'),

  // PR tracking (for setup in progress)
  setupPrUrl: varchar('setup_pr_url', { length: 500 }),
  setupPrNumber: integer('setup_pr_number'),
  setupPrStatus: varchar('setup_pr_status', { length: 20 }), // 'open' | 'merged' | 'closed'
});
```

---

## Webhook Event Handlers

### Config Deletion Detection

```typescript
// apps/console/src/app/(github)/api/github/webhooks/route.ts

async function handlePushEvent(payload: PushWebhookPayload) {
  const deletedFiles = payload.commits.flatMap(c => c.removed || []);

  if (deletedFiles.includes('lightfast.yml')) {
    console.log('Config deleted:', payload.repository.full_name);

    const repo = await getRepoByGithubId(payload.repository.id);

    if (repo) {
      // Cache the config before marking as deleted
      const lastConfig = await fetchConfigFromGitHub({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        ref: payload.before  // Previous commit SHA
      });

      await db.update(connectedRepositories)
        .set({
          configStatus: 'deleted',
          configPath: null,
          configDetectedAt: null,
          lastKnownConfig: lastConfig?.content,
          lastKnownConfigAt: new Date(),
          configDeletedAt: new Date(),
          configDeletedCommit: payload.after
        })
        .where(eq(connectedRepositories.id, repo.id));

      // Notify user
      await sendConfigDeletedNotification(repo.id);
    }

    return; // Don't trigger ingestion
  }

  // ... rest of push handler
}
```

### Config Validation

```typescript
async function validateConfig(configContent: string) {
  try {
    // 1. Parse YAML
    const parsed = yaml.parse(configContent);

    // 2. Validate schema
    const result = lightfastConfigSchema.safeParse(parsed);

    if (!result.success) {
      return {
        valid: false,
        errors: result.error.issues.map(issue => ({
          message: issue.message,
          path: issue.path.join('.'),
          type: 'validation' as const
        }))
      };
    }

    return { valid: true, config: result.data };

  } catch (error) {
    // YAML parse error
    if (error instanceof yaml.YAMLParseError) {
      return {
        valid: false,
        errors: [{
          line: error.linePos?.start.line,
          column: error.linePos?.start.col,
          message: error.message,
          type: 'syntax' as const
        }]
      };
    }

    throw error;
  }
}
```

---

## User Notifications

### Email/In-App Notifications

**Config Deleted:**
```
⚠️ Configuration removed from lightfastai/docs

The lightfast.yml file was deleted in commit abc1234.

Your 47 indexed documents are still searchable but won't receive updates.

[Restore Configuration] [View Repository]
```

**Config Invalid:**
```
❌ Configuration error in lightfastai/docs

There's a syntax error in your lightfast.yml file (line 5).

Fix the error to resume indexing.

[View Error] [View Repository]
```

**Indexing Failed:**
```
❌ Indexing failed for lightfastai/docs

The indexing job failed due to: GitHub rate limit exceeded

We'll automatically retry in 30 minutes.

[View Details] [Retry Now]
```

---

## Recovery Flows

### Restoring Deleted Config

**User clicks "Restore Configuration":**

```typescript
async function restoreConfig(repoId: string) {
  const repo = await getRepository(repoId);

  if (!repo.lastKnownConfig) {
    throw new Error('No cached config to restore');
  }

  // Create PR with cached config
  const pr = await createConfigPullRequest({
    repository: repo.metadata.fullName,
    installationId: repo.githubInstallationId,
    config: repo.lastKnownConfig,
    title: '🔄 Restore Lightfast configuration',
    body: `This PR restores the lightfast.yml configuration that was deleted in commit ${repo.configDeletedCommit}.

The previous configuration has been recovered and is ready to be merged.

## Previous Configuration
\`\`\`yaml
${repo.lastKnownConfig}
\`\`\`

Merge this PR to resume automatic documentation indexing.`
  });

  // Update repo status
  await db.update(connectedRepositories)
    .set({
      configStatus: 'pending_pr',
      setupPrUrl: pr.html_url,
      setupPrNumber: pr.number,
      setupPrStatus: 'open'
    })
    .where(eq(connectedRepositories.id, repoId));

  return pr;
}
```

### Fixing Invalid Config

**User clicks "Fix Config":**
- Opens GitHub file editor directly to lightfast.yml
- Shows validation errors in UI
- Provides link to docs for correct syntax

```typescript
function getGitHubEditUrl(repo: ConnectedRepository): string {
  const { fullName } = repo.metadata;
  return `https://github.com/${fullName}/edit/main/lightfast.yml`;
}
```

---

## Summary

### State Priority (What Users See)

**Order of precedence:**
1. ❌ **CONFIG_INVALID** - Must fix errors
2. ❌ **INGESTION_FAILED** - Job failed, needs retry
3. ⚠️ **CONFIG_DELETED** - Was working, now broken
4. 🔄 **INDEXING** - Currently processing
5. ⏳ **SETUP_IN_PROGRESS** - Waiting for setup
6. ✅ **READY** - All good, searchable
7. ✅ **CONFIGURED** - Ready, waiting for push
8. ⚠️ **CONNECTED_NO_CONFIG** - Needs setup

### Key Principles

1. **Never lose data silently**
   - Cache config before marking as deleted
   - Keep indexed docs searchable
   - Show clear recovery options

2. **Clear error messages**
   - Show what's wrong
   - Show how to fix it
   - Provide actionable buttons

3. **Automatic recovery where possible**
   - Auto-retry failed jobs
   - Auto-detect restored configs
   - Auto-transition states

4. **Graceful degradation**
   - Config deleted? Docs still searchable
   - Job failed? Show partial progress
   - Invalid config? Show errors, not blank state

---

## Related Documentation

- [Onboarding & Repository Setup](./onboarding-repository-setup.md) - Setup flow
- [UI Structure](./ui-structure.md) - Overall UI organization
- [Jobs Tracking](./jobs-tracking.md) - Inngest job monitoring

---

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Status:** Proposed - Ready for Review
**Next Steps:** Review edge case handling → Implement state machine → Add monitoring
