---
title: GitHub API Strategy — Efficient File Fetching
description: Comprehensive guide for fetching file content from GitHub API while minimizing over-fetching and avoiding rate limits
status: working
owner: engineering
audience: engineering
last_updated: 2025-11-07
tags: [github, api, rate-limits, octokit, phase1]
---

# GitHub API Strategy — Efficient File Fetching

This document provides a comprehensive strategy for efficiently fetching file content from GitHub API in response to webhook push events, while minimizing over-fetching and avoiding rate limits.

---

## Table of Contents

1. [Rate Limits Overview](#rate-limits-overview)
2. [Content Fetching Comparison](#content-fetching-comparison)
3. [Recommended Strategy](#recommended-strategy)
4. [Authentication Pattern](#authentication-pattern)
5. [Efficient Fetching Algorithm](#efficient-fetching-algorithm)
6. [Over-Fetching Prevention](#over-fetching-prevention)
7. [Rate Limit Handling](#rate-limit-handling)
8. [Implementation Guide](#implementation-guide)
9. [Performance Estimates](#performance-estimates)
10. [Testing Strategy](#testing-strategy)

---

## Rate Limits Overview

### GitHub App vs OAuth App Rate Limits

**GitHub App Installation Tokens (Recommended):**
- **Base rate limit**: 5,000 requests/hour (minimum)
- **GitHub Enterprise Cloud**: 15,000 requests/hour
- **Scaling for non-Enterprise**: Rate limit scales with users and repositories
  - +50 requests/hour for each repository over 20 (up to 12,500 total)
  - +50 requests/hour for each user over 20 (up to 12,500 total)
- **Maximum**: 15,000 requests/hour for Enterprise Cloud installations

**OAuth App User Tokens:**
- **Standard**: 5,000 requests/hour per authenticated user
- **Does not scale** with repositories or organization size

**Key Takeaway:** GitHub App installation tokens provide 3x higher rate limits (15,000/hr) for Enterprise Cloud organizations and better scaling for growing repositories.

### Rate Limit Headers

GitHub includes rate limit information in every API response:

```
X-RateLimit-Limit: 15000
X-RateLimit-Remaining: 14998
X-RateLimit-Reset: 1372700873
X-RateLimit-Used: 2
X-RateLimit-Resource: core
```

**Important Headers:**
- `X-RateLimit-Remaining`: Number of requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `Retry-After`: (on 429 responses) Seconds to wait before retrying

### Secondary Rate Limits

GitHub also enforces secondary rate limits to prevent abuse:
- Triggered by rapid bursts of requests
- Returns `403 Forbidden` with `retry-after` header
- Default retry time: 60 seconds
- **Best practice**: Don't automatically retry secondary rate limits

---

## Content Fetching Comparison

### Option A: Contents API (Per File)

**Endpoint:**
```
GET /repos/{owner}/{repo}/contents/{path}?ref={sha}
```

**Pros:**
- Simple, straightforward API
- Returns file metadata + base64-encoded content in one request
- Easy to implement
- No need for additional blob fetching

**Cons:**
- One request per file (expensive for large changesets)
- File size limit: 1 MB for standard response, 100 MB for raw/object media types
- Files 1-100 MB require special media type and content field is empty
- Quickly exhausts rate limits for bulk operations

**Best for:** Small changesets (1-10 files)

**Example:**
```typescript
const { data } = await octokit.rest.repos.getContent({
  owner: 'lightfastai',
  repo: 'lightfast',
  path: 'docs/api/search.md',
  ref: commitSha,
});

const content = Buffer.from(data.content, 'base64').toString('utf-8');
```

### Option B: Git Trees API (Batch Structure)

**Endpoint:**
```
GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1
```

**Pros:**
- Single request gets entire repository structure
- Returns all file paths with blob SHAs
- Can filter for specific paths client-side
- Very efficient for understanding repository structure

**Cons:**
- Limit: 100,000 entries with maximum size of 7 MB
- Does not include file content (only structure and SHAs)
- Requires follow-up blob requests for content
- Overkill if you only need specific files

**Best for:** Getting repository structure + targeted blob fetching

**Example:**
```typescript
const { data } = await octokit.rest.git.getTree({
  owner: 'lightfastai',
  repo: 'lightfast',
  tree_sha: commitSha,
  recursive: 'true',
});

// Filter for docs files
const docsFiles = data.tree.filter(item =>
  item.type === 'blob' && item.path?.startsWith('docs/')
);
```

### Option C: Git Blobs API (After Tree)

**Endpoint:**
```
GET /repos/{owner}/{repo}/git/blobs/{sha}
```

**Pros:**
- Supports files up to 100 MB
- Direct content access by SHA
- Can batch multiple blob requests in parallel
- Efficient when you already have blob SHAs

**Cons:**
- Requires tree API call first to get SHAs
- Two-step process (tree → blobs)
- Still multiple requests for many files

**Best for:** Medium changesets (10-100 files) with known SHAs

**Example:**
```typescript
const { data } = await octokit.rest.git.getBlob({
  owner: 'lightfastai',
  repo: 'lightfast',
  file_sha: blobSha,
});

const content = Buffer.from(data.content, 'base64').toString('utf-8');
```

### Option D: Compare Commits API (Diff)

**Endpoint:**
```
GET /repos/{owner}/{repo}/compare/{base}...{head}
```

**Pros:**
- Single request returns all changed files between commits
- Includes file metadata (status: added/modified/removed)
- Can include patch/diff inline
- Optimized for commit comparisons
- Supports pagination for large diffs

**Cons:**
- Limited to 300 files per page
- Maximum 3,000 files total across all pages
- File content not included in standard response
- Still need to fetch content via Contents or Blobs API

**Best for:** Understanding what changed, then targeted fetching

**Example:**
```typescript
const { data } = await octokit.rest.repos.compareCommits({
  owner: 'lightfastai',
  repo: 'lightfast',
  base: beforeSha,
  head: afterSha,
});

// data.files contains up to 300 changed files
const changedFiles = data.files;
```

### Option E: Archive API (Tarball/Zipball)

**Endpoint:**
```
GET /repos/{owner}/{repo}/tarball/{ref}
GET /repos/{owner}/{repo}/zipball/{ref}
```

**Pros:**
- Single request downloads entire repository
- Most efficient for full repository clone
- No rate limit issues for large repos

**Cons:**
- Massive overkill for small changesets
- Need to extract and parse archive
- Downloads entire repository (wasteful)
- Large bandwidth usage

**Best for:** Full repository sync or monorepo with 1000+ changed files

---

## Recommended Strategy

### Decision Tree: Which API to Use?

```
Push webhook received
    ↓
Filter changed files by lightfast.yml globs
    ↓
Count filtered files
    ↓
    ├─ 1-10 files → Contents API (parallel requests)
    │                Most straightforward, acceptable rate limit usage
    │
    ├─ 11-50 files → Tree + Blobs API (2 requests total)
    │                 Single tree fetch + parallel blob fetches
    │
    ├─ 51-300 files → Compare API + Blobs (2-3 requests)
    │                  Compare shows changes, fetch blobs in batches
    │
    └─ 300+ files → Consider webhook retry batching OR
                     Tree + Blobs with aggressive caching
```

### Phase 1 Recommendation: Hybrid Approach

For Phase 1 docs sync, we recommend a **two-tier strategy**:

**Tier 1: Small Changesets (< 20 files)**
- Use **Contents API** with parallel fetching
- Simple, reliable, good DX
- Acceptable rate limit usage

**Tier 2: Large Changesets (20-300 files)**
- Use **Tree API + Blobs API**
- One tree request to get all SHAs
- Parallel blob requests in batches of 10-20
- Significantly reduces total requests

**Rationale:**
- Most docs updates involve 1-10 files (Tier 1 path)
- Occasional large refactors hit Tier 2
- Webhook payload already provides changed file list
- Can filter by globs before fetching
- Optimizes for common case while handling edge cases

---

## Authentication Pattern

### GitHub App Installation Token (Recommended)

**Setup:**

```typescript
// packages/console-octokit-github/src/index.ts
import { App } from "octokit";

export function createGitHubApp(config: {
  appId: string;
  privateKey: string;
}): App {
  return new App({
    appId: config.appId,
    privateKey: config.privateKey,
  });
}

export async function getInstallationOctokit(
  app: App,
  installationId: number
) {
  // Creates a new Octokit instance authenticated as the installation
  return await app.getInstallationOctokit(installationId);
}
```

**Usage in Webhook Handler:**

```typescript
// apps/console/src/app/(github)/api/github/webhooks/route.ts
import { createGitHubApp } from "@repo/console-octokit-github";
import { env } from "~/env";

async function fetchFileContent(
  installationId: number,
  owner: string,
  repo: string,
  path: string,
  ref: string
) {
  const app = createGitHubApp({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  const octokit = await app.getInstallationOctokit(installationId);

  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });

  if (!('content' in data)) {
    throw new Error('Directory or submodule, not a file');
  }

  return Buffer.from(data.content, 'base64').toString('utf-8');
}
```

**Key Benefits:**
- Installation tokens are automatically managed by Octokit App
- Higher rate limits (15,000/hr for Enterprise Cloud)
- Scoped to specific repositories
- Automatically refreshed when expired

### Environment Variables

Required environment variables:

```bash
# .env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

**Note:** Use `formatPrivateKey()` helper from `@repo/console-octokit-github` if storing key with literal `\n` characters.

---

## Efficient Fetching Algorithm

### Phase 1 Implementation: Hybrid Fetching

```typescript
/**
 * Fetch file contents efficiently based on changeset size
 */
async function fetchChangedFiles(
  installationId: number,
  owner: string,
  repo: string,
  changedFiles: Array<{ path: string; status: 'added' | 'modified' | 'removed' }>,
  commitSha: string
): Promise<Map<string, { content: string; sha: string }>> {
  const app = createGitHubApp({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  const octokit = await app.getInstallationOctokit(installationId);

  // Filter out removed files (no content to fetch)
  const filesToFetch = changedFiles.filter(f => f.status !== 'removed');

  const results = new Map<string, { content: string; sha: string }>();

  // Strategy 1: Small changesets (< 20 files) - Use Contents API
  if (filesToFetch.length < 20) {
    console.log(`[Fetch] Using Contents API for ${filesToFetch.length} files`);

    await Promise.all(
      filesToFetch.map(async (file) => {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: commitSha,
          });

          if ('content' in data && data.type === 'file') {
            results.set(file.path, {
              content: Buffer.from(data.content, 'base64').toString('utf-8'),
              sha: data.sha,
            });
          }
        } catch (error) {
          console.error(`[Fetch] Failed to fetch ${file.path}:`, error);
        }
      })
    );
  }

  // Strategy 2: Large changesets (20-300 files) - Use Tree + Blobs API
  else if (filesToFetch.length <= 300) {
    console.log(`[Fetch] Using Tree + Blobs API for ${filesToFetch.length} files`);

    // Step 1: Fetch tree to get all blob SHAs
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: commitSha,
      recursive: 'true',
    });

    // Step 2: Build path -> SHA map
    const pathToSha = new Map<string, string>();
    for (const item of tree.tree) {
      if (item.type === 'blob' && item.path) {
        pathToSha.set(item.path, item.sha!);
      }
    }

    // Step 3: Fetch blobs in batches of 20 (parallel)
    const batchSize = 20;
    for (let i = 0; i < filesToFetch.length; i += batchSize) {
      const batch = filesToFetch.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          const blobSha = pathToSha.get(file.path);
          if (!blobSha) {
            console.warn(`[Fetch] No blob SHA found for ${file.path}`);
            return;
          }

          try {
            const { data: blob } = await octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: blobSha,
            });

            results.set(file.path, {
              content: Buffer.from(blob.content, 'base64').toString('utf-8'),
              sha: blobSha,
            });
          } catch (error) {
            console.error(`[Fetch] Failed to fetch blob for ${file.path}:`, error);
          }
        })
      );
    }
  }

  // Strategy 3: Very large changesets (300+ files) - Log warning and batch
  else {
    console.warn(`[Fetch] Very large changeset (${filesToFetch.length} files). Consider breaking into batches.`);

    // Fall back to Tree + Blobs with aggressive batching
    // Implementation same as Strategy 2, but with monitoring
  }

  return results;
}
```

### Flowchart

```
Push Event Received
    ↓
Extract changed files from webhook payload
    ↓
Filter by lightfast.yml globs (e.g., docs/**/*.md)
    ↓
Separate by status: added/modified vs removed
    ↓
Count files to fetch (exclude removed)
    ↓
    ├─ < 20 files
    │   ↓
    │   Use Contents API (parallel)
    │   - 1 request per file
    │   - Simple, reliable
    │   - Rate limit: 20 requests
    │
    ├─ 20-300 files
    │   ↓
    │   Use Tree + Blobs API
    │   - 1 tree request
    │   - N blob requests (batched)
    │   - Rate limit: 1 + N requests
    │
    └─ 300+ files
        ↓
        Log warning + use Tree + Blobs
        - Consider webhook retry
        - Monitor rate limits closely
```

---

## Over-Fetching Prevention

### 1. Content Hash Comparison

**Strategy:** Use git blob SHA to detect if content actually changed.

```typescript
/**
 * Check if document content has changed by comparing SHAs
 */
async function shouldFetchFile(
  storeId: string,
  path: string,
  newSha: string
): Promise<boolean> {
  const existingDoc = await db.query.docsDocuments.findFirst({
    where: and(
      eq(docsDocuments.storeId, storeId),
      eq(docsDocuments.path, path)
    ),
  });

  // New file or content changed
  if (!existingDoc || existingDoc.commitSha !== newSha) {
    return true;
  }

  console.log(`[Fetch] Skipping ${path} (SHA unchanged: ${newSha})`);
  return false;
}
```

**Benefits:**
- Eliminates fetches for unchanged files
- Git SHA is cryptographically guaranteed to detect changes
- Works even if file was "modified" but content is identical

### 2. Incremental Fetching via Webhook

**Strategy:** Use webhook's changed files list (don't scan entire repo).

```typescript
async function handlePushEvent(payload: PushPayload) {
  // Aggregate changed files from all commits in push
  const changedFiles = new Map<string, "added" | "modified" | "removed">();

  for (const commit of payload.commits) {
    commit.added.forEach((path) => changedFiles.set(path, "added"));
    commit.modified.forEach((path) => changedFiles.set(path, "modified"));
    commit.removed.forEach((path) => changedFiles.set(path, "removed"));
  }

  // Filter by lightfast.yml globs
  const filteredFiles = filterByGlobs(
    Array.from(changedFiles.entries()),
    loadLightfastConfig()
  );

  console.log(`[Push] ${changedFiles.size} changed, ${filteredFiles.length} match globs`);

  // Only fetch files that match globs
  await fetchChangedFiles(filteredFiles);
}
```

**Benefits:**
- No need to scan entire repository
- Webhook provides exactly what changed
- Filter by globs before fetching
- Scales to large repositories

### 3. Glob-Based Filtering

**Strategy:** Filter files by `lightfast.yml` globs before fetching.

```typescript
import minimatch from 'minimatch';

function filterByGlobs(
  files: string[],
  globs: string[]
): string[] {
  return files.filter(file =>
    globs.some(glob => minimatch(file, glob))
  );
}

// Example usage
const config = {
  include: [
    'docs/**/*.md',
    'docs/**/*.mdx',
    'api/**/*.md',
  ],
};

const changedFiles = [
  'docs/api/search.md',        // MATCH
  'docs/guides/quickstart.mdx', // MATCH
  'src/index.ts',               // NO MATCH
  'README.md',                  // NO MATCH
];

const filtered = filterByGlobs(changedFiles, config.include);
// Result: ['docs/api/search.md', 'docs/guides/quickstart.mdx']
```

**Benefits:**
- Only fetch docs files (not source code)
- Configurable per repository
- Reduces fetches by 90%+ in typical repos

### 4. Caching Strategy

**Strategy:** Cache tree data and blob content by SHA.

```typescript
import { createClient } from '@vercel/kv';

const kv = createClient({
  url: env.KV_REST_API_URL,
  token: env.KV_REST_API_TOKEN,
});

/**
 * Fetch tree with caching
 */
async function fetchTreeCached(
  octokit: Octokit,
  owner: string,
  repo: string,
  treeSha: string
) {
  const cacheKey = `gh:tree:${owner}/${repo}:${treeSha}`;

  // Check cache first
  const cached = await kv.get(cacheKey);
  if (cached) {
    console.log(`[Cache] Tree hit for ${treeSha}`);
    return cached;
  }

  // Fetch from GitHub
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: 'true',
  });

  // Cache for 1 hour (trees are immutable)
  await kv.set(cacheKey, data, { ex: 3600 });

  return data;
}

