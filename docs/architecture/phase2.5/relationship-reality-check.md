# Relationship Extraction Reality Check

**Date:** 2025-11-12
**Status:** Critical Architecture Gap Identified

---

## The Real Problem

**Current Implementation:**
- We only ingest **markdown files** from GitHub repos
- Relationship extraction runs regex patterns on file content
- Result: Almost no meaningful relationships found

**What We're Missing:**
- GitHub **PRs** (pull requests)
- GitHub **Issues**
- GitHub **Commits**
- GitHub **Reviews**
- Linear **Issues/Tickets**
- Notion **Pages**
- Sentry **Errors**
- Vercel **Deployments**

## Where Real Relationships Come From

### Tier 1: Structured API Data (90% of value, 95%+ precision)

**From GitHub PR API:**
```typescript
{
  number: 456,
  title: "Fix auth timeout",
  author: { login: "alice" },              // AUTHORED_BY relationship
  assignees: [{ login: "bob" }],           // ASSIGNED_TO relationship
  reviewers: [{ login: "carol" }],         // REVIEWED_BY relationship
  linked_issues: [                          // RESOLVES relationship
    { number: 123, repository: "lightfastai/lightfast" }
  ],
  commits: [                                // INCLUDES_COMMIT relationship
    { sha: "abc123", author: "alice" }
  ],
  changed_files: [                          // TOUCHES_FILE relationship
    { filename: "src/auth/session.ts", changes: 45 }
  ],
  labels: ["bug", "security"],             // TAGGED_WITH relationship
  milestone: { title: "v1.0" },            // PART_OF relationship
  base_branch: "main",                      // TARGETS_BRANCH relationship
  merged_at: "2025-01-15T10:30:00Z",       // MERGED_AT timestamp
  closed_issues: [                          // CLOSES relationship (from API)
    { number: 123, type: "issue" }
  ]
}
```

**From GitHub Issue API:**
```typescript
{
  number: 123,
  title: "Auth timeout on production",
  author: { login: "dave" },               // AUTHORED_BY
  assignees: [{ login: "alice" }],         // ASSIGNED_TO
  labels: ["bug", "p0"],                   // TAGGED_WITH
  milestone: { title: "v1.0" },            // PART_OF
  linked_prs: [456, 457],                  // RESOLVED_BY (reverse of RESOLVES)
  comments: [                               // HAS_COMMENT
    { author: "bob", created_at: "..." }
  ],
  references: [                             // REFERENCES (from GitHub's API)
    { type: "issue", number: 100 }
  ]
}
```

**From CODEOWNERS File:**
```
src/auth/*  @auth-team @alice
src/api/*   @backend-team
docs/*      @docs-team
```
→ Generates `OWNED_BY` relationships

**From Commit Graph:**
```typescript
{
  sha: "abc123",
  author: { login: "alice" },              // AUTHORED_BY
  committer: { login: "github-actions" },  // COMMITTED_BY
  parents: ["xyz789"],                      // CHILD_OF
  files: [                                  // MODIFIES_FILE
    { filename: "src/auth/session.ts" }
  ],
  message: "Fix session timeout\n\nCloses #123"  // Regex can supplement here
}
```

### Tier 2: Cross-Source References (Medium precision, needs validation)

**Linear Issue → GitHub PR:**
```typescript
{
  id: "LIN-123",
  title: "Fix auth timeout",
  description: "See PR: https://github.com/lightfastai/lightfast/pull/456"
  // → REFERENCES relationship
}
```

**Notion Page → GitHub/Linear:**
```markdown
# Auth Architecture

Related issues:
- Linear: https://linear.app/team/issue/LIN-123
- GitHub PR: https://github.com/lightfastai/lightfast/pull/456
```

**Sentry Error → GitHub Commit:**
```typescript
{
  eventId: "sentry-xyz",
  release: "v1.2.3",
  commits: [                                // CAUSED_BY relationship
    { sha: "abc123" }
  ],
  firstSeen: "2025-01-15T10:35:00Z",       // After PR#456 merged!
  stacktrace: [
    { filename: "src/auth/session.ts", lineno: 45 }
  ]
}
```

### Tier 3: Semantic/LLM (Low-medium precision, needs confidence scoring)

