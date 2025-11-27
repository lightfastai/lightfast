# Neural Memory Architecture: GitHub, Vercel & Sentry Integration

Last Updated: 2025-11-27

This document provides architectural diagrams and flow descriptions for how GitHub PRs/Issues/Branches, Vercel deployments, and Sentry errors integrate with the Neural Memory system.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        GH[GitHub<br/>PRs, Issues, Branches]
        VD[Vercel<br/>Deployments]
        SE[Sentry<br/>Errors & Events]
    end

    subgraph "Ingestion Layer"
        GHW[GitHub Webhook Handler]
        VW[Vercel Webhook Handler]
        SW[Sentry Webhook Handler]

        GHP[GitHub Poller<br/>Branch Monitor]
        VP[Vercel Poller<br/>Deploy Status]
        SP[Sentry Poller<br/>Error Trends]
    end

    subgraph "Event Processing"
        EV[Event Validator<br/>& Deduplicator]
        EN[Event Normalizer]
        SIG[Significance<br/>Evaluator]
    end

    subgraph "Observation Pipeline"
        OC[Observation<br/>Capture]
        CE[Context<br/>Enrichment]
        CL[Cross-Reference<br/>Linking]
        EMB[Multi-View<br/>Embeddings]
    end

    subgraph "Neural Memory Core"
        OBS[(Observations<br/>Store)]
        PROF[(Actor<br/>Profiles)]
        SUM[(Summaries)]
        STATE[(Temporal<br/>States)]
    end

    subgraph "Knowledge Integration"
        DOC[Document<br/>Linker]
        CHUNK[Chunk<br/>Matcher]
        GRAPH[Graph<br/>Builder]
    end

    subgraph "Downstream Processing"
        PU[Profile<br/>Updater]
        SG[Summary<br/>Generator]
        ST[State<br/>Tracker]
        AL[Alert<br/>System]
    end

    %% Source to Ingestion
    GH -->|webhooks| GHW
    GH -.->|polling| GHP
    VD -->|webhooks| VW
    VD -.->|polling| VP
    SE -->|webhooks| SW
    SE -.->|polling| SP

    %% Ingestion to Processing
    GHW --> EV
    GHP --> EV
    VW --> EV
    VP --> EV
    SW --> EV
    SP --> EV

    %% Event Processing Flow
    EV --> EN
    EN --> SIG
    SIG -->|significant| OC
    SIG -->|not significant| X[Discard]

    %% Observation Pipeline
    OC --> CE
    CE --> CL
    CL --> EMB
    EMB --> OBS

    %% Knowledge Integration
    OBS --> DOC
    OBS --> CHUNK
    OBS --> GRAPH

    %% Neural Memory Updates
    OBS --> PROF
    OBS --> SUM
    OBS --> STATE

    %% Downstream
    PROF --> PU
    SUM --> SG
    STATE --> ST
    STATE --> AL
```

---

## Data Source Integration Details

### 1. GitHub Integration Architecture

```mermaid
graph LR
    subgraph "GitHub Events"
        PR[Pull Request<br/>Events]
        IS[Issue<br/>Events]
        BR[Branch<br/>Events]
        CM[Commit<br/>Events]
        RV[Review<br/>Events]
    end

    subgraph "Event Types"
        PRE[opened<br/>merged<br/>closed]
        ISE[created<br/>labeled<br/>closed]
        BRE[created<br/>deleted<br/>updated]
        CME[pushed]
        RVE[submitted<br/>approved<br/>changes_requested]
    end

    subgraph "Context Extraction"
        PC[PR Context]
        IC[Issue Context]
        BC[Branch Context]

        PC --> |extract| PCE[Files Changed<br/>Diff Analysis<br/>Review Comments<br/>Linked Issues]
        IC --> |extract| ICE[Labels<br/>Assignees<br/>Milestones<br/>Dependencies]
        BC --> |extract| BCE[Parent Branch<br/>Commit History<br/>Protection Rules]
    end

    subgraph "Enrichment"
        AE[Actor<br/>Enrichment]
        CE[Code<br/>Analysis]
        TE[Timeline<br/>Builder]
        DE[Dependency<br/>Tracer]
    end

    subgraph "Observation Types"
        DEC[Decision<br/>Observations]
        CHG[Change<br/>Observations]
        MIL[Milestone<br/>Observations]
        COL[Collaboration<br/>Observations]
    end

    PR --> PRE
    IS --> ISE
    BR --> BRE
    CM --> CME
    RV --> RVE

    PRE --> PC
    ISE --> IC
    BRE --> BC

    PCE --> AE
    ICE --> AE
    BCE --> AE

    PCE --> CE
    PCE --> TE
    ICE --> DE

    AE --> DEC
    CE --> CHG
    TE --> MIL
    DE --> COL
```

### 2. Vercel Deployment Architecture

```mermaid
graph LR
    subgraph "Vercel Events"
        DS[Deployment<br/>Started]
        DC[Deployment<br/>Completed]
        DF[Deployment<br/>Failed]
        DPR[Preview<br/>Deployment]
        DP[Production<br/>Deployment]
    end

    subgraph "Deployment Context"
        META[Metadata]
        META --> ME[Git SHA<br/>Branch<br/>PR Number<br/>Committer]

        PERF[Performance]
        PERF --> PE[Build Time<br/>Deploy Time<br/>Bundle Size<br/>Function Count]

        ENV[Environment]
        ENV --> EE[Env Vars<br/>Domains<br/>Aliases<br/>Region]
    end

    subgraph "GitHub Correlation"
        GC[Git Commit<br/>Finder]
        PRC[PR<br/>Correlator]
        BC[Branch<br/>Matcher]
    end

    subgraph "Quality Analysis"
        BT[Build Time<br/>Trend]
        BS[Bundle Size<br/>Analysis]
        PD[Performance<br/>Delta]
        FD[Failure<br/>Detector]
    end

    subgraph "Observations"
        DEP_OBS[Deployment<br/>Observation]
        PERF_OBS[Performance<br/>Observation]
        FAIL_OBS[Failure<br/>Observation]

        DEP_OBS --> DO[Type: milestone<br/>Links to PR<br/>Performance metrics]
        PERF_OBS --> PO[Type: highlight<br/>or incident<br/>Trend analysis]
        FAIL_OBS --> FO[Type: incident<br/>Root cause<br/>Related commits]
    end

    DS --> META
    DC --> META
    DF --> META
    DPR --> PERF
    DP --> PERF

    META --> GC
    META --> PRC
    META --> BC

    PERF --> BT
    PERF --> BS
    PERF --> PD

    DF --> FD

    GC --> DEP_OBS
    PRC --> DEP_OBS
    BT --> PERF_OBS
    BS --> PERF_OBS
    FD --> FAIL_OBS
```

### 3. Sentry Error Architecture

```mermaid
graph LR
    subgraph "Sentry Events"
        ERR[Error<br/>Events]
        EXC[Exception<br/>Events]
        TRANS[Transaction<br/>Events]
        SESS[Session<br/>Events]
    end

    subgraph "Error Context"
        STACK[Stack Trace]
        USER[User Context]
        TAGS[Tags &<br/>Metadata]
        BREAD[Breadcrumbs]
    end

    subgraph "Correlation Engine"
        DEPC[Deployment<br/>Correlator]
        GITC[Git SHA<br/>Correlator]
        USERC[User Impact<br/>Analyzer]
        TRENDC[Trend<br/>Analyzer]
    end

    subgraph "Root Cause Analysis"
        RCA[Root Cause<br/>Analyzer]
        PATTERN[Pattern<br/>Detector]
        REGR[Regression<br/>Finder]
    end

    subgraph "Observations"
        INC_OBS[Incident<br/>Observation]
        REG_OBS[Regression<br/>Observation]
        RES_OBS[Resolution<br/>Observation]
    end

    ERR --> STACK
    EXC --> STACK
    TRANS --> USER
    SESS --> USER

    STACK --> TAGS
    USER --> BREAD

    TAGS --> DEPC
    TAGS --> GITC
    USER --> USERC
    BREAD --> TRENDC

    DEPC --> RCA
    GITC --> RCA
    TRENDC --> PATTERN
    PATTERN --> REGR

    RCA --> INC_OBS
    REGR --> REG_OBS
    PATTERN --> RES_OBS
```

---

## Cross-Source Correlation Flow

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant V as Vercel
    participant S as Sentry
    participant NM as Neural Memory
    participant CE as Correlation Engine

    %% PR Merge to Deployment to Error Flow
    GH->>NM: PR Merged Event
    NM->>NM: Create Change Observation
    Note over NM: Links: PR #123, Files, Author

    V->>NM: Deployment Started
    NM->>CE: Correlate with recent PRs
    CE->>CE: Match Git SHA
    CE->>NM: Link Deployment to PR #123
    NM->>NM: Create Milestone Observation
    Note over NM: Links: PR #123, Deploy #456

    V->>NM: Deployment Completed
    NM->>NM: Update Deployment State

    S->>NM: New Error Spike
    NM->>CE: Correlate with deployments
    CE->>CE: Match time window + git SHA
    CE->>NM: Link to Deploy #456
    NM->>NM: Create Incident Observation
    Note over NM: Links: PR #123, Deploy #456, Error

    NM->>NM: Update Temporal State
    Note over NM: PR #123 → Deployed → Error

    NM->>NM: Generate Summary
    Note over NM: "PR #123 caused regression<br/>deployed at 2pm, errors at 2:15pm"
```

