# Cross-Source Relationship Extraction

**Date:** 2025-11-12
**Status:** Design Specification

---

## The Problem

Cross-source relationships are **much harder** than single-source because:

1. **Entity Resolution** - "LIN-123" in GitHub PR → which actual Linear issue?
2. **Source Availability** - What if Linear isn't connected when PR is ingested?
3. **Bidirectional Discovery** - Linear links to GitHub, but GitHub doesn't know
4. **Semantic Matching** - "implements the auth spec" → which Notion page?
5. **Identity Mapping** - @alice on GitHub = alice@company.com in Linear?

---

## Scenarios & Solutions

### Scenario 1: GitHub PR → Linear Issue (Explicit Reference)

**Context:**
```markdown
PR #456 body:
"Closes LIN-123

Fixed the auth timeout bug that was causing production issues."
```

**Extraction Steps:**

**Step 1: Pattern Detection (Deterministic)**
```typescript
// In GitHub PR processor
const linearRefs = extractLinearReferences(pr.body);
// Result: ["LIN-123"]

// Create pending relationship
{
  type: "RESOLVES",
  from: { sourceType: "github", sourceId: "pr/456" },
  to: { sourceType: "linear", sourceId: "LIN-123" },  // Not resolved yet!
  confidence: 0.95,
  status: "pending_resolution",
  evidence: {
    text: "Closes LIN-123",
    position: { line: 0, column: 0 }
  }
}
```

**Step 2: Entity Resolution (Async)**
```typescript
// Resolution workflow - runs after both sources ingested
export const resolveLinearReference = inngest.createFunction(
  { id: "resolve-linear-reference" },
  { event: "relationships.pending-resolution" },
  async ({ event }) => {
    const { relationship } = event.data;

    // Try to find Linear issue in our database
    const linearIssue = await db
      .select()
      .from(docsDocuments)
      .where(
        and(
          eq(docsDocuments.sourceType, "linear"),
          eq(docsDocuments.sourceId, "LIN-123"),
          eq(docsDocuments.workspaceId, relationship.workspaceId)
        )
      )
      .limit(1);

    if (linearIssue) {
      // FOUND IT! Upgrade to resolved relationship
      await createRelationship({
        type: "RESOLVES",
        fromDocumentId: relationship.fromDocumentId,
        toDocumentId: linearIssue.id,
        confidence: 0.95,
        status: "resolved",
        evidence: relationship.evidence
      });

      // Create reverse relationship
      await createRelationship({
        type: "RESOLVED_BY",
        fromDocumentId: linearIssue.id,
        toDocumentId: relationship.fromDocumentId,
        confidence: 0.95,
        status: "resolved",
        evidence: relationship.evidence
      });

      return { status: "resolved" };
    } else {
      // Not found yet - keep as pending
      // Will retry when Linear issues are ingested
      return { status: "pending", retryAfter: "linear.issue.ingested" };
    }
  }
);
```

**Step 3: Backfill Trigger (When Linear Connected)**
```typescript
// When Linear is first connected, trigger resolution of all pending refs
export const linearConnectedHandler = inngest.createFunction(
  { id: "linear-connected-handler" },
  { event: "sources.linear.connected" },
  async ({ event }) => {
    const { workspaceId } = event.data;

    // Find all pending Linear references
    const pendingRefs = await db
      .select()
      .from(pendingRelationships)
      .where(
        and(
          eq(pendingRelationships.workspaceId, workspaceId),
          eq(pendingRelationships.targetSourceType, "linear")
        )
      );

    // Trigger resolution for each
    await inngest.send(
      pendingRefs.map(ref => ({
        name: "relationships.pending-resolution",
        data: { relationship: ref }
      }))
    );

    return { status: "triggered", count: pendingRefs.length };
  }
);
```

**Result:**
- PR knows it resolves LIN-123 (forward relationship)
- Linear issue knows it was resolved by PR#456 (reverse relationship)
- Works even if sources connected in any order

---

### Scenario 2: Linear Issue → GitHub PR (API Provided)