**Natural Language References:**
```markdown
# PR Description
This fixes the auth timeout issue that was affecting production users.

The root cause was a bug in the session middleware where tokens weren't
being refreshed correctly. Similar to the problem we had in Q3 with
the refresh token logic.

I also updated the docs in /docs/auth/sessions.md to reflect the new
behavior.
```

**What LLM should extract:**
- "auth timeout issue" → semantic link to Issue#123 (topic match)
- "session middleware" → semantic link to `src/auth/session.ts` file
- "refresh token logic" → semantic link to Q3 PR#389 (historical)
- "/docs/auth/sessions.md" → explicit file reference
- "production users" → relates to Sentry errors in production

---

## What We Should Actually Build

### Phase 0: Ingest GitHub Entities (Not Just Files!)

**New Document Types:**
```typescript
sourceType: "github"
documentType: "file" | "pull_request" | "issue" | "commit" | "review" | "comment"
```

**New Workflows:**
```
1. GitHub PR Webhook → Ingest PR as document
   - Store PR metadata in sourceMetadata
   - Extract structured relationships from API
   - Index PR title + body for semantic search

2. GitHub Issue Webhook → Ingest Issue as document
   - Store issue metadata
   - Extract structured relationships
   - Index for search

3. GitHub Push Webhook → Ingest Commits (in addition to files)
   - Store commit metadata
   - Extract commit → file relationships
   - Extract commit → PR relationships

4. CODEOWNERS Parser → Extract ownership relationships
   - Parse CODEOWNERS file
   - Generate file → team/person relationships
```

### Phase 1: Structured Relationship Extraction

**From API data directly (no regex needed!):**
```typescript
export async function extractGitHubPRRelationships(pr: GitHubPR) {
  const relationships: Relationship[] = [];

  // Author
  relationships.push({
    type: "AUTHORED_BY",
    from: `github/pr/${pr.number}`,
    to: `github/user/${pr.author.login}`,
    confidence: 1.0,
    source: "github_api",
  });

  // Assignees
  for (const assignee of pr.assignees) {
    relationships.push({
      type: "ASSIGNED_TO",
      from: `github/pr/${pr.number}`,
      to: `github/user/${assignee.login}`,
      confidence: 1.0,
      source: "github_api",
    });
  }

  // Linked issues (GitHub's own linking system!)
  for (const issue of pr.linked_issues) {
    relationships.push({
      type: "RESOLVES",
      from: `github/pr/${pr.number}`,
      to: `github/issue/${issue.number}`,
      confidence: 1.0,
      source: "github_api",
      evidence: { field: "linked_issues" },
    });
  }

  // Changed files
  for (const file of pr.changed_files) {
    relationships.push({
      type: "TOUCHES_FILE",
      from: `github/pr/${pr.number}`,
      to: `github/file/${file.filename}`,
      confidence: 1.0,
      source: "github_api",
      metadata: { additions: file.additions, deletions: file.deletions },
    });
  }

  // Reviewers
  for (const reviewer of pr.reviewers) {
    relationships.push({
      type: "REVIEWED_BY",
      from: `github/pr/${pr.number}`,
      to: `github/user/${reviewer.login}`,
      confidence: 1.0,
      source: "github_api",
    });
  }

  return relationships;
}
```

**Result:** 95%+ precision, high recall, zero regex!

### Phase 2: Regex Supplementary Extraction

**Only for text content when API doesn't provide it:**
```typescript
// Supplement with text parsing (PR body, commit messages)
const bodyRelationships = extractFromText(pr.body, {
  patterns: [
    { regex: /closes?\s+#(\d+)/gi, type: "CLOSES" },
    { regex: /fixes?\s+#(\d+)/gi, type: "FIXES" },
    { regex: /related\s+to\s+#(\d+)/gi, type: "RELATED_TO" },
    { regex: /LIN-(\d+)/gi, type: "REFERENCES", target: "linear" },
  ],
});
```

**Result:** 10-20% additional relationships, 90%+ precision

### Phase 3: LLM Semantic Extraction

**For implicit/semantic relationships:**
```typescript
const semanticRelationships = await extractWithLLM({
  document: pr,
  context: [
    ...recentIssues,
    ...relatedFiles,
    ...previousPRs,
  ],
  extractors: [
    "topical_similarity",      // "auth timeout" → Issue#123
    "file_references",          // "in the session middleware" → file
    "causal_relationships",     // "This fixes..." → what does it fix?
    "temporal_references",      // "Q3 issue" → historical PR
  ],
});
```