/**
 * Fetch blob with caching
 */
async function fetchBlobCached(
  octokit: Octokit,
  owner: string,
  repo: string,
  blobSha: string
) {
  const cacheKey = `gh:blob:${owner}/${repo}:${blobSha}`;

  // Check cache first
  const cached = await kv.get(cacheKey);
  if (cached) {
    console.log(`[Cache] Blob hit for ${blobSha}`);
    return cached;
  }

  // Fetch from GitHub
  const { data } = await octokit.rest.git.getBlob({
    owner,
    repo,
    file_sha: blobSha,
  });

  const content = Buffer.from(data.content, 'base64').toString('utf-8');

  // Cache for 1 hour (blobs are immutable)
  await kv.set(cacheKey, content, { ex: 3600 });

  return content;
}
```

**Benefits:**
- Git objects (trees, blobs) are immutable by SHA
- Cache hits = zero rate limit usage
- Particularly effective for monorepos
- Reduces latency significantly

### 5. Idempotency by Delivery ID

**Strategy:** Prevent duplicate processing of webhook deliveries.

```typescript
async function handlePushEvent(payload: PushPayload, deliveryId: string) {
  const storeId = await resolveStoreId(payload.repository.full_name);

  // Check if we've already processed this delivery
  const existing = await db.query.ingestionCommits.findFirst({
    where: and(
      eq(ingestionCommits.storeId, storeId),
      eq(ingestionCommits.deliveryId, deliveryId)
    ),
  });

  if (existing) {
    console.log(`[Webhook] Delivery ${deliveryId} already processed`);
    return { status: 'duplicate' };
  }

  // Process webhook...

  // Record commit to prevent reprocessing
  await db.insert(ingestionCommits).values({
    id: randomUUID(),
    storeId,
    beforeSha: payload.before,
    afterSha: payload.after,
    deliveryId,
    status: 'processed',
    processedAt: new Date(),
  });
}
```

**Benefits:**
- Prevents duplicate fetches on webhook retries
- Database-backed idempotency
- Audit trail for troubleshooting

---

## Rate Limit Handling

### 1. Octokit Throttling Plugin (Recommended)

**Installation:**

```bash
pnpm add @octokit/plugin-throttling --filter @repo/console-octokit-github
```

**Configuration:**

```typescript
// packages/console-octokit-github/src/index.ts
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