**Context:**
Linear API provides GitHub branch/PR integration:

```json
{
  "id": "LIN-123",
  "title": "Fix auth timeout",
  "branchName": "fix/auth-timeout",
  "gitBranchCreated": true,
  "attachments": [
    {
      "url": "https://github.com/lightfastai/lightfast/pull/456",
      "title": "PR #456: Fix auth timeout"
    }
  ]
}
```

**Extraction (Deterministic - HIGH confidence):**
```typescript
export function extractLinearGitHubRelationships(issue: LinearIssue) {
  const relationships: Relationship[] = [];

  // From attachments
  for (const attachment of issue.attachments) {
    const prMatch = attachment.url.match(
      /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/
    );
    if (prMatch) {
      relationships.push({
        type: "REFERENCES",
        from: { sourceType: "linear", sourceId: issue.id },
        to: {
          sourceType: "github",
          sourceId: `pr/${prMatch[2]}`,
          repo: prMatch[1]
        },
        confidence: 1.0,  // From API, not text parsing!
        source: "linear_api",
        evidence: { field: "attachments", url: attachment.url }
      });
    }
  }

  // From branch name (if GitHub integration enabled)
  if (issue.gitBranchCreated && issue.branchName) {
    relationships.push({
      type: "IMPLEMENTED_IN_BRANCH",
      from: { sourceType: "linear", sourceId: issue.id },
      to: {
        sourceType: "github",
        sourceId: `branch/${issue.branchName}`,
        repo: issue.team.gitHubRepo  // If available in Linear config
      },
      confidence: 1.0,
      source: "linear_api",
      evidence: { field: "branchName" }
    });
  }

  return relationships;
}
```

**Key Insight:** Linear's GitHub integration gives us **deterministic** relationships!

---

### Scenario 3: Notion Page → GitHub/Linear (URL Extraction)

**Context:**
```markdown
# Auth Architecture Spec

## Implementation Status
- Linear issue: https://linear.app/lightfast/issue/LIN-123
- GitHub PR: https://github.com/lightfastai/lightfast/pull/456
- Related docs: /docs/auth/sessions.md
```

**Extraction:**
```typescript
export function extractNotionCrossSourceRefs(page: NotionPage) {
  const relationships: Relationship[] = [];
  const content = notionToMarkdown(page.blocks);

  // Extract Linear URLs
  const linearPattern = /https:\/\/linear\.app\/([^/]+)\/issue\/([A-Z]+-\d+)/g;
  for (const match of content.matchAll(linearPattern)) {
    relationships.push({
      type: "REFERENCES",
      from: { sourceType: "notion", sourceId: page.id },
      to: { sourceType: "linear", sourceId: match[2] },
      confidence: 0.95,
      source: "url_extraction",
      evidence: { url: match[0], context: getContext(content, match.index) }
    });
  }

  // Extract GitHub PR/Issue URLs
  const githubPattern = /https:\/\/github\.com\/([^/]+\/[^/]+)\/(pull|issues)\/(\d+)/g;
  for (const match of content.matchAll(githubPattern)) {
    relationships.push({
      type: "REFERENCES",
      from: { sourceType: "notion", sourceId: page.id },
      to: {
        sourceType: "github",
        sourceId: `${match[2] === 'pull' ? 'pr' : 'issue'}/${match[3]}`,
        repo: match[1]
      },
      confidence: 0.95,
      source: "url_extraction",
      evidence: { url: match[0], context: getContext(content, match.index) }
    });
  }

  // Extract internal doc references
  const docPattern = /\/docs\/([^\s\)]+\.md)/g;
  for (const match of content.matchAll(docPattern)) {
    relationships.push({
      type: "REFERENCES",
      from: { sourceType: "notion", sourceId: page.id },
      to: { sourceType: "github", sourceId: `file/${match[1]}` },
      confidence: 0.90,
      source: "path_extraction",
      evidence: { path: match[1], context: getContext(content, match.index) }
    });
  }

  return relationships;
}
```