**Result:** 30-40% additional relationships, 70-85% precision (after review)

---

## Revised Architecture

### Ingestion Pipeline

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Webhook Handlers                     │
├─────────────────────────────────────────────────────────┤
│  • Pull Request (opened/updated/closed/merged)          │
│  • Issue (opened/updated/closed)                        │
│  • Push (commits + files)                               │
│  • Pull Request Review                                   │
│  • Issue Comment                                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│         Fetch Full Entity from GitHub API                │
│  • PR: metadata + files + reviews + linked issues       │
│  • Issue: metadata + comments + linked PRs              │
│  • Commit: metadata + files + parents                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              Create Document Record                      │
│  • sourceType: "github"                                  │
│  • documentType: "pull_request" | "issue" | "commit"    │
│  • sourceId: PR#123, Issue#456, commit SHA              │
│  • sourceMetadata: Full API response                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│     STAGE 1: Extract Structured Relationships           │
│  • From API fields (author, assignees, linked items)    │
│  • Confidence: 1.0 (deterministic)                      │
│  • Evidence: API field names                            │
│  • Result: 80-90% of valuable relationships             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│     STAGE 2: Extract Text-Based Relationships           │
│  • Regex patterns on PR body, commit messages           │
│  • Confidence: 0.9-1.0 (high precision patterns)        │
│  • Evidence: Matched text + position                    │
│  • Result: 5-10% additional relationships               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│        STAGE 3: Bidirectional Building                  │
│  • For each A→B, create B→A                             │
│  • Handle pending relationships                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│     STAGE 4: LLM Semantic Extraction (async)            │
│  • Topical similarity, implicit references              │
│  • Confidence: 0.6-0.9 (needs review)                   │
│  • Evidence: Text spans + reasoning                     │
│  • Result: 5-15% additional relationships               │
└─────────────────────────────────────────────────────────┘
```

---

## Example: Real PR Ingestion

**GitHub PR #456:**
```json
{
  "number": 456,
  "title": "Fix authentication timeout in production",
  "body": "This fixes the session expiration bug reported in LIN-123.\n\nThe root cause was incorrect token refresh logic in the middleware.\nSimilar to the issue we had in #389 last quarter.\n\nTested locally and verified the fix works.",
  "author": { "login": "alice" },
  "assignees": [{ "login": "bob" }],
  "reviewers": [{ "login": "carol" }],
  "labels": ["bug", "security", "p0"],
  "milestone": { "title": "v1.0" },
  "changed_files": [
    { "filename": "src/auth/session.ts", "additions": 15, "deletions": 8 },
    { "filename": "src/auth/middleware.ts", "additions": 3, "deletions": 2 }
  ],
  "commits": [
    { "sha": "abc123", "message": "Fix token refresh logic" },
    { "sha": "def456", "message": "Add tests for session timeout" }
  ],
  "linked_issues": [123],
  "created_at": "2025-01-15T09:00:00Z",
  "merged_at": "2025-01-15T10:30:00Z"
}
```

**Extracted Relationships:**

**Stage 1 (API Structured - 11 relationships, 100% confidence):**
```typescript
[
  { type: "AUTHORED_BY", from: "PR#456", to: "@alice", confidence: 1.0, source: "api" },
  { type: "ASSIGNED_TO", from: "PR#456", to: "@bob", confidence: 1.0, source: "api" },
  { type: "REVIEWED_BY", from: "PR#456", to: "@carol", confidence: 1.0, source: "api" },
  { type: "TAGGED_WITH", from: "PR#456", to: "label:bug", confidence: 1.0, source: "api" },
  { type: "TAGGED_WITH", from: "PR#456", to: "label:security", confidence: 1.0, source: "api" },
  { type: "TAGGED_WITH", from: "PR#456", to: "label:p0", confidence: 1.0, source: "api" },
  { type: "PART_OF", from: "PR#456", to: "milestone:v1.0", confidence: 1.0, source: "api" },
  { type: "TOUCHES_FILE", from: "PR#456", to: "src/auth/session.ts", confidence: 1.0, source: "api" },
  { type: "TOUCHES_FILE", from: "PR#456", to: "src/auth/middleware.ts", confidence: 1.0, source: "api" },
  { type: "INCLUDES_COMMIT", from: "PR#456", to: "abc123", confidence: 1.0, source: "api" },
  { type: "INCLUDES_COMMIT", from: "PR#456", to: "def456", confidence: 1.0, source: "api" },
]
```

**Stage 2 (Regex Text - 2 relationships, 95% confidence):**
```typescript
[
  { type: "RESOLVES", from: "PR#456", to: "LIN-123", confidence: 0.95, source: "regex",
    evidence: "This fixes the session expiration bug reported in LIN-123." },
  { type: "RELATED_TO", from: "PR#456", to: "Issue#389", confidence: 0.95, source: "regex",
    evidence: "Similar to the issue we had in #389 last quarter." },
]
```

**Stage 3 (Bidirectional - 13 reverse relationships):**
```typescript
[
  { type: "AUTHORED", from: "@alice", to: "PR#456", ... },
  { type: "ASSIGNED", from: "@bob", to: "PR#456", ... },
  { type: "REVIEWED", from: "@carol", to: "PR#456", ... },
  { type: "APPLIED_TO", from: "label:bug", to: "PR#456", ... },
  // ... etc for all forward relationships
]
```

**Stage 4 (LLM Semantic - 5 relationships, 60-85% confidence):**
```typescript
[
  { type: "ADDRESSES_PROBLEM", from: "PR#456", to: "Sentry:auth-timeout-spike",
    confidence: 0.85, source: "llm",
    evidence: "session expiration bug",
    reasoning: "PR mentions 'session expiration' and Sentry shows spike in auth timeouts on 2025-01-14" },

  { type: "IMPLEMENTS_SPEC", from: "PR#456", to: "docs/auth/sessions.md",
    confidence: 0.75, source: "llm",
    evidence: "token refresh logic",
    reasoning: "PR modifies token refresh, spec document describes expected behavior" },

  { type: "SIMILAR_TO", from: "PR#456", to: "PR#389",
    confidence: 0.8, source: "llm",
    evidence: "Similar to the issue we had in #389",
    reasoning: "Explicit textual reference + both PRs modify auth middleware" },

  { type: "CAUSED_ERROR", from: "commit:abc123", to: "Sentry:xyz",
    confidence: 0.7, source: "llm",
    reasoning: "Commit merged at 10:30, Sentry error first seen at 10:35, same file" },

  { type: "DISCUSSED_IN", from: "PR#456", to: "Slack:thread-123",
    confidence: 0.65, source: "llm",
    reasoning: "Slack thread from @alice discussing 'auth timeout' 1 day before PR created" },
]
```

**Total: 31 relationships extracted**
- 11 from API (100% confidence)
- 2 from regex (95% confidence)
- 13 bidirectional (derived)
- 5 from LLM (60-85% confidence)

---

## Why Current Approach Fails

**Problem:** We only ingest markdown files, not GitHub entities
**Impact:**
- Miss 90% of valuable structured relationships
- Rely entirely on regex patterns in file content
- No author, assignee, reviewer relationships
- No file → PR relationships
- No PR → issue relationships
- No commit graph relationships

**Example:**
```
Current: Ingest README.md → find "See issue #123" via regex → 1 relationship

Should be: Ingest PR#456 → extract 20+ relationships from API + text + LLM
```

---

## Next Steps

### Immediate (Week 1)
1. **Design GitHub entity ingestion webhooks**
   - PR webhooks (opened, updated, merged, closed)
   - Issue webhooks
   - Push webhooks (for commits)

2. **Update document schema**
   - Add `documentType` field: "file" | "pull_request" | "issue" | "commit"
   - Design `sourceMetadata` structure for each type

3. **Implement structured relationship extractors**
   - `extractPRRelationships(pr)` - from API fields
   - `extractIssueRelationships(issue)` - from API fields
   - `extractCommitRelationships(commit)` - from API fields

### Short-term (Weeks 2-4)
4. **Build bidirectional relationship system**
5. **Implement backfill for existing data**
6. **Add CODEOWNERS parsing**

### Medium-term (Weeks 5-8)
7. **LLM semantic extraction**
8. **Confidence scoring and adjudication**
9. **Cross-source relationships** (GitHub ↔ Linear ↔ Notion)

---

## Key Insight

**The relationship problem isn't about extraction algorithms - it's about what we're ingesting.**

- Regex on markdown files: ~5% recall
- Structured API data: ~85% recall, 95%+ precision
- LLM on API + text: ~95% recall, 80%+ precision

**Fix:** Ingest GitHub PRs/issues/commits as first-class documents, not just markdown files.