---

## Observation Generation Rules

### GitHub → Observation Mapping

| GitHub Event | Observation Type | Significance Factors | Key Relationships |
|-------------|-----------------|---------------------|-------------------|
| PR Merged | `change` | File count, LoC, reviewer count | Issues, commits, reviews |
| PR with >10 comments | `decision` | Discussion length, participants | Issues, mentions, decisions |
| Issue Closed | `milestone` | Labels, time open, linked PRs | PRs, assignee, project |
| Branch Created (feature/*) | `change` | Branch naming, parent | Future PRs, commits |
| Review Changes Requested | `decision` | Review depth, suggestions | PR, files, reviewer expertise |
| PR Deployment Ready | `milestone` | Approvals, checks passed | Deploy readiness |

### Vercel → Observation Mapping

| Vercel Event | Observation Type | Significance Factors | Key Relationships |
|-------------|-----------------|---------------------|-------------------|
| Production Deploy | `milestone` | Success, performance | GitHub PR, commit, branch |
| Deploy Failed | `incident` | Error type, stage failed | GitHub commit, previous deploys |
| Build Time Regression | `incident` | Time delta, threshold | Recent PRs, dependencies |
| Bundle Size Increase >10% | `highlight` | Size delta, cause | GitHub PR, file changes |
| Preview Deploy | `change` | PR association | GitHub PR, branch |
| First Deploy (new project) | `milestone` | Project setup | GitHub repo, team |

### Sentry → Observation Mapping

| Sentry Event | Observation Type | Significance Factors | Key Relationships |
|-------------|-----------------|---------------------|-------------------|
| New Error Type | `incident` | User impact, frequency | Deploy, git SHA, files |
| Error Spike (>5x baseline) | `incident` | Spike magnitude, users affected | Recent deploy, PR |
| Error Resolved | `highlight` | Resolution time, method | Original incident, fix PR |
| Performance Regression | `incident` | Transaction impact, percentile | Deploy, code changes |
| New User Segment Errors | `insight` | Segment size, error pattern | Feature flags, rollout |
| Error Pattern Detected | `insight` | Pattern confidence, instances | Multiple errors, root cause |

---

## Enrichment & Correlation Pipeline

```mermaid
graph TB
    subgraph "Raw Events"
        GHE[GitHub Event]
        VE[Vercel Event]
        SE[Sentry Event]
    end

    subgraph "Primary Enrichment"
        GHE --> GH_ENRICH[Add PR Details<br/>Add Issue Context<br/>Add File Changes]
        VE --> V_ENRICH[Add Build Metrics<br/>Add Git Context<br/>Add Environment]
        SE --> S_ENRICH[Add Stack Trace<br/>Add User Impact<br/>Add Breadcrumbs]
    end

    subgraph "Cross-Source Correlation"
        CORRELATOR[Correlation Engine]

        GH_ENRICH --> CORRELATOR
        V_ENRICH --> CORRELATOR
        S_ENRICH --> CORRELATOR

        CORRELATOR --> TIME[Temporal<br/>Correlation]
        CORRELATOR --> GIT[Git SHA<br/>Correlation]
        CORRELATOR --> ACTOR[Actor<br/>Correlation]
        CORRELATOR --> DEP[Dependency<br/>Correlation]
    end

    subgraph "Relationship Graph"
        TIME --> GRAPH[(Relationship<br/>Graph)]
        GIT --> GRAPH
        ACTOR --> GRAPH
        DEP --> GRAPH
    end

    subgraph "Enriched Observation"
        GRAPH --> OBS[Observation]
        OBS --> PRIMARY[Primary Source:<br/>GitHub/Vercel/Sentry]
        OBS --> RELATED[Related Events:<br/>Cross-source links]
        OBS --> TIMELINE[Timeline:<br/>Before/During/After]
        OBS --> IMPACT[Impact Analysis:<br/>Users/Systems/Teams]
    end
```

---

## Temporal State Machine

```mermaid
stateDiagram-v2
    [*] --> PROpened: GitHub PR Created

    PROpened --> InReview: Review Requested
    InReview --> ChangesRequested: Changes Needed
    InReview --> Approved: Approved
    ChangesRequested --> InReview: Changes Made

    Approved --> ReadyToDeploy: All Checks Pass
    ReadyToDeploy --> Merged: PR Merged

    Merged --> Deploying: Vercel Deploy Triggered
    Deploying --> DeployFailed: Build/Deploy Error
    Deploying --> Deployed: Deploy Success

    DeployFailed --> RolledBack: Rollback Triggered
    DeployFailed --> FixInProgress: Fix PR Created

    Deployed --> Monitoring: In Production
    Monitoring --> ErrorDetected: Sentry Alert
    Monitoring --> Stable: No Issues (24h)

    ErrorDetected --> Investigating: Team Notified
    Investigating --> FixInProgress: Root Cause Found
    Investigating --> FalsePositive: Not Related

    FixInProgress --> PROpened: New Fix PR

    RolledBack --> PROpened: Retry with Fix

    Stable --> [*]: Success
    FalsePositive --> Stable: Marked Resolved

    note right of ErrorDetected
        Correlation:
        - Match deploy time
        - Match git SHA
        - Match affected files
    end note

    note right of Merged
        Trigger:
        - Deployment observation
        - Link to PR observation
    end note
```

---

## Data Flow Architecture

```mermaid
graph LR
    subgraph "Ingestion"
        WH[Webhooks]
        POLL[Pollers]
        API[Direct API]
    end

    subgraph "Processing Queue"
        Q[(Event Queue)]
        DQ[Dead Letter<br/>Queue]
    end

    subgraph "Processing Pipeline"
        VAL[Validator]
        DEDUP[Deduplicator]
        NORM[Normalizer]
        SIG[Significance<br/>Scorer]
    end

    subgraph "Observation Engine"
        OBS_GEN[Observation<br/>Generator]
        CTX[Context<br/>Enricher]
        LINK[Relationship<br/>Linker]
        EMB[Embedding<br/>Generator]
    end

    subgraph "Storage Layer"
        EVT_STORE[(Raw Events)]
        OBS_STORE[(Observations)]
        EMB_STORE[(Embeddings)]
        REL_STORE[(Relationships)]
    end

    subgraph "Query Layer"
        SEARCH[Semantic<br/>Search]
        GRAPH_Q[Graph<br/>Query]
        TIME_Q[Timeline<br/>Query]
    end

    WH --> Q
    POLL --> Q
    API --> Q
    Q --> VAL
    VAL -->|invalid| DQ
    VAL -->|valid| DEDUP
    DEDUP --> NORM
    NORM --> SIG
    SIG -->|low| EVT_STORE
    SIG -->|high| OBS_GEN

    OBS_GEN --> CTX
    CTX --> LINK
    LINK --> EMB

    EMB --> OBS_STORE
    EMB --> EMB_STORE
    LINK --> REL_STORE

    OBS_STORE --> SEARCH
    REL_STORE --> GRAPH_Q
    OBS_STORE --> TIME_Q
```

---

## Implementation Architecture

### System Components

```typescript
// Core Event Types
interface GitHubEvent {
  type: 'pr_opened' | 'pr_merged' | 'issue_created' | 'branch_created';
  payload: {
    repository: string;
    actor: GitHubActor;
    timestamp: Date;
    data: any;
  };
}

interface VercelEvent {
  type: 'deployment_created' | 'deployment_ready' | 'deployment_error';
  payload: {
    projectId: string;
    deploymentId: string;
    gitSha: string;
    timestamp: Date;
    data: any;
  };
}

interface SentryEvent {
  type: 'error' | 'transaction' | 'session';
  payload: {
    projectId: string;
    eventId: string;
    timestamp: Date;
    data: any;
  };
}

// Correlation Engine
class CorrelationEngine {
  async correlate(event: Event): Promise<Correlations> {
    const correlations = await Promise.all([
      this.correlateByGitSha(event),
      this.correlateByTimeWindow(event),
      this.correlateByActor(event),
      this.correlateByDependency(event)
    ]);

    return this.mergeCorrelations(correlations);
  }

  private async correlateByGitSha(event: Event): Promise<GitCorrelation> {
    // Find all events with matching git SHA
    const gitSha = this.extractGitSha(event);
    if (!gitSha) return null;

    const related = await this.findEventsByGitSha(gitSha);
    return {
      type: 'git_sha',
      confidence: 1.0,
      relatedEvents: related
    };
  }

  private async correlateByTimeWindow(event: Event): Promise<TimeCorrelation> {
    // Find events within temporal proximity
    const window = this.getTimeWindow(event);
    const related = await this.findEventsInWindow(
      window.start,
      window.end,
      event.source
    );

    return {
      type: 'temporal',
      confidence: this.calculateTemporalConfidence(event, related),
      relatedEvents: related
    };
  }
}

// Observation Generator
class ObservationGenerator {
  async generate(
    event: Event,
    correlations: Correlations
  ): Promise<Observation> {
    // Determine observation type based on event and correlations
    const type = this.determineObservationType(event, correlations);

    // Extract characteristics based on type
    const characteristics = await this.extractCharacteristics(
      type,
      event,
      correlations
    );

    // Build observation
    return {
      id: generateId(),
      type,
      sourceEvent: event,
      correlations,
      characteristics,
      significance: await this.calculateSignificance(event, correlations),
      timestamp: event.timestamp,
      actor: event.actor,
      entities: this.extractEntities(event, correlations)
    };
  }

  private determineObservationType(
    event: Event,
    correlations: Correlations
  ): ObservationType {
    // Complex rules for determining observation type

    // PR merged + deployment = milestone
    if (event.type === 'pr_merged' && correlations.hasDeployment) {
      return 'milestone';
    }

    // Deployment + error spike = incident
    if (event.type === 'deployment_ready' && correlations.hasErrorSpike) {
      return 'incident';
    }

    // Error resolved + PR merged = highlight
    if (event.type === 'error_resolved' && correlations.hasPRFix) {
      return 'highlight';
    }

    // Default mappings
    return this.getDefaultType(event);
  }
}
```

---

## Key Relationships & Patterns

### 1. PR → Deployment → Error Pattern
```
GitHub PR Merged → Vercel Deployment → Sentry Error Spike
                ↓                    ↓
          Change Observation    Incident Observation
                ↓                    ↓
            Linked by Git SHA & Time Window
                        ↓
                  Root Cause Analysis
                        ↓
                Fix PR Created (new cycle)
```

### 2. Issue → PR → Deployment → Resolution Pattern
```
GitHub Issue Created → PR Opened → PR Merged → Deployment
         ↓                ↓           ↓            ↓
    Problem Obs     Decision Obs  Change Obs  Milestone Obs
                           ↓
                    Summary Generated:
                "Issue #X resolved by PR #Y, deployed successfully"
```

### 3. Error → Investigation → Fix Pattern
```
Sentry Error Detected → GitHub Issue Created → PR with Fix → Deployment
         ↓                     ↓                    ↓            ↓
   Incident Obs          Investigation Obs     Decision Obs  Resolution Obs
                                ↓
                        Actor Profile Updated:
                    "Expert in error resolution"
```

---

## Performance & Scalability Considerations

### Processing Rates
- **GitHub Events**: ~1000/minute peak
- **Vercel Events**: ~100/minute peak
- **Sentry Events**: ~5000/minute peak

### Optimization Strategies
1. **Batch Processing**: Group events in 100ms windows
2. **Significance Pre-filtering**: Quick score before deep analysis
3. **Correlation Caching**: Cache recent correlations (5min TTL)
4. **Embedding Batching**: Process 10 observations at once
5. **Async Processing**: Non-blocking pipeline with queues

### Storage Requirements
- **Raw Events**: 30-day retention (10TB estimated)
- **Observations**: Permanent (1TB/year estimated)
- **Embeddings**: Permanent (500GB/year estimated)
- **Relationships**: Graph database (100GB estimated)

---

## Monitoring & Alerting

### Key Metrics
1. **Ingestion Lag**: Time from event to observation
2. **Correlation Accuracy**: Manual verification sampling
3. **Significance Precision**: False positive rate
4. **Processing Throughput**: Events/second
5. **Storage Growth**: GB/day

### Alert Conditions
- Ingestion lag > 5 minutes
- Correlation confidence < 0.7 for >10% events
- Error rate > 1% in any pipeline stage
- Queue depth > 10,000 events
- Storage growth > 2x baseline

---

## Future Enhancements

### Phase 2: Advanced Correlations
- Machine learning for correlation patterns
- Predictive incident detection
- Automated root cause analysis

### Phase 3: Additional Sources
- Datadog metrics
- PagerDuty incidents
- Linear issues
- Slack discussions

### Phase 4: Intelligence Layer
- Automated summaries
- Trend detection
- Anomaly detection
- Recommendation engine