**Confidence Levels:**
- Full URL with domain: 0.95 (very likely correct)
- Path reference: 0.90 (might be ambiguous)
- Text mention: 0.70-0.85 (needs validation)

---

### Scenario 4: Semantic Cross-Source (LLM Required)

**Context:**
```markdown
# GitHub PR #456
Title: "Fix authentication timeout"
Body: "This implements the session management improvements
       outlined in the auth architecture spec."
```

```markdown
# Notion Page "Auth Architecture v2"
Title: "Authentication Architecture v2"
Content: "
## Session Management
We need to improve token refresh logic to prevent timeouts.
Current implementation has a race condition in the middleware.
"
```

**Problem:** No explicit reference, but semantic connection exists!

**LLM Extraction:**
```typescript
export const extractSemanticCrossSourceRels = inngest.createFunction(
  { id: "extract-semantic-cross-source" },
  { event: "documents.semantic-extraction-requested" },
  async ({ event, step }) => {
    const { document } = event.data;

    // Step 1: Find potentially related documents via vector search
    const candidates = await step.run("find-candidates", async () => {
      return await vectorSearch({
        query: document.title + "\n\n" + document.content,
        filters: {
          workspaceId: document.workspaceId,
          sourceType: { $nin: [document.sourceType] }  // Different sources!
        },
        limit: 20
      });
    });

    // Step 2: LLM evaluation
    const proposals = await step.run("llm-evaluation", async () => {
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: buildCrossSourcePrompt(document, candidates)
        }]
      });

      return parseRelationshipProposals(response.content);
    });

    // Step 3: Confidence gating
    const filtered = proposals.filter(p => {
      // Accept high confidence
      if (p.confidence >= 0.80) return true;

      // Queue medium confidence for review
      if (p.confidence >= 0.60) {
        enqueueForAdjudication(p);
        return false;
      }

      // Discard low confidence
      return false;
    });

    return { accepted: filtered.length, queued: proposals.length - filtered.length };
  }
);
```

**LLM Prompt:**
```
You are an expert at identifying relationships between software development artifacts.

SOURCE DOCUMENT:
Type: GitHub Pull Request #456
Title: "Fix authentication timeout"
Body: """
This implements the session management improvements outlined in the auth architecture spec.
The main change is fixing the token refresh race condition in the middleware.
"""

CANDIDATE DOCUMENTS:
1. Notion Page "Auth Architecture v2"
   Content: "## Session Management
            We need to improve token refresh logic to prevent timeouts..."

2. Linear Issue LIN-89
   Title: "Production auth timeouts"

3. Notion Page "API Design Guidelines"
   Content: "General patterns for API development..."

TASK:
For each candidate, determine if there's a meaningful relationship with the source document.

Output JSON array:
[
  {
    "candidateId": 1,
    "relationshipType": "IMPLEMENTS" | "REFERENCES" | "RESOLVES" | "RELATED_TO" | "NONE",
    "confidence": 0.0-1.0,
    "reasoning": "Why this relationship exists",
    "evidence": "Quote relevant text from both documents"
  }
]

RULES:
- Only propose relationships with clear evidence
- Confidence ≥0.8 for strong connections
- Confidence 0.6-0.79 for likely connections
- Confidence <0.6 means no relationship
```

**LLM Response:**
```json
[
  {
    "candidateId": 1,
    "relationshipType": "IMPLEMENTS",
    "confidence": 0.88,
    "reasoning": "PR explicitly states it implements improvements outlined in spec. Both mention 'session management', 'token refresh', and 'race condition' in middleware.",
    "evidence": {
      "source": "implements the session management improvements outlined in the auth architecture spec",
      "target": "We need to improve token refresh logic to prevent timeouts"
    }
  },
  {
    "candidateId": 2,
    "relationshipType": "RESOLVES",
    "confidence": 0.75,
    "reasoning": "PR fixes auth timeout issue, Linear issue reports auth timeouts in production. Temporal correlation (issue created 2 days before PR).",
    "evidence": {
      "source": "Fix authentication timeout",
      "target": "Production auth timeouts"
    }
  },
  {
    "candidateId": 3,
    "relationshipType": "NONE",
    "confidence": 0.15,
    "reasoning": "No specific connection. General guideline doc doesn't relate to this specific fix."
  }
]
```

**Result:**
- Candidate 1: Auto-accept (confidence 0.88)
- Candidate 2: Queue for review (confidence 0.75)
- Candidate 3: Discard (confidence 0.15)

---

### Scenario 5: Person Identity Across Sources

**Context:**
```
GitHub PR #456: author = "alice-dev"
Linear Issue LIN-123: creator = "alice@company.com"
Notion Page: created_by = "Alice Smith" (alice@company.com)
```

**Problem:** Same person, three different identifiers!

**Solution: Entity Aliases (from docs/architecture/identity.md)**

```typescript
// Entity aliases table (per workspace)
{
  entityId: "person_abc123",
  workspaceId: "ws_xyz",
  aliasType: "github_login",
  value: "alice-dev",
  verified: true
}
{
  entityId: "person_abc123",
  workspaceId: "ws_xyz",
  aliasType: "email",
  value: "alice@company.com",
  verified: true
}
{
  entityId: "person_abc123",
  workspaceId: "ws_xyz",
  aliasType: "linear_user_id",
  value: "linear_user_789",
  verified: true
}
```

**Resolution Process:**
```typescript
export async function resolvePersonEntity(
  provider: string,
  providerId: string,
  email: string | null,
  workspaceId: string
): Promise<string> {  // Returns entity ID

  // Step 1: Try exact provider ID match
  const byProviderId = await db
    .select()
    .from(entityAliases)
    .where(
      and(
        eq(entityAliases.workspaceId, workspaceId),
        eq(entityAliases.aliasType, `${provider}_user_id`),
        eq(entityAliases.value, providerId)
      )
    )
    .limit(1);

  if (byProviderId[0]) {
    return byProviderId[0].entityId;
  }

  // Step 2: Try verified email match
  if (email) {
    const byEmail = await db
      .select()
      .from(entityAliases)
      .where(
        and(
          eq(entityAliases.workspaceId, workspaceId),
          eq(entityAliases.aliasType, "email"),
          eq(entityAliases.value, email),
          eq(entityAliases.verified, true)
        )
      )
      .limit(1);

    if (byEmail[0]) {
      // Add new alias for this provider
      await db.insert(entityAliases).values({
        entityId: byEmail[0].entityId,
        workspaceId,
        aliasType: `${provider}_user_id`,
        value: providerId,
        verified: true
      });

      return byEmail[0].entityId;
    }
  }

  // Step 3: Create new person entity
  const newEntity = await db.insert(entities).values({
    workspaceId,
    kind: "person",
    name: extractName(provider, providerId, email)
  }).returning();

  // Add aliases
  await db.insert(entityAliases).values([
    {
      entityId: newEntity.id,
      workspaceId,
      aliasType: `${provider}_user_id`,
      value: providerId,
      verified: true
    },
    ...(email ? [{
      entityId: newEntity.id,
      workspaceId,
      aliasType: "email",
      value: email,
      verified: false  // Needs verification
    }] : [])
  ]);

  return newEntity.id;
}
```

**Result:**
- @alice-dev on GitHub = alice@company.com in Linear = Alice in Notion
- All their work across sources linked to same person entity
- Can query "everything Alice worked on" across all sources

---

## Pipeline Architecture

### Multi-Stage Cross-Source Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│         STAGE 1: Ingest Document with Source Metadata           │
│  • GitHub PR → sourceMetadata.author.login = "alice-dev"        │
│  • Linear Issue → sourceMetadata.creator.email = "alice@co.com" │
│  • Notion Page → sourceMetadata.created_by = "Alice Smith"      │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│    STAGE 2: Extract Cross-Source References (Deterministic)     │
│  • Regex patterns: "Closes LIN-123", URLs, @mentions           │
│  • API data: Linear attachments, GitHub linked issues          │
│  • Confidence: 0.95-1.0                                         │
│  • Output: Pending relationships (unresolved targets)           │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│         STAGE 3: Entity Resolution (Person/Artifact)            │
│  • Resolve "alice-dev" → person_abc123                          │
│  • Resolve "LIN-123" → linear_issue_xyz                         │
│  • Resolve "#456" → github_pr_789                               │
│  • Update relationship targets with resolved IDs                │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 4: Bidirectional Building                    │
│  • For each A→B, create B→A if B exists                         │
│  • Store A→B as pending if B doesn't exist yet                  │
│  • Trigger: When B is ingested, resolve pending                 │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│        STAGE 5: Semantic Matching (LLM, Async, Batched)         │
│  • Vector search for candidates                                 │
│  • LLM evaluates semantic relationships                         │
│  • Confidence gating (≥0.8 auto, 0.6-0.8 review, <0.6 discard) │
│  • Never overwrite deterministic relationships                  │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│         STAGE 6: Backfill (When New Source Connected)           │
│  • When Linear connected: resolve pending Linear refs           │
│  • When Notion connected: resolve pending Notion refs           │
│  • Batched, rate-limited, low priority                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Schema Design

### Pending Relationships Table

```typescript
// For unresolved cross-source references
export const pendingRelationships = pgTable(
  'pending_relationships',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),

    // Source (resolved)
    fromDocumentId: varchar('from_document_id', { length: 40 }).notNull(),
    fromSourceType: varchar('from_source_type', { length: 20 }).notNull(),

    // Target (unresolved)
    targetSourceType: varchar('target_source_type', { length: 20 }).notNull(),
    targetSourceId: varchar('target_source_id', { length: 255 }).notNull(),

    relationshipType: varchar('relationship_type', { length: 40 }).notNull(),
    confidence: real('confidence').notNull(),
    evidenceJson: jsonb('evidence_json').notNull(),

    status: varchar('status', { length: 20 }).notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    lastRetryAt: timestamp('last_retry_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    idxWorkspace: index('idx_pending_rel_workspace').on(t.workspaceId),
    idxTarget: index('idx_pending_rel_target').on(t.targetSourceType, t.targetSourceId),
    idxStatus: index('idx_pending_rel_status').on(t.status),
  })
);
```

### Entity Aliases Table (Extended)

```typescript
// From docs/architecture/identity.md
export const entityAliases = pgTable(
  'entity_aliases',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    entityId: varchar('entity_id', { length: 40 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 40 }).notNull(),

    aliasType: varchar('alias_type', { length: 40 }).notNull(),
    // Types: email, github_login, github_user_id, linear_user_id,
    //        notion_user_id, slack_user_id, etc.

    value: varchar('value', { length: 255 }).notNull(),
    verified: boolean('verified').notNull().default(false),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqAlias: uniqueIndex('uniq_entity_alias').on(
      t.workspaceId,
      t.aliasType,
      t.value
    ),
    idxEntity: index('idx_alias_entity').on(t.entityId),
  })
);
```

---

## Confidence Scoring Guide

### Deterministic (0.95-1.0)

**1.0 - API Provided:**
- Linear API `attachments` field has GitHub PR URL
- GitHub API `linked_issues` field
- CODEOWNERS file ownership

**0.95 - Strong Pattern:**
- Full URL with domain: `https://linear.app/team/issue/LIN-123`
- Explicit keywords: "Closes LIN-123", "Implements #456"

### Medium Confidence (0.75-0.90)

**0.90 - Clear Reference:**
- Path reference: `/docs/auth/sessions.md`
- Ticket ID without keyword: "LIN-123" in body (but not "Closes LIN-123")

**0.80-0.85 - Temporal + Topical:**
- Documents created within 24h of each other
- Both mention same specific terms ("auth timeout", "session middleware")
- Same author across sources

**0.75 - Likely Connection:**
- Related keywords but not identical
- Same project/milestone
- Referenced by same people

### Low Confidence (0.60-0.70) - Needs Review

**0.70 - Weak Semantic:**
- General topic overlap ("authentication" appears in both)
- Different wording but similar concepts

**0.60 - Uncertain:**
- Ambiguous reference ("the auth issue")
- Temporal proximity only, no topic match

### Discard (<0.60)

- Generic terms only
- No temporal or topical connection
- False positive from pattern matching

---

## Evaluation Metrics

### Relationship Quality

**Cross-Source Precision:**
```
True Positives / (True Positives + False Positives)
```
Target: ≥90% for deterministic, ≥80% for LLM

**Cross-Source Recall:**
```
True Positives / (True Positives + False Negatives)
```
Target: ≥85% for deterministic, ≥75% for LLM

**Resolution Rate:**
```
Resolved Pending Relationships / Total Pending Relationships
```
Target: ≥95% within 24h of target source connection

### Pipeline Health

**Pending Queue Depth:**
- Alert if >1000 unresolved pending relationships

**Resolution Latency:**
- P95: <24 hours from source connection to resolution

**Identity Resolution Accuracy:**
- % of person entities correctly merged across sources
- Target: ≥98%

---

## Test Scenarios

### Test Set 1: GitHub ↔ Linear

**Setup:**
- Ingest 50 GitHub PRs with "Closes LIN-X" patterns
- Then ingest 50 Linear issues (some referenced, some not)

**Validate:**
- All referenced Linear issues have reverse relationships
- Pending relationships resolved
- Confidence scores appropriate

### Test Set 2: Notion → GitHub/Linear

**Setup:**
- Ingest 30 Notion pages with URLs to GitHub PRs and Linear issues
- Mix of full URLs and path references

**Validate:**
- URL extractions have confidence ≥0.95
- Path references have confidence ≥0.90
- All relationships bidirectional

### Test Set 3: Semantic Connections (LLM)

**Setup:**
- 20 GitHub PRs implementing specs from Notion
- No explicit references, only semantic overlap

**Validate:**
- LLM proposals have appropriate confidence (0.6-0.9)
- High confidence proposals auto-accepted
- Medium confidence queued for review

### Test Set 4: Person Identity

**Setup:**
- Same person across GitHub (@alice-dev), Linear (alice@company.com), Notion (Alice Smith)

**Validate:**
- All three aliases resolve to same person entity
- All their work linked to one person
- Email verification workflow works

---

## Implementation Priority

### Phase 1 (Weeks 1-2): Foundation
1. Pending relationships table and schema
2. Basic entity resolution (by source ID)
3. Deterministic cross-source extraction (URLs, patterns)

### Phase 2 (Weeks 3-4): Identity & Bidirectional
4. Entity aliases and person resolution
5. Bidirectional relationship building
6. Backfill when new source connected

### Phase 3 (Weeks 5-6): Semantic
7. Vector search for candidates
8. LLM semantic matching
9. Confidence gating and adjudication queue

### Phase 4 (Weeks 7-8): Production Ready
10. Comprehensive test sets
11. Monitoring and alerts
12. Performance optimization

---

## Key Takeaways

1. **Cross-source is a pipeline, not a single step**
   - Extract → Resolve → Bidirectional → Semantic → Backfill

2. **Pending relationships are critical**
   - Sources may be ingested in any order
   - Store unresolved references, resolve later

3. **Entity resolution is the hardest part**
   - Person identity across sources (email, logins, names)
   - Artifact identity (LIN-123 → actual Linear issue)

4. **Confidence scoring is essential**
   - API data: 1.0
   - Strong patterns: 0.95
   - LLM semantic: 0.6-0.9
   - Gate by confidence threshold

5. **LLM is supplementary, not primary**
   - Deterministic extraction: 80% of relationships, 95%+ precision
   - LLM semantic: 20% additional, 80%+ precision
   - Never overwrite deterministic with LLM

6. **Bidirectional is non-negotiable**
   - Linear knows about GitHub PR
   - GitHub PR knows about Linear issue
   - Enables graph traversal in both directions
