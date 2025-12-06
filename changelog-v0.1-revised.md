<!--
BaseHub Entry Fields:
- Title: GitHub File Sync, Semantic Search, Team Workspaces
- Slug: 0-1
- Description: Lightfast v0.1 brings GitHub file sync with webhook-driven updates, semantic code search with vector + full-text retrieval, and isolated team workspaces. Production-ready.

Note: Structured data (JSON-LD) is auto-generated from these fields by the page template.
-->

# v0.1 · Nov 29, 2024

**GitHub File Sync, Semantic Search, Team Workspaces**

---

### GitHub Repository Sync (File Contents)

Connect GitHub repositories with automatic webhook-driven synchronization. When you push code, Lightfast incrementally updates your knowledge base using Git Trees API to efficiently handle repositories with 100,000+ files.

**What's included:**
- File contents (code, markdown, documentation) indexed via webhook events
- `lightfast.yml` configuration with glob patterns for include/exclude filtering
- HMAC SHA-256 webhook verification for security
- Incremental sync that only re-indexes changed files on push
- Full and delta sync modes based on commit history

**Not yet:** Pull request metadata, issue discussions, or commit history are not currently indexed. These are planned for v0.2 based on customer feedback.

**Example configuration:**
```yaml
# lightfast.yml (place in repository root)
include:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "docs/**/*.md"
  - "README.md"
exclude:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "node_modules/**"
  - "dist/**"
```

**Why webhooks over polling:** GitHub's webhook system provides sub-minute update latency while respecting API rate limits (5,000 requests/hour). Polling would exhaust rate limits for teams with active repositories, while webhooks give us instant notifications when code changes without constant API calls.

[Learn more about GitHub integration](/docs/integrations/github)

---

### Semantic Code Search

Search your entire codebase using natural language instead of exact keywords. Ask "how does authentication work" or "where do we handle rate limiting" and get results ranked by semantic meaning, not just text matching.

**What's included:**
- Vector embeddings via Pinecone for semantic understanding
- BM25 full-text search for exact keyword matching
- Hybrid retrieval combining dense and sparse search methods
- Context-aware snippet highlighting with source citations
- Sub-second query performance across 100k+ files

**How it works:** Files are intelligently chunked to preserve code structure (functions, classes, modules), embedded using sentence transformers, and indexed with metadata. Each query uses hybrid retrieval (vector + lexical) with results validated by citations showing exact file paths and line numbers.

**Why hybrid search:** Pure semantic search can miss exact technical terms, while pure keyword search misses conceptual matches. Our hybrid approach combines both—you can search "auth flow" and match both "authentication" logic and related authorization code.

[API documentation](/docs/api/search)

---

### Team Workspaces

Create isolated knowledge bases per team or project within your organization. Each workspace maintains separate GitHub integrations, search indexes, and access controls for complete tenant isolation.

**What's included:**
- Clerk authentication with SSO and team-based access control
- Per-workspace GitHub App installations (teams only see their repositories)
- Isolated vector indexes and search results (no data leakage between workspaces)
- Activity tracking and sync metrics per workspace
- Organization-level management through Clerk

**Architecture choice:** We use Clerk as the source of truth for organizations instead of maintaining a separate organizations table. This eliminates sync issues and simplifies auth boundaries while supporting enterprise SSO requirements.

[Workspace setup guide](/docs/workspaces)

---

### Improvements (8)

<details>
<summary>View all improvements</summary>

- **Search highlighting:** Context-aware snippets with keyword emphasis showing surrounding code for better relevance assessment
- **Intelligent chunking:** Respects code structure (functions, classes, modules) to maintain semantic context across large files
- **Activity tracking:** Real-time job status showing sync progress, duration, and search quality metrics per workspace
- **Batch processing:** Handles large repository updates efficiently with automatic concurrency limits and retry logic
- **Webhook verification:** HMAC SHA-256 signature validation ensures only authenticated GitHub events trigger syncs
- **Incremental sync:** Detects file changes via commit diffs and only re-indexes modified content, not entire repositories
- **Config hash tracking:** Auto-detects when embedding or chunking configuration changes and triggers re-processing of affected documents
- **Glob pattern support:** Full support for `**`, `*`, and `!` (negation) syntax in [lightfast.yml configuration](/docs/config)

</details>

---

### Infrastructure (5)

<details>
<summary>View technical details</summary>

- **Multi-source document schema:** Generic document model with discriminated union for `sourceType` (github, linear, notion) ready for future integrations—adding new sources requires only an adapter, not infrastructure changes
- **Event-driven workflows:** Inngest orchestration with `waitForEvent` pattern for accurate completion tracking (no fire-and-forget, no race conditions)
- **Idempotent processing:** Safe automatic retries and partial failure recovery with deduplication to handle webhook replays gracefully
- **Comprehensive metrics:** Per-workspace job lifecycle monitoring including sync duration, chunk count, embedding latency, and error rates
- **End-to-end type safety:** Discriminated unions throughout with TypeScript + Zod validation preventing runtime errors and improving developer experience

</details>

---

### What's Coming Next

Based on your feedback, we're prioritizing:

1. **Pull Request & Issue ingestion** (v0.2) — Search PR reviews, issue discussions, comments, and commit metadata. 2-3 week implementation once customer demand is validated.

2. **Linear integration** (when 3+ customers request) — Issues, projects, and comments synchronized with same webhook-driven architecture. 1-2 week implementation.

3. **Notion integration** (when 3+ customers request) — Pages, databases, and blocks with OAuth flow. 1-2 week implementation.

**Our approach:** We're launching with GitHub file contents to validate core retrieval quality and gather feedback on what developers actually need. The multi-source architecture is production-ready—each additional integration follows the same pattern and can be delivered quickly once demand is proven.

---

### Resources

- [Quick Start Guide](/docs/quick-start) — Get up and running in 5 minutes
- [GitHub Integration Setup](/docs/integrations/github) — Webhook configuration and troubleshooting
- [Configuration Reference](/docs/config) — Complete lightfast.yml syntax and options
- [Search API Documentation](/docs/api/search) — REST API reference with examples
- [Workspace Management](/docs/workspaces) — Team setup and access control

---

### Technical Details

**Architecture:**
- Database: PlanetScale (MySQL) via Drizzle ORM with multi-tenant isolation
- Vector Store: Pinecone with per-workspace namespaces and embedding version tracking
- Background Jobs: Inngest with event-driven workflows and automatic retries
- Authentication: Clerk with SSO support and team-based access control
- Observability: Sentry error tracking + BetterStack monitoring

**Performance:**
- Git Trees API enables fetching 100k+ file paths in a single API call
- Batch processing handles 25 documents per batch with 5-second timeout windows
- Vector search queries return in <1 second across millions of indexed chunks
- Incremental sync processes only changed files (typically <1 minute for pushes)

**Why production-ready:** All core workflows include idempotency, error recovery, completion tracking, and comprehensive metrics. No deprecated code, no race conditions, no fire-and-forget patterns. Clean TypeScript with discriminated unions throughout.
