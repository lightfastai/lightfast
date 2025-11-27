# Inngest Architecture & Implementation Status

## Current Architecture

```
Entry Points                    Orchestration              Processing Pipeline
────────────                    ─────────────              ───────────────────

GitHub Push ─────┐              ┌──────────────┐          ┌─────────────────┐
GitHub Connect ──┼──────────▶   │ source.sync  │ ────────▶│ GitHub Adapter  │
Schedule* ───────┘              │ (orchestrator)│          │ (batch 50 files)│
                                └──────────────┘          └─────────────────┘
                                       │                           │
                                       ▼                           ▼
                                ┌──────────────┐          ┌─────────────────┐
                                │ github.sync  │          │ documents.process│
                                │ (provider)   │          │ (batch 25 docs) │
                                └──────────────┘          └─────────────────┘
                                       │                           │
                                       ▼                           ▼
                                Emit Completion            Chunk → Embed → Index
                                                          (Pinecone + OpenAI/Cohere)
```

## What's Implemented ✅

### Core Pipeline (Working)
- **GitHub sync**: Full & incremental with config file support
- **Batching**: 50 files → 25 docs → 96 embeddings
- **Chunking**: Smart chunking with configurable overlap
- **Embeddings**: OpenAI/Cohere providers via `@vendor/embed`
- **Vector storage**: Pinecone with metadata and namespacing
- **Deduplication**: Content hash + config hash detection
- **Completion tracking**: `step.waitForEvent` pattern

### Key Functions
```typescript
// Entry Points (1/6 implemented)
✅ source.connected.github    // Triggers full sync on connect
✅ github.push                // Webhook for incremental sync
❌ schedule.sync              // Not implemented

// Orchestration (All implemented)
✅ source.sync                // Main orchestrator with waitForEvent
✅ github.sync                // Provider-specific handler

// Processing (All implemented)
✅ github-adapter            // Batches 50, fetches from GitHub
✅ documents.process         // Batches 25, chunks + embeds + indexes
✅ documents.delete          // Removes from DB and Pinecone
✅ relationships.extract     // Extracts cross-references

// Infrastructure
✅ store.ensure              // Creates stores and indices
✅ activity.record           // Tracks user actions
```

## What's NOT Robust ⚠️

### Missing Functions
```typescript
// Robustness (0/3 implemented)
❌ error.recovery           // No retry for failed batches
❌ monitoring.alert         // No metrics or alerting
❌ cleanup.stale           // No garbage collection

// Scheduling
❌ schedule.sync.trigger   // No periodic syncs

// Other Sources (0/4 implemented)
❌ linear.sync, notion.sync, slack.sync, vercel.sync
```

## Performance Characteristics

### Current Throughput
- **GitHub API**: 50 files/batch × 10 concurrent = 500 files parallel
- **Processing**: 25 docs/batch × 5 concurrent = 125 docs parallel
- **Embeddings**: 96 texts/batch (Cohere limit)

### Expected Times
- 100 files: ~30-60 seconds
- 1,000 files: ~3-5 minutes
- 10,000 files: ~15-30 minutes

### Bottlenecks
1. Embedding API rate limits (primary)
2. GitHub API limits (5000/hour)
3. Pinecone upsert limits

## Code Structure

```
api/console/src/inngest/
├── client/
│   └── client.ts                 # Event schemas (28 events defined)
├── workflow/
│   ├── orchestration/
│   │   ├── source-connected.ts   # Entry point orchestrator
│   │   └── source-sync.ts        # Main sync orchestrator
│   ├── providers/
│   │   └── github/
│   │       ├── sync.ts           # GitHub-specific sync
│   │       └── push-handler.ts   # Webhook handler
│   ├── adapters/
│   │   └── github-adapter.ts     # Transform GitHub → generic
│   ├── processing/
│   │   ├── process-documents.ts  # Main processing pipeline
│   │   ├── delete-documents.ts   # Deletion handler
│   │   └── extract-relationships.ts
│   └── infrastructure/
│       ├── ensure-store.ts       # Store creation
│       └── record-activity.ts    # Activity tracking
```

## Key Packages

- `@repo/console-chunking` - Document chunking strategies
- `@repo/console-embed` - Embedding provider abstraction
- `@repo/console-pinecone` - Vector database client
- `@vendor/embed` - Core embedding functionality
- `@vendor/inngest` - Inngest client configuration