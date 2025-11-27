---
title: Neural Memory System Design
description: Observations, summaries, profiles, and temporal tracking for intelligent retrieval
status: draft
owner: platform-search
audience: engineering
last_updated: 2025-11-27
tags: [retrieval, neural-memory, architecture]
---

# Neural Memory System Design

## Overview

The Neural Memory System complements our Knowledge Layer (documents & chunks) with dynamic, temporal, and actor-aware memory components. Unlike static documents, neural memory captures **what happened**, **who was involved**, and **how things evolved** over time.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Neural Memory Layer                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 1. Observations (Atomic Moments)                  │   │
│  │   - Decisions, highlights, changes, incidents     │   │
│  │   - Actor: who, when, context                     │   │
│  │   - Multi-view embeddings                         │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 2. Summaries (Clustered Intelligence)            │   │
│  │   - Topic/entity/time rollups                     │   │
│  │   - Pattern extraction                            │   │
│  │   - Relationship synthesis                        │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 3. Profiles (Actor/Entity Models)                │   │
│  │   - Expertise vectors                             │   │
│  │   - Contribution patterns                         │   │
│  │   - Interaction graphs                            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Observations

**Purpose:** Capture atomic moments of significance

**Key Fields:**
- `occurred_at`: When the event happened
- `actor_type/id`: Who initiated (user, agent, system)
- `observation_type`: Type (decision, highlight, change, incident)
- `title/content`: What happened
- `source_references`: Links to documents/chunks
- `multi-view embeddings`: Title, content, summary views

**Examples:**
```typescript
// PR Merged Decision
{
  type: 'decision',
  title: 'Merged PR #123: Add authentication',
  actor: { type: 'user', id: 'user_xyz', name: 'John Doe' },
  occurred_at: '2025-11-27T10:30:00Z',
  content: 'Added OAuth2 authentication with GitHub provider',
  source_references: [
    { type: 'github_pr', id: 'owner/repo/pull/123' }
  ]
}

// Incident Observation
{
  type: 'incident',
  title: 'Database connection pool exhausted',
  actor: { type: 'system', id: 'monitoring' },
  occurred_at: '2025-11-27T02:15:00Z',
  content: 'Connection pool reached limit, queries timing out',
  context: { severity: 'high', duration_ms: 4500 }
}
```

### 2. Summaries

**Purpose:** Synthesize observations into higher-level insights

**Types:**
- **Topic Summaries**: Cluster by subject matter
- **Entity Summaries**: Aggregate by person/project/service
- **Temporal Summaries**: Daily/weekly/sprint rollups
- **Project Summaries**: Cross-entity project views

**Key Fields:**
- `summary_type`: topic/entity/temporal/project
- `period_start/end`: Time range covered
- `observation_ids`: Source observations
- `key_points`: Structured highlights
- `primary_entities`: Main actors/subjects
- `embedding`: For similarity search

**Example:**
```typescript
// Weekly Engineering Summary
{
  type: 'temporal',
  scope: 'weekly',
  period: { start: '2025-11-20', end: '2025-11-27' },
  title: 'Engineering Week 47 Summary',
  summary: 'Completed authentication implementation, resolved 3 incidents...',
  key_points: [
    'OAuth2 integration completed',
    'Database scaling issues addressed',
    'New CI/CD pipeline deployed'
  ],
  observation_count: 47,
  primary_entities: ['john_doe', 'auth_team', 'infrastructure']
}
```

### 3. Actor Profiles

**Purpose:** Model expertise, patterns, and relationships

**Profile Types:**
- **User Profiles**: Individual contributors
- **Team Profiles**: Group dynamics
- **Project Profiles**: Initiative characteristics
- **Service Profiles**: System behavior patterns

**Key Fields:**
- `expertise_vectors`: Domain knowledge scores
- `contribution_types`: What they typically do
- `active_hours`: When they work
- `frequent_collaborators`: Who they work with
- `centroid_embeddings`: For similarity matching

**Example:**
```typescript
// User Profile
{
  profile_type: 'user',
  actor_id: 'user_john_doe',
  expertise: {
    'authentication': 0.85,
    'database': 0.72,
    'frontend': 0.45
  },
  contribution_types: {
    'code_review': 0.40,
    'implementation': 0.35,
    'documentation': 0.25
  },
  active_hours: [9, 10, 11, 14, 15, 16], // UTC
  frequent_collaborators: ['user_jane_smith', 'user_bob_wilson']
}
```

### 4. Temporal States

**Purpose:** Track how entities evolve over time

**State Types:**
- **Status States**: Current status of projects/features
- **Progress States**: Completion percentages
- **Health States**: System/project health indicators
- **Risk States**: Risk levels and factors