const MyOctokit = Octokit.plugin(throttling, retry);

export function createThrottledOctokit(auth: string) {
  return new MyOctokit({
    auth,
    throttle: {
      onRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(
          `Rate limit exhausted for ${options.method} ${options.url}`
        );

        // Retry twice after hitting rate limit
        if (options.request.retryCount <= 2) {
          console.log(`Retrying after ${retryAfter}s...`);
          return true;
        }

        // Give up after 2 retries
        return false;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        // Don't retry, only log warning
        octokit.log.warn(
          `Secondary rate limit hit for ${options.method} ${options.url}`
        );

        // Never auto-retry secondary rate limits
        return false;
      },
    },
  });
}
```

**Usage:**

```typescript
export async function getInstallationOctokit(
  app: App,
  installationId: number
) {
  const { token } = await app.octokit.auth({
    type: "installation",
    installationId,
  });

  return createThrottledOctokit(token);
}
```

**Benefits:**
- Automatic retry with exponential backoff
- Respects `Retry-After` headers
- Configurable retry limits
- Logs warnings for visibility

### 2. Rate Limit Check Before Requests

**Strategy:** Check remaining quota before making expensive requests.

```typescript
/**
 * Check rate limit before fetching files
 */
async function checkRateLimit(octokit: Octokit) {
  const { data } = await octokit.rest.rateLimit.get();
  const { remaining, limit, reset } = data.rate;

  console.log(`[RateLimit] ${remaining}/${limit} remaining`);

  // Warn if getting low
  if (remaining < 100) {
    const resetTime = new Date(reset * 1000);
    console.warn(
      `[RateLimit] Low quota: ${remaining} remaining, resets at ${resetTime.toISOString()}`
    );
  }

  // Reject if critically low (reserve some quota)
  if (remaining < 50) {
    throw new Error(
      `Rate limit too low (${remaining}). Wait until ${new Date(reset * 1000).toISOString()}`
    );
  }

  return { remaining, limit, reset };
}

async function fetchChangedFiles(...) {
  await checkRateLimit(octokit);

  // Proceed with fetching...
}
```

**Benefits:**
- Proactive rate limit management
- Prevents hitting hard limit
- Provides user-friendly error messages
- Can queue jobs for later if quota low

### 3. Conditional Requests with ETags

**Strategy:** Use ETags to avoid re-fetching unchanged content.

```typescript
/**
 * Fetch with ETag caching
 */
async function fetchWithETag(
  octokit: Octokit,
  url: string,
  cachedETag?: string
) {
  const headers: Record<string, string> = {};

  if (cachedETag) {
    headers['If-None-Match'] = cachedETag;
  }

  try {
    const response = await octokit.request(url, { headers });

    return {
      data: response.data,
      etag: response.headers.etag,
      modified: true,
    };
  } catch (error: any) {
    // 304 Not Modified - content unchanged
    if (error.status === 304) {
      console.log(`[ETag] Content not modified for ${url}`);
      return {
        data: null,
        etag: cachedETag,
        modified: false,
      };
    }

    throw error;
  }
}
```

**Key Benefit:** 304 responses **DO NOT count against rate limit!**

### 4. Exponential Backoff for Retries

**Strategy:** Implement exponential backoff for transient failures.

```typescript
/**
 * Retry with exponential backoff
 */
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  }
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;

      // Don't retry on 4xx errors (except 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      if (isLastAttempt) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );

      console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry exhausted');
}

// Usage
const content = await fetchWithRetry(
  () => fetchFileContent(path),
  {
    maxRetries: 3,
    baseDelay: 1000,  // Start with 1s
    maxDelay: 30000,  // Cap at 30s
  }
);
```

**Benefits:**
- Handles transient failures
- Respects server load
- Prevents thundering herd

### 5. Rate Limit Monitoring & Alerting

**Strategy:** Monitor rate limit usage and alert when getting low.

```typescript
/**
 * Monitor and log rate limit usage
 */
async function monitorRateLimit(octokit: Octokit) {
  const { data } = await octokit.rest.rateLimit.get();
  const { remaining, limit, reset } = data.rate;

  const percentUsed = ((limit - remaining) / limit) * 100;
  const resetTime = new Date(reset * 1000);

  // Log to observability platform
  console.log({
    event: 'github.rate_limit',
    remaining,
    limit,
    percentUsed,
    resetTime: resetTime.toISOString(),
  });

  // Alert if usage > 90%
  if (percentUsed > 90) {
    // Send alert to monitoring system
    console.error({
      alert: 'github_rate_limit_high',
      remaining,
      limit,
      resetTime: resetTime.toISOString(),
    });
  }
}

// Call after bulk operations
await fetchChangedFiles(...);
await monitorRateLimit(octokit);
```

---

## Implementation Guide

### Step 1: Update Octokit Package

**File:** `packages/console-octokit-github/package.json`

```json
{
  "dependencies": {
    "@octokit/openapi-types": "^26.0.0",
    "@octokit/plugin-throttling": "^9.3.3",
    "@octokit/plugin-retry": "^7.1.4",
    "octokit": "^5.0.3"
  }
}
```

### Step 2: Create Throttled Octokit Factory

**File:** `packages/console-octokit-github/src/throttled.ts`

```typescript
import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

const ThrottledOctokit = Octokit.plugin(throttling, retry);

export function createThrottledOctokit(auth: string) {
  return new ThrottledOctokit({
    auth,
    throttle: {
      onRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(
          `Rate limit exhausted for ${options.method} ${options.url}`
        );

        if (options.request.retryCount <= 2) {
          console.log(`Retrying after ${retryAfter}s`);
          return true;
        }

        return false;
      },
      onSecondaryRateLimit: (retryAfter, options, octokit) => {
        octokit.log.warn(
          `Secondary rate limit for ${options.method} ${options.url}`
        );
        return false;
      },
    },
    retry: {
      doNotRetry: [400, 401, 403, 404, 422],
    },
  });
}

export async function getThrottledInstallationOctokit(
  app: App,
  installationId: number
) {
  const { token } = await app.octokit.auth({
    type: "installation",
    installationId,
  });

  return createThrottledOctokit(token);
}
```

### Step 3: Implement Content Fetching Service

**File:** `packages/console-api-services/src/github-content-fetcher.ts`

```typescript
import type { Octokit } from "@octokit/core";
import minimatch from "minimatch";

export interface ChangedFile {
  path: string;
  status: "added" | "modified" | "removed";
}

export interface FetchedFile {
  path: string;
  content: string;
  sha: string;
}

export class GitHubContentFetcher {
  constructor(private octokit: Octokit) {}

  /**
   * Fetch changed files using optimal strategy based on count
   */
  async fetchChangedFiles(
    owner: string,
    repo: string,
    changedFiles: ChangedFile[],
    commitSha: string,
    globs: string[]
  ): Promise<Map<string, FetchedFile>> {
    // Filter by globs
    const filtered = changedFiles.filter(file =>
      globs.some(glob => minimatch(file.path, glob))
    );

    // Filter out removed files
    const toFetch = filtered.filter(f => f.status !== "removed");

    if (toFetch.length === 0) {
      return new Map();
    }

    console.log(`[Fetch] Fetching ${toFetch.length} files from ${owner}/${repo}`);

    // Choose strategy based on count
    if (toFetch.length < 20) {
      return this.fetchViaContents(owner, repo, toFetch, commitSha);
    } else {
      return this.fetchViaTreeAndBlobs(owner, repo, toFetch, commitSha);
    }
  }

  /**
   * Strategy 1: Contents API (small changesets)
   */
  private async fetchViaContents(
    owner: string,
    repo: string,
    files: ChangedFile[],
    ref: string
  ): Promise<Map<string, FetchedFile>> {
    const results = new Map<string, FetchedFile>();

    await Promise.all(
      files.map(async (file) => {
        try {
          const { data } = await this.octokit.rest.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref,
          });

          if ("content" in data && data.type === "file") {
            results.set(file.path, {
              path: file.path,
              content: Buffer.from(data.content, "base64").toString("utf-8"),
              sha: data.sha,
            });
          }
        } catch (error) {
          console.error(`[Fetch] Failed to fetch ${file.path}:`, error);
        }
      })
    );

    return results;
  }

  /**
   * Strategy 2: Tree + Blobs API (large changesets)
   */
  private async fetchViaTreeAndBlobs(
    owner: string,
    repo: string,
    files: ChangedFile[],
    treeSha: string
  ): Promise<Map<string, FetchedFile>> {
    const results = new Map<string, FetchedFile>();

    // Step 1: Fetch tree
    const { data: tree } = await this.octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "true",
    });

    // Step 2: Build path -> SHA map
    const pathToSha = new Map<string, string>();
    for (const item of tree.tree) {
      if (item.type === "blob" && item.path) {
        pathToSha.set(item.path, item.sha!);
      }
    }

    // Step 3: Fetch blobs in batches
    const batchSize = 20;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          const blobSha = pathToSha.get(file.path);
          if (!blobSha) {
            console.warn(`[Fetch] No blob SHA for ${file.path}`);
            return;
          }

          try {
            const { data: blob } = await this.octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: blobSha,
            });

            results.set(file.path, {
              path: file.path,
              content: Buffer.from(blob.content, "base64").toString("utf-8"),
              sha: blobSha,
            });
          } catch (error) {
            console.error(`[Fetch] Failed to fetch blob for ${file.path}:`, error);
          }
        })
      );
    }

    return results;
  }
}
```

### Step 4: Update Webhook Handler

**File:** `apps/console/src/app/(github)/api/github/webhooks/route.ts`

```typescript
import { getThrottledInstallationOctokit } from "@repo/console-octokit-github/throttled";
import { GitHubContentFetcher } from "@repo/console-api-services/github-content-fetcher";

async function handlePushEvent(payload: PushPayload, deliveryId: string) {
  // ... existing code ...

  // Fetch lightfast.yml config
  const config = await loadLightfastConfig(
    payload.repository.owner.login,
    payload.repository.name
  );

  // Get installation Octokit with throttling
  const app = createGitHubApp({
    appId: env.GITHUB_APP_ID,
    privateKey: env.GITHUB_APP_PRIVATE_KEY,
  });

  const octokit = await getThrottledInstallationOctokit(
    app,
    payload.installation!.id
  );

  // Fetch file contents
  const fetcher = new GitHubContentFetcher(octokit);
  const files = await fetcher.fetchChangedFiles(
    payload.repository.owner.login,
    payload.repository.name,
    allFiles,
    payload.after,
    config.include
  );

  console.log(`[Webhook] Fetched ${files.size} files`);

  // Trigger Inngest workflow with file contents
  await inngest.send({
    name: "apps-console/docs.push",
    data: {
      workspaceId: payload.repository.full_name,
      storeName: config.store,
      beforeSha: payload.before,
      afterSha: payload.after,
      deliveryId,
      files: Array.from(files.values()),
    },
  });
}
```

### Step 5: Add Rate Limit Monitoring

**File:** `packages/console-api-services/src/github-rate-limit.ts`

```typescript
import type { Octokit } from "@octokit/core";

export async function checkRateLimit(octokit: Octokit) {
  const { data } = await octokit.rest.rateLimit.get();
  const { remaining, limit, reset } = data.rate;

  console.log({
    event: "github.rate_limit",
    remaining,
    limit,
    percentUsed: ((limit - remaining) / limit) * 100,
    resetTime: new Date(reset * 1000).toISOString(),
  });

  if (remaining < 100) {
    console.warn(
      `[RateLimit] Low quota: ${remaining}/${limit} remaining, resets at ${new Date(reset * 1000).toISOString()}`
    );
  }

  return { remaining, limit, reset };
}
```

---

## Performance Estimates

### Scenario A: Small Changeset (10 files)

**Contents API:**
- Requests: 10 (parallel)
- Rate limit usage: 10 requests
- Estimated latency: 1-2 seconds (parallel)
- Rate limit impact: 0.07% of quota (10/15,000)

**Tree + Blobs API:**
- Requests: 11 (1 tree + 10 blobs)
- Rate limit usage: 11 requests
- Estimated latency: 2-3 seconds (sequential tree, then parallel blobs)
- Rate limit impact: 0.07% of quota (11/15,000)

**Recommendation:** Contents API (simpler, similar performance)

### Scenario B: Medium Changeset (50 files)

**Contents API:**
- Requests: 50 (parallel)
- Rate limit usage: 50 requests
- Estimated latency: 2-3 seconds (parallel)
- Rate limit impact: 0.33% of quota (50/15,000)

**Tree + Blobs API:**
- Requests: 51 (1 tree + 50 blobs in 3 batches)
- Rate limit usage: 51 requests
- Estimated latency: 3-4 seconds
- Rate limit impact: 0.34% of quota (51/15,000)

**Recommendation:** Tree + Blobs API (better for larger sets, similar rate limit usage)

### Scenario C: Large Changeset (200 files)

**Contents API:**
- Requests: 200 (parallel)
- Rate limit usage: 200 requests
- Estimated latency: 5-10 seconds
- Rate limit impact: 1.33% of quota (200/15,000)
- Risk: May trigger secondary rate limits

**Tree + Blobs API:**
- Requests: 201 (1 tree + 200 blobs in 10 batches)
- Rate limit usage: 201 requests
- Estimated latency: 8-12 seconds
- Rate limit impact: 1.34% of quota (201/15,000)
- Lower risk of secondary rate limits (batched)

**Recommendation:** Tree + Blobs API (safer for large sets)

### Scenario D: Monorepo Refactor (1000 files)

**Contents API:**
- Requests: 1000
- Rate limit usage: 1000 requests
- Estimated latency: 30-60 seconds
- Rate limit impact: 6.67% of quota (1000/15,000)
- Risk: High probability of secondary rate limits

**Tree + Blobs API:**
- Requests: 1001 (1 tree + 1000 blobs in 50 batches)
- Rate limit usage: 1001 requests
- Estimated latency: 60-90 seconds
- Rate limit impact: 6.67% of quota (1001/15,000)
- Lower risk with batching

**Archive API:**
- Requests: 1 (download tarball)
- Rate limit usage: 1 request
- Estimated latency: 10-30 seconds (download + extract)
- Rate limit impact: 0.007% of quota (1/15,000)

**Recommendation:** Archive API or break into multiple webhook deliveries

### Summary Table

| Scenario | Files | Strategy | Requests | Latency | % Quota | Risk |
|----------|-------|----------|----------|---------|---------|------|
| Small | 10 | Contents | 10 | 1-2s | 0.07% | Low |
| Small | 10 | Tree+Blobs | 11 | 2-3s | 0.07% | Low |
| Medium | 50 | Contents | 50 | 2-3s | 0.33% | Low |
| Medium | 50 | Tree+Blobs | 51 | 3-4s | 0.34% | Low |
| Large | 200 | Contents | 200 | 5-10s | 1.33% | Medium |
| Large | 200 | Tree+Blobs | 201 | 8-12s | 1.34% | Low |
| Monorepo | 1000 | Contents | 1000 | 30-60s | 6.67% | High |
| Monorepo | 1000 | Tree+Blobs | 1001 | 60-90s | 6.67% | Medium |
| Monorepo | 1000 | Archive | 1 | 10-30s | 0.007% | Low |

---

## Testing Strategy

### 1. Local Testing (No Rate Limits)

**Use ngrok for webhook testing:**

```bash
# Terminal 1: Start dev server
pnpm dev:console

# Terminal 2: Start ngrok tunnel
ngrok http 4107

# Update GitHub webhook URL to ngrok URL
# https://abc123.ngrok.io/api/github/webhooks
```

**Test scenarios:**
- Single file change
- Multiple file changes
- Large changeset (create many files at once)
- Non-docs file changes (should be filtered)

### 2. Mock GitHub API

**Use MSW to mock GitHub API:**

```typescript
// tests/mocks/github-api.ts
import { rest } from 'msw';
import { setupServer } from 'msw/node';

export const githubHandlers = [
  // Mock Contents API
  rest.get('https://api.github.com/repos/:owner/:repo/contents/:path', (req, res, ctx) => {
    const { path } = req.params;

    return res(
      ctx.json({
        type: 'file',
        encoding: 'base64',
        content: Buffer.from('# Test Content').toString('base64'),
        sha: 'abc123',
      })
    );
  }),

  // Mock Tree API
  rest.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', (req, res, ctx) => {
    return res(
      ctx.json({
        tree: [
          {
            path: 'docs/test.md',
            type: 'blob',
            sha: 'blob123',
          },
        ],
      })
    );
  }),

  // Mock Blob API
  rest.get('https://api.github.com/repos/:owner/:repo/git/blobs/:sha', (req, res, ctx) => {
    return res(
      ctx.json({
        content: Buffer.from('# Test Content').toString('base64'),
        encoding: 'base64',
      })
    );
  }),

  // Mock Rate Limit API
  rest.get('https://api.github.com/rate_limit', (req, res, ctx) => {
    return res(
      ctx.json({
        rate: {
          limit: 15000,
          remaining: 14999,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      })
    );
  }),
];

export const server = setupServer(...githubHandlers);
```

### 3. Rate Limit Testing

**Strategy:** Use a test GitHub App with low rate limits.

**Create test GitHub App:**
1. Create a new GitHub App for testing
2. Install on a test repository
3. Generate installation token
4. Make requests until rate limit hit
5. Verify throttling plugin behavior

**Test cases:**
- Approach rate limit (remaining < 100)
- Hit primary rate limit (429 response)
- Hit secondary rate limit (403 response)
- Verify exponential backoff
- Verify retry logic

### 4. Performance Testing

**Use k6 for load testing:**

```javascript
// tests/load/github-webhook.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Steady state
    { duration: '1m', target: 0 },  // Ramp down
  ],
};

export default function () {
  const payload = {
    ref: 'refs/heads/main',
    before: 'abc123',
    after: 'def456',
    repository: {
      id: 123456,
      full_name: 'test/repo',
    },
    commits: [
      {
        id: 'commit1',
        added: ['docs/test1.md', 'docs/test2.md'],
        modified: [],
        removed: [],
      },
    ],
  };

  const res = http.post(
    'https://your-app.com/api/github/webhooks',
    JSON.stringify(payload),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': `test-${Date.now()}`,
        'X-Hub-Signature-256': generateSignature(payload),
      },
    }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 5s': (r) => r.timings.duration < 5000,
  });
}
```

### 5. Integration Testing

**Test full flow:**

```typescript
// tests/integration/docs-ingestion.test.ts
import { describe, test, expect } from 'vitest';
import { createGitHubApp } from '@repo/console-octokit-github';

describe('Docs Ingestion', () => {
  test('fetches changed files and ingests to Pinecone', async () => {
    const app = createGitHubApp({
      appId: process.env.GITHUB_APP_ID_TEST!,
      privateKey: process.env.GITHUB_PRIVATE_KEY_TEST!,
    });

    // Trigger webhook
    const response = await fetch('http://localhost:4107/api/github/webhooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': 'test-123',
        'X-Hub-Signature-256': 'sha256=...',
      },
      body: JSON.stringify(mockPushPayload),
    });

    expect(response.status).toBe(200);

    // Wait for ingestion to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Query Pinecone to verify ingestion
    const searchResults = await queryPinecone({
      query: 'test content',
      store: 'docs-test',
    });

    expect(searchResults.length).toBeGreaterThan(0);
  });
});
```

---

## Summary & Recommendations

### Phase 1 Implementation

**Use Hybrid Strategy:**

1. **Small changesets (< 20 files):**
   - Use Contents API
   - Parallel fetching
   - Simple, reliable

2. **Large changesets (20-300 files):**
   - Use Tree + Blobs API
   - Batched blob fetching
   - Efficient rate limit usage

3. **Always apply:**
   - Filter by lightfast.yml globs
   - Content hash comparison
   - Idempotency by delivery ID
   - Octokit throttling plugin
   - Rate limit monitoring

### Key Benefits

- **Efficient:** Minimal rate limit usage for common case
- **Scalable:** Handles large changesets gracefully
- **Reliable:** Throttling + retry + exponential backoff
- **Observable:** Rate limit monitoring and alerting
- **Safe:** Idempotency prevents duplicate processing

### Next Steps

1. Update `@repo/console-octokit-github` with throttling plugin
2. Create `GitHubContentFetcher` service
3. Update webhook handler to use new fetching logic
4. Add rate limit monitoring
5. Test with various changeset sizes
6. Deploy and monitor rate limit usage

### Expected Rate Limit Usage

**Typical docs repository:**
- Average push: 1-5 files
- Rate limit usage: 5-10 requests/push
- Quota impact: < 0.1% per push
- **Can handle 1500+ pushes per hour**

**Large refactor:**
- 200 files changed
- Rate limit usage: 201 requests
- Quota impact: 1.34%
- **Can handle 74 large refactors per hour**

**Conclusion:** With 15,000 requests/hour for Enterprise Cloud, we have ample capacity for Phase 1 docs sync with significant headroom for growth.