**Key Fields:**
- `entity_type/id`: What is being tracked
- `state_type/value`: Current state
- `valid_from/to`: Time validity
- `changed_by`: Who changed it
- `change_reason`: Why it changed

**Example:**
```typescript
// Project State Evolution
{
  entity: { type: 'project', id: 'auth_implementation' },
  state_type: 'progress',
  states: [
    { value: '25%', from: '2025-11-01', to: '2025-11-15' },
    { value: '60%', from: '2025-11-15', to: '2025-11-22' },
    { value: '100%', from: '2025-11-22', to: null, is_current: true }
  ]
}
```

## Data Flow

### Observation Capture Pipeline

```
Event Source → Observation Extractor → Embedding Generator → Vector Store
     ↓                ↓                      ↓                    ↓
  GitHub PR     Extract metadata      Multi-view embed      Pinecone
  Linear Issue   Actor info           Title/Content/Summary  namespace
  Slack Thread   Temporal context     views
```

### Summary Generation Pipeline

```
Observations → Time Window → Clustering → LLM Summary → Embedding → Store
      ↓            ↓             ↓            ↓            ↓          ↓
   Last 24h     Group by      K-means     Generate     Embed      Save &
                topic/entity  or DBSCAN   insights    summary     index
```

### Profile Evolution Pipeline

```
Actor Observations → Feature Extraction → Profile Update → Centroid Compute
         ↓                   ↓                  ↓               ↓
    User actions      Topics, patterns    Merge with      Update vector
                      time distributions   existing        for similarity
```

## Retrieval Integration

### Enhanced Router Modes

```typescript
enum RouterMode {
  KNOWLEDGE = 'knowledge',     // Documents/chunks only
  NEURAL = 'neural',           // Observations/summaries/profiles
  HYBRID = 'hybrid',           // Both knowledge + neural
  TEMPORAL = 'temporal',       // Time-aware with states
  ACTOR = 'actor'             // Actor-centric search
}
```

### Query Classification

```typescript
function classifyQuery(query: string): RouterMode {
  // Temporal markers
  if (/yesterday|today|this week|recently|lately/.test(query)) {
    return RouterMode.NEURAL;
  }

  // Actor queries
  if (/@\w+|who (did|worked|owns)|by \w+/.test(query)) {
    return RouterMode.ACTOR;
  }

  // Document identifiers
  if (/#\d+|PR-\d+|[A-Z]+-\d+/.test(query)) {
    return RouterMode.KNOWLEDGE;
  }

  // State queries
  if (/status|progress|health|current state/.test(query)) {
    return RouterMode.TEMPORAL;
  }

  return RouterMode.HYBRID;
}
```

### Fusion Scoring

```typescript
interface FusionWeights {
  knowledge: 0.3,      // Document/chunk relevance
  neural: 0.25,        // Observation/summary match
  temporal: 0.15,      // Time relevance
  actor: 0.15,         // Actor similarity
  recency: 0.1,        // Freshness decay
  importance: 0.05     // Source importance
}

function computeFinalScore(candidate: SearchCandidate): number {
  const weights = getFusionWeights(candidate.workspace);

  return (
    weights.knowledge * candidate.knowledgeScore +
    weights.neural * candidate.neuralScore +
    weights.temporal * candidate.temporalScore +
    weights.actor * candidate.actorScore +
    weights.recency * candidate.recencyScore +
    weights.importance * candidate.importanceScore
  );
}
```

## Database Schema

### workspace_neural_observations

```sql
CREATE TABLE workspace_neural_observations (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  store_id VARCHAR(191) NOT NULL REFERENCES workspace_stores(id),

  -- Temporal
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Actor
  actor_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(191),
  actor_name VARCHAR(255),
  actor_metadata JSONB,

  -- Content
  observation_type VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Context
  source_references JSONB,
  context_metadata JSONB,

  -- Embeddings
  embedding_title_id VARCHAR(191),
  embedding_content_id VARCHAR(191),
  embedding_summary_id VARCHAR(191),

  -- Relationships
  parent_observation_id VARCHAR(191),
  related_entity_ids JSONB,
  tags JSONB,

  -- Quality
  confidence_score FLOAT,
  verification_status VARCHAR(50),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obs_workspace_occurred ON workspace_neural_observations(workspace_id, occurred_at DESC);
CREATE INDEX idx_obs_actor ON workspace_neural_observations(actor_type, actor_id);
CREATE INDEX idx_obs_type ON workspace_neural_observations(observation_type);
```

### workspace_neural_summaries

```sql
CREATE TABLE workspace_neural_summaries (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  store_id VARCHAR(191) NOT NULL REFERENCES workspace_stores(id),

  -- Scope
  summary_type VARCHAR(50) NOT NULL,
  summary_scope VARCHAR(100) NOT NULL,

  -- Time
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Content
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points JSONB,

  -- Sources
  observation_ids JSONB NOT NULL,
  observation_count INTEGER NOT NULL,

  -- Entities
  primary_entities JSONB,
  topics JSONB,
  sentiment_analysis JSONB,

  -- Embedding
  embedding_id VARCHAR(191),

  -- Meta
  generation_method VARCHAR(50),
  confidence_score FLOAT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sum_workspace_period ON workspace_neural_summaries(workspace_id, period_start, period_end);
CREATE INDEX idx_sum_type_scope ON workspace_neural_summaries(summary_type, summary_scope);
```

### workspace_actor_profiles

```sql
CREATE TABLE workspace_actor_profiles (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Identification
  profile_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(191) NOT NULL,
  actor_name VARCHAR(255) NOT NULL,

  -- Expertise
  expertise_vectors JSONB,
  interest_topics JSONB,
  skill_tags JSONB,

  -- Patterns
  active_hours JSONB,
  contribution_types JSONB,
  interaction_frequency JSONB,

  -- Relationships
  frequent_collaborators JSONB,
  reporting_chain JSONB,
  project_associations JSONB,

  -- Embeddings
  embedding_expertise_id VARCHAR(191),
  embedding_interests_id VARCHAR(191),

  -- Stats
  observation_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  profile_confidence FLOAT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_profile_actor ON workspace_actor_profiles(workspace_id, profile_type, actor_id);
```

### workspace_temporal_states

```sql
CREATE TABLE workspace_temporal_states (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Entity
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  entity_name VARCHAR(255),

  -- State
  state_type VARCHAR(50) NOT NULL,
  state_value VARCHAR(255) NOT NULL,
  state_metadata JSONB,

  -- Temporal
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_to TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT TRUE,

  -- Change
  changed_by_actor_id VARCHAR(191),
  change_reason TEXT,
  related_observation_id VARCHAR(191),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_state_entity ON workspace_temporal_states(entity_type, entity_id, valid_from DESC);
CREATE INDEX idx_state_current ON workspace_temporal_states(workspace_id, is_current) WHERE is_current = TRUE;
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Create database schemas
- Set up Pinecone namespaces
- Build observation capture API
- Implement basic embedding pipeline

### Phase 2: Observation Pipeline (Week 3-4)
- Instrument GitHub sync for observations
- Add observation extraction from PRs/issues
- Implement multi-view embeddings
- Build observation storage service

### Phase 3: Intelligence Layer (Week 5-6)
- Implement summary generation job
- Build clustering algorithms
- Create profile computation pipeline
- Add temporal state tracking

### Phase 4: Retrieval Enhancement (Week 7-8)
- Update router with neural modes
- Implement fusion scoring
- Add actor-aware search
- Build temporal query handling

### Phase 5: Optimization (Week 9-10)
- Performance tuning
- Cache optimization
- Batch processing improvements
- Monitoring and metrics

## Key Differentiators

### Neural Memory vs Audit Trail

**Neural Memory (for search):**
- Selective: Only meaningful events
- Enriched: With embeddings and relationships
- Evolving: Profiles and summaries update
- Searchable: Optimized for retrieval

**Audit Trail (for compliance):**
- Comprehensive: Every action logged
- Immutable: Never modified
- Forensic: For security and compliance
- Not searchable: Separate from retrieval

### Multi-View Embeddings

Each observation has three embedding views:
1. **Title**: For high-level matching
2. **Content**: For detailed similarity
3. **Summary**: For conceptual alignment

This enables better retrieval across different query types and granularities.

### Temporal Awareness

Unlike static documents, neural memory understands:
- When things happened
- How they evolved
- Current vs historical state
- Trends and patterns over time

## Success Metrics

### Quality Metrics
- **Observation Coverage**: % of significant events captured
- **Summary Coherence**: Human evaluation scores
- **Profile Accuracy**: Expertise prediction validation
- **Temporal Precision**: State tracking accuracy

### Performance Metrics
- **Observation Latency**: <500ms capture time
- **Summary Generation**: <5 min for daily summaries
- **Profile Update**: <1 min incremental updates
- **Query Performance**: <200ms p95 for neural queries

### Business Metrics
- **Query Satisfaction**: % queries with neural results
- **Insight Discovery**: New connections found
- **Time to Context**: Reduction in research time
- **Actor Intelligence**: Accuracy of expertise routing

---

_Last reviewed: 2025-11-27_