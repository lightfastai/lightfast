# Neural Memory: Deep Dive into Observation Capture

Last Updated: 2025-11-27

This document provides a comprehensive implementation guide for the observation capture pipeline in the Neural Memory system, detailing how to generate rich observations, find related documents, perform deep evaluation, integrate web search, and ensure quality.

---

## Table of Contents

1. [Deep Observation Extraction & Generation](#1-deep-observation-extraction--generation)
2. [Deep Context Enrichment](#2-deep-context-enrichment)
3. [Advanced Document & Chunk Linking](#3-advanced-document--chunk-linking)
4. [Multi-View Embedding Generation](#4-multi-view-embedding-generation)
5. [Advanced Observation Classification](#5-advanced-observation-classification)
6. [Quality Assurance & Validation](#6-quality-assurance--validation)
7. [Complete Pipeline Integration](#7-complete-pipeline-integration)
8. [Performance Optimization](#8-performance-optimization)

---

## 1. Deep Observation Extraction & Generation

The observation extraction process involves multi-factor analysis to determine significance and extract meaningful insights from raw events.

```typescript
// inngest/workflow/neural/observation-capture-detailed.ts

interface RawEventContext {
  sourceType: 'github' | 'linear' | 'slack' | 'notion' | 'convex';
  rawEvent: any;
  metadata: {
    actor?: { id: string; name: string; email?: string };
    timestamp: Date;
    sourceUrl?: string;
    references?: string[];
  };
}

/**
 * Step 1: Deep Significance Evaluation
 * Evaluates whether an event is significant enough to capture as an observation
 */
async function evaluateSignificance(rawEvent: RawEventContext): Promise<{
  score: number;
  factors: Record<string, number>;
  reasoning: string;
}> {
  const factors: Record<string, number> = {};

  // 1. Event Type Significance
  factors.eventType = getEventTypeScore(rawEvent.sourceType, rawEvent.rawEvent);

  // 2. Actor Importance (based on past contributions)
  if (rawEvent.metadata.actor) {
    const actorProfile = await getActorProfile(rawEvent.metadata.actor.id);
    factors.actorImportance = calculateActorImportance(actorProfile);
  }

  // 3. Content Analysis
  const content = extractTextContent(rawEvent);

  // Check for decision indicators
  factors.decisionIndicators = await analyzeForDecisions(content);

  // Check for technical depth
  factors.technicalDepth = await analyzeTechnicalDepth(content);

  // 4. Impact Radius
  factors.impactRadius = await calculateImpactRadius(rawEvent);

  // 5. Temporal Relevance
  factors.temporalRelevance = calculateTemporalRelevance(rawEvent.metadata.timestamp);

  // 6. Web Search for External Context
  const webContext = await searchForExternalContext(content);
  factors.externalRelevance = webContext.relevanceScore;

  // Calculate weighted score
  const weights = {
    eventType: 0.2,
    actorImportance: 0.15,
    decisionIndicators: 0.25,
    technicalDepth: 0.15,
    impactRadius: 0.15,
    temporalRelevance: 0.05,
    externalRelevance: 0.05
  };

  const score = Object.entries(factors).reduce(
    (sum, [key, value]) => sum + (weights[key] || 0) * value,
    0
  );

  const reasoning = generateSignificanceReasoning(factors, score);

  return { score, factors, reasoning };
}

/**
 * Deep Decision Analysis
 * Uses LLM to detect decision-making patterns in content
 */
async function analyzeForDecisions(content: string): Promise<number> {
  const analysis = await llm.analyze({
    model: "claude-3-haiku",
    prompt: `Analyze this content for decision-making patterns.
    Score from 0-1 based on:
    - Explicit decisions made
    - Trade-offs discussed
    - Alternatives considered
    - Rationale provided
    - Impact on future work

    Content: ${content}

    Return JSON: { score: number, indicators: string[] }`,
    temperature: 0.2
  });

  return analysis.score;
}

/**
 * Technical Depth Analysis
 * Evaluates the technical complexity and depth of the content
 */
async function analyzeTechnicalDepth(content: string): Promise<number> {
  const indicators = {
    codePatterns: /```[\s\S]*?```/g.test(content),
    technicalTerms: countTechnicalTerms(content),
    complexityMarkers: detectComplexityMarkers(content),
    architectureDiscussion: detectArchitecturePatterns(content),
    performanceMetrics: detectPerformanceDiscussion(content)
  };

  return calculateTechnicalScore(indicators);
}

/**
 * Impact Radius Calculation
 * Determines how many systems/people are affected
 */
async function calculateImpactRadius(rawEvent: RawEventContext): Promise<number> {
  const impacts = {
    directMentions: extractMentions(rawEvent.rawEvent),
    affectedFiles: extractAffectedFiles(rawEvent),
    linkedIssues: await getLinkedIssues(rawEvent),
    teamInvolvement: await calculateTeamInvolvement(rawEvent),
    systemDependencies: await traceSys

Dependencies(rawEvent)
  };

  return normalizeImpactScore(impacts);
}

/**
 * Web Search for External Context
 * Enriches observations with relevant external knowledge
 */
async function searchForExternalContext(content: string): Promise<{
  relevanceScore: number;
  externalSources: Array<{
    url: string;
    title: string;
    snippet: string;
    relevance: number;
  }>;
}> {
  // Extract key concepts for search
  const concepts = await extractKeyConcepts(content);

  // Search using Exa for technical documentation
  const exaResults = await exa.searchSimilar({
    text: concepts.join(" "),
    category: "technical",
    numResults: 5,
    startPublishedDate: subDays(new Date(), 180).toISOString()
  });

  // Calculate relevance based on concept overlap
  const sources = exaResults.results.map(result => ({
    url: result.url,
    title: result.title,
    snippet: result.snippet,
    relevance: calculateConceptOverlap(concepts, result.text)
  }));

  const relevanceScore = sources.reduce((sum, s) => sum + s.relevance, 0) / sources.length;

  return { relevanceScore, externalSources: sources };
}

/**
 * Key Concept Extraction
 * Identifies the main technical concepts for web search
 */
async function extractKeyConcepts(content: string): Promise<string[]> {
  // Use NLP to extract key phrases
  const extraction = await llm.extract({
    model: "claude-3-haiku",
    prompt: `Extract 5-10 key technical concepts from this content.
    Focus on:
    - Technologies mentioned
    - Architectural patterns
    - Algorithms or data structures
    - Problem domains
    - Technical challenges

    Content: ${content}

    Return as JSON array of strings`,
    temperature: 0.3
  });

  return extraction;
}
```

---

## 2. Deep Context Enrichment

Context enrichment pulls in related information from multiple sources to provide a complete picture of the observation.

```typescript
/**
 * Rich Context Enrichment Pipeline
 * Enriches raw events with context from multiple sources
 */
async function enrichContext(
  sourceType: string,
  sourceId: string
): Promise<EnrichedContext> {
  const enriched: EnrichedContext = {
    actor: null,
    entities: [],
    references: [],
    relatedEvents: [],
    dependencies: [],
    crossReferences: [],
    timeline: []
  };

  // Source-specific enrichment
  switch (sourceType) {
    case 'github':
      enriched.merge(await enrichGitHubContext(sourceId));
      break;
    case 'linear':
      enriched.merge(await enrichLinearContext(sourceId));
      break;
    case 'slack':
      enriched.merge(await enrichSlackContext(sourceId));
      break;
    case 'notion':
      enriched.merge(await enrichNotionContext(sourceId));
      break;
  }

  // Cross-reference with other sources
  enriched.crossReferences = await findCrossReferences(enriched);

  // Fetch dependency graph
  enriched.dependencies = await traceDependencies(enriched.entities);

  // Build timeline of related events
  enriched.timeline = await buildEventTimeline(enriched);

  return enriched;
}

/**
 * GitHub Context Enrichment
 * Pulls in PR, issue, and code context
 */
async function enrichGitHubContext(prId: string): Promise<Partial<EnrichedContext>> {
  const pr = await github.getPullRequest(prId);

  // Get related issues
  const linkedIssues = await github.getLinkedIssues(prId);

  // Get previous PRs by same author on same files
  const relatedPRs = await github.findRelatedPRs({
    author: pr.author,
    files: pr.files,
    beforeDate: pr.createdAt
  });

  // Extract code context
  const codeContext = await analyzeCodeChanges(pr.diff);

  // Find mentioned users and teams
  const mentions = extractMentions(pr.body + pr.comments.join(' '));

  // Get review history
  const reviewHistory = await github.getReviewHistory(prId);

  // Analyze commit messages
  const commitAnalysis = await analyzeCommitMessages(pr.commits);

  return {
    actor: {
      id: pr.author.id,
      name: pr.author.name,
      type: 'user',
      expertise: await inferExpertise(pr.author.id, pr.files),
      recentActivity: await getRecentActivity(pr.author.id)
    },
    entities: [
      ...linkedIssues.map(i => ({
        type: 'issue',
        id: i.id,
        title: i.title,
        status: i.status,
        priority: i.priority
      })),
      ...pr.files.map(f => ({
        type: 'file',
        path: f.path,
        changes: f.changes,
        language: detectLanguage(f.path)
      })),
      ...mentions.map(m => ({
        type: 'user',
        id: m.id,
        name: m.name,
        role: m.role
      })),
      ...extractCodeEntities(codeContext)
    ],
    references: [
      pr.url,
      ...linkedIssues.map(i => i.url),
      ...relatedPRs.map(p => p.url),
      ...extractExternalLinks(pr.body)
    ],
    relatedEvents: [
      ...relatedPRs.map(pr => ({
        type: 'pr_merged',
        id: pr.id,
        timestamp: pr.mergedAt,
        relevance: calculateRelevance(pr, pr),
        summary: pr.title
      })),
      ...reviewHistory.map(review => ({
        type: 'pr_reviewed',
        id: review.id,
        timestamp: review.submittedAt,
        reviewer: review.author,
        decision: review.state
      }))
    ],
    codeInsights: {
      ...codeContext,
      complexity: calculateCodeComplexity(pr.diff),
      testCoverage: await getTestCoverageImpact(pr.files),
      dependencies: await analyzeDependencyChanges(pr.diff)
    },
    commitInsights: commitAnalysis
  };
}

/**
 * Linear Context Enrichment
 * Enriches with project management context
 */
async function enrichLinearContext(issueId: string): Promise<Partial<EnrichedContext>> {
  const issue = await linear.getIssue(issueId);

  // Get related issues in the project
  const projectIssues = await linear.getProjectIssues(issue.projectId);

  // Get team context
  const teamContext = await linear.getTeamContext(issue.teamId);

  // Get workflow history
  const stateTransitions = await linear.getStateTransitions(issueId);

  // Get comments and discussions
  const comments = await linear.getComments(issueId);

  return {
    actor: {
      id: issue.assignee?.id,
      name: issue.assignee?.name,
      type: 'user',
      workload: await calculateUserWorkload(issue.assignee?.id)
    },
    entities: [
      { type: 'project', id: issue.projectId, name: issue.project.name },
      { type: 'team', id: issue.teamId, name: teamContext.name },
      { type: 'milestone', id: issue.cycle?.id, name: issue.cycle?.name },
      ...issue.labels.map(l => ({ type: 'label', id: l.id, name: l.name })),
      ...extractEntitiesFromComments(comments)
    ],
    relatedEvents: [
      ...stateTransitions.map(t => ({
        type: 'state_change',
        from: t.fromState,
        to: t.toState,
        timestamp: t.createdAt,
        actor: t.actor
      })),
      ...comments.map(c => ({
        type: 'comment',
        id: c.id,
        timestamp: c.createdAt,
        author: c.author,
        sentiment: analyzeSentiment(c.body)
      }))
    ],
    projectContext: {
      progress: calculateProjectProgress(projectIssues),
      blockers: identifyBlockers(projectIssues),
      risks: assessProjectRisks(projectIssues),
      velocity: calculateVelocity(teamContext)
    }
  };
}

/**
 * Slack Context Enrichment
 * Enriches with conversation and team communication context
 */
async function enrichSlackContext(messageId: string): Promise<Partial<EnrichedContext>> {
  const message = await slack.getMessage(messageId);
  const thread = await slack.getThread(messageId);
  const channel = await slack.getChannel(message.channelId);

  // Analyze conversation dynamics
  const conversationAnalysis = await analyzeConversation(thread);

  // Extract decisions from thread
  const decisions = await extractDecisionsFromThread(thread);

  // Get participant profiles
  const participants = await Promise.all(
    thread.participants.map(p => slack.getUserProfile(p))
  );

  return {
    entities: [
      { type: 'channel', id: channel.id, name: channel.name },
      ...participants.map(p => ({
        type: 'user',
        id: p.id,
        name: p.name,
        timezone: p.timezone
      })),
      ...extractTopicsFromConversation(thread)
    ],
    relatedEvents: [
      ...thread.messages.map(m => ({
        type: 'message',
        id: m.id,
        timestamp: m.timestamp,
        author: m.author,
        isReaction: m.reactions?.length > 0
      })),
      ...decisions.map(d => ({
        type: 'decision',
        content: d.content,
        timestamp: d.timestamp,
        participants: d.participants
      }))
    ],
    conversationInsights: {
      sentiment: conversationAnalysis.sentiment,
      consensus: conversationAnalysis.consensusLevel,
      keyPoints: conversationAnalysis.keyPoints,
      actionItems: extractActionItems(thread),
      questions: extractQuestions(thread)
    }
  };
}

/**
 * Cross-Reference Discovery
 * Finds connections between different sources
 */
async function findCrossReferences(context: EnrichedContext): Promise<CrossReference[]> {
  const references: CrossReference[] = [];

  // Search for GitHub issues mentioned in Linear
  for (const entity of context.entities) {
    if (entity.type === 'issue' && entity.platform === 'linear') {
      const githubRefs = await findGitHubReferences(entity.title, entity.description);
      references.push(...githubRefs.map(ref => ({
        source: { platform: 'linear', id: entity.id },
        target: { platform: 'github', id: ref.id },
        type: 'mentions',
        confidence: ref.confidence
      })));
    }
  }

  // Search for Slack discussions about PRs/issues
  for (const ref of context.references) {
    if (ref.includes('github.com')) {
      const slackDiscussions = await slack.searchMessages(ref);
      references.push(...slackDiscussions.map(disc => ({
        source: { platform: 'github', url: ref },
        target: { platform: 'slack', id: disc.id },
        type: 'discussed',
        confidence: 0.9
      })));
    }
  }

  // Find Notion docs that reference this work
  const notionDocs = await notion.searchContent(
    context.entities.map(e => e.name).join(' OR ')
  );

  references.push(...notionDocs.map(doc => ({
    source: { platform: context.platform, id: context.id },
    target: { platform: 'notion', id: doc.id },
    type: 'documented',
    confidence: doc.relevance
  })));

  return references;
}
```

---

## 3. Advanced Document & Chunk Linking

The document and chunk linking system uses multi-stage retrieval and advanced ranking to find the most relevant content.

```typescript
/**
 * Intelligent Document Discovery
 * Multi-strategy approach to finding related documents
 */
async function findRelatedDocuments(
  workspaceId: string,
  observation: Observation,
  references: string[]
): Promise<RelatedDocument[]> {
  // 1. Direct reference matching
  const directMatches = await findDirectReferences(workspaceId, references);

  // 2. Semantic search for similar documents
  const semanticMatches = await findSemanticallySimilar(
    workspaceId,
    observation.content,
    {
      limit: 20,
      threshold: 0.75,
      useHybridSearch: true
    }
  );

  // 3. Graph-based discovery (documents owned by same actors)
  const graphMatches = await findGraphRelated(
    workspaceId,
    observation.actor,
    observation.entities
  );

  // 4. Temporal clustering (documents from same time period)
  const temporalMatches = await findTemporallyRelated(
    workspaceId,
    observation.occurredAt,
    {
      windowDays: 7,
      decayFactor: 0.9
    }
  );

  // 5. Topic-based discovery
  const topicMatches = await findTopicRelated(
    workspaceId,
    observation.topics,
    {
      minOverlap: 0.5
    }
  );

  // 6. Score and rank all matches
  const allMatches = [
    ...directMatches,
    ...semanticMatches,
    ...graphMatches,
    ...temporalMatches,
    ...topicMatches
  ];

  return rankDocuments(allMatches, {
    weights: {
      directReference: 0.35,
      semanticSimilarity: 0.25,
      graphDistance: 0.15,
      temporalProximity: 0.10,
      topicOverlap: 0.15
    },
    deduplication: true,
    maxResults: 10
  });
}

/**
 * Smart Chunk Retrieval
 * Multi-stage retrieval pipeline for finding relevant chunks
 */
async function findRelatedChunks(
  workspaceId: string,
  content: string,
  context: EnrichedContext
): Promise<ChunkMatch[]> {
  // 1. Generate query embeddings for different aspects
  const embeddings = await generateQueryEmbeddings(content);

  // 2. Multi-stage retrieval pipeline
  const chunks = await performMultiStageRetrieval({
    workspaceId,
    embeddings,
    stages: [
      // Stage 1: Broad semantic search (high recall)
      {
        name: 'broad_semantic',
        embedding: embeddings.conceptEmb,
        namespace: 'knowledge_chunks',
        topK: 100,
        scoreThreshold: 0.7,
        filters: {
          recency: { days: 365 }
        }
      },
      // Stage 2: Detailed matching (precision)
      {
        name: 'detailed_match',
        embedding: embeddings.detailEmb,
        namespace: 'knowledge_chunks',
        topK: 50,
        scoreThreshold: 0.75,
        filters: {
          stage1Results: true,
          entities: context.entities.map(e => e.id)
        }
      },
      // Stage 3: Intent alignment (relevance)
      {
        name: 'intent_align',
        embedding: embeddings.intentEmb,
        namespace: 'knowledge_chunks',
        topK: 20,
        scoreThreshold: 0.8,
        filters: {
          stage2Results: true
        }
      }
    ]
  });

  // 3. Cross-encoder reranking for final precision
  const reranked = await crossEncoderRerank(
    content,
    chunks,
    {
      model: 'ms-marco-MiniLM',
      topK: 10,
      includeScores: true
    }
  );

  // 4. Enrich chunks with context
  return await enrichChunks(reranked, {
    includeSurrounding: true,
    includeMetadata: true,
    includeLineage: true,
    includeRelatedChunks: true
  });
}

/**
 * Generate Query Embeddings
 * Creates multiple embeddings for different search strategies
 */
async function generateQueryEmbeddings(content: string): Promise<QueryEmbeddings> {
  const [concepts, details, intent] = await Promise.all([
    extractConcepts(content),
    extractTechnicalTerms(content),
    extractIntent(content)
  ]);

  const [conceptEmb, detailEmb, intentEmb] = await Promise.all([
    // High-level concepts for broad matching
    generateEmbedding(concepts, {
      model: 'text-embedding-3-small',
      dimensions: 512,
      instruction: 'Represent the high-level concepts for retrieval'
    }),

    // Technical details for precise matching
    generateEmbedding(details, {
      model: 'text-embedding-3-large',
      dimensions: 1536,
      instruction: 'Represent the technical details for retrieval'
    }),

    // Intent/purpose for relevance
    generateEmbedding(intent, {
      model: 'text-embedding-3-small',
      dimensions: 768,
      instruction: 'Represent the intent and purpose for retrieval'
    })
  ]);

  return { conceptEmb, detailEmb, intentEmb };
}

/**
 * Multi-Stage Retrieval Pipeline
 * Progressively refines search results through multiple stages
 */
async function performMultiStageRetrieval(
  config: MultiStageConfig
): Promise<Chunk[]> {
  let candidates: Map<string, ChunkCandidate> = new Map();
  const stageMetrics: StageMetrics[] = [];

  for (const stage of config.stages) {
    const startTime = Date.now();

    // Build filter based on previous stages
    const filter = buildStageFilter(stage, candidates);

    // Query vector store
    const stageResults = await pinecone.query({
      vector: stage.embedding,
      namespace: `${config.workspaceId}_${stage.namespace}`,
      topK: stage.topK,
      includeMetadata: true,
      filter
    });

    // Filter by threshold and merge with candidates
    const filtered = stageResults.matches
      .filter(m => m.score >= stage.scoreThreshold)
      .map(m => ({
        id: m.id,
        ...m.metadata,
        scores: {
          [stage.name]: m.score
        },
        stages: [stage.name]
      }));

    // Merge with existing candidates
    mergeCandidates(candidates, filtered, stage.name);

    // Track metrics
    stageMetrics.push({
      stage: stage.name,
      inputCount: candidates.size,
      outputCount: filtered.length,
      duration: Date.now() - startTime,
      averageScore: calculateAverageScore(filtered)
    });
  }

  // Convert to array and sort by combined score
  const finalCandidates = Array.from(candidates.values())
    .map(c => ({
      ...c,
      combinedScore: calculateCombinedScore(c.scores)
    }))
    .sort((a, b) => b.combinedScore - a.combinedScore);

  // Log retrieval metrics
  await logRetrievalMetrics(config.workspaceId, stageMetrics, finalCandidates);

  return finalCandidates;
}

/**
 * Cross-Encoder Reranking
 * Uses a cross-encoder model for precise reranking
 */
async function crossEncoderRerank(
  query: string,
  chunks: Chunk[],
  options: RerankOptions
): Promise<RankedChunk[]> {
  // Batch chunks for efficient processing
  const batchSize = 32;
  const batches = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }

  // Process batches in parallel
  const batchResults = await Promise.all(
    batches.map(batch =>
      rerankBatch(query, batch, options.model)
    )
  );

  // Flatten and sort by rerank score
  const reranked = batchResults
    .flat()
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, options.topK);

  if (options.includeScores) {
    return reranked.map(chunk => ({
      ...chunk,
      scores: {
        original: chunk.combinedScore,
        rerank: chunk.rerankScore,
        final: combineScores(chunk.combinedScore, chunk.rerankScore)
      }
    }));
  }

  return reranked;
}

/**
 * Chunk Enrichment
 * Adds additional context to retrieved chunks
 */
async function enrichChunks(
  chunks: RankedChunk[],
  options: EnrichmentOptions
): Promise<EnrichedChunk[]> {
  return await Promise.all(
    chunks.map(async chunk => {
      const enriched: EnrichedChunk = { ...chunk };

      if (options.includeSurrounding) {
        // Get surrounding chunks for context
        enriched.surrounding = await getSurroundingChunks(
          chunk.documentId,
          chunk.chunkIndex,
          { before: 1, after: 1 }
        );
      }

      if (options.includeMetadata) {
        // Get document metadata
        enriched.documentMetadata = await getDocumentMetadata(chunk.documentId);
      }

      if (options.includeLineage) {
        // Get version history
        enriched.lineage = await getChunkLineage(chunk.id);
      }

      if (options.includeRelatedChunks) {
        // Find semantically similar chunks
        enriched.relatedChunks = await findSimilarChunks(
          chunk.embedding,
          {
            limit: 3,
            excludeDocument: chunk.documentId
          }
        );
      }

      return enriched;
    })
  );
}
```

---

## 4. Multi-View Embedding Generation

The multi-view embedding system creates specialized embeddings for different retrieval scenarios.

```typescript
/**
 * Sophisticated Multi-View Embeddings
 * Creates multiple specialized embeddings for comprehensive retrieval
 */
async function generateMultiViewEmbeddings(
  observation: Observation
): Promise<MultiViewEmbeddings> {
  // Prepare different views of the observation
  const views = await prepareObservationViews(observation);

  // Generate embeddings in parallel
  const embeddings = await Promise.all([
    // 1. Title Embedding - Optimized for high-level matching
    generateEmbedding(views.title, {
      model: 'text-embedding-3-small',
      dimensions: 512,
      normalize: true,
      instruction: 'Represent the title for semantic search'
    }),

    // 2. Content Embedding - Full detail for similarity
    generateEmbedding(views.content, {
      model: 'text-embedding-3-large',
      dimensions: 1536,
      normalize: true,
      instruction: 'Represent the full content for detailed matching'
    }),

    // 3. Summary Embedding - Conceptual alignment
    generateEmbedding(views.summary, {
      model: 'text-embedding-3-small',
      dimensions: 768,
      normalize: true,
      instruction: 'Represent the key concepts and summary'
    }),

    // 4. Context Embedding - Relationships and dependencies
    generateEmbedding(views.context, {
      model: 'text-embedding-3-small',
      dimensions: 512,
      normalize: true,
      instruction: 'Represent the contextual relationships'
    }),

    // 5. Temporal Embedding - Time-aware representation
    generateEmbedding(views.temporal, {
      model: 'text-embedding-3-small',
      dimensions: 256,
      normalize: true,
      instruction: 'Represent the temporal context'
    }),

    // 6. Technical Embedding - Code and technical details
    generateEmbedding(views.technical, {
      model: 'code-embedding-ada-002',
      dimensions: 1024,
      normalize: true,
      instruction: 'Represent technical and code content'
    }),

    // 7. Decision Embedding - Decision-making aspects
    generateEmbedding(views.decision, {
      model: 'text-embedding-3-small',
      dimensions: 512,
      normalize: true,
      instruction: 'Represent decision-making aspects'
    })
  ]);

  // Store embeddings with metadata
  const storedEmbeddings = await storeMultiViewEmbeddings(
    observation.id,
    embeddings,
    views
  );

  return storedEmbeddings;
}

/**
 * Prepare Observation Views
 * Creates different textual representations for embedding
 */
async function prepareObservationViews(
  observation: Observation
): Promise<ObservationViews> {
  // Generate summary if not exists
  const summary = observation.summary || await generateSummary(
    observation.content,
    { maxTokens: 200, style: 'conceptual' }
  );

  // Extract technical content
  const technicalContent = extractTechnicalContent(observation.content);

  // Extract decision content
  const decisionContent = extractDecisionContent(observation);

  return {
    title: observation.title,

    content: observation.content,

    summary: `${observation.title}. ${summary}`,

    context: [
      `Actor: ${observation.actor.name} (${observation.actor.type})`,
      `Entities: ${observation.entities.map(e => e.name).join(', ')}`,
      `Topics: ${observation.topics.join(', ')}`,
      `Type: ${observation.type}`,
      `Impact: ${observation.impact}`,
      `Dependencies: ${observation.dependencies.join(', ')}`
    ].join('. '),

    temporal: [
      `Occurred: ${observation.occurredAt.toISOString()}`,
      `Day: ${format(observation.occurredAt, 'EEEE')}`,
      `Week: ${getWeek(observation.occurredAt)}`,
      `Month: ${format(observation.occurredAt, 'MMMM yyyy')}`,
      `Quarter: Q${getQuarter(observation.occurredAt)} ${getYear(observation.occurredAt)}`,
      `Relative: ${formatDistance(observation.occurredAt, new Date())} ago`
    ].join('. '),

    technical: technicalContent || 'No technical content',

    decision: decisionContent || 'No decision content'
  };
}

/**
 * Store Multi-View Embeddings
 * Stores embeddings in appropriate namespaces with metadata
 */
async function storeMultiViewEmbeddings(
  observationId: string,
  embeddings: Float32Array[],
  views: ObservationViews
): Promise<MultiViewEmbeddings> {
  const namespaces = [
    'neural_title',
    'neural_content',
    'neural_summary',
    'neural_context',
    'neural_temporal',
    'neural_technical',
    'neural_decision'
  ];

  const storedIds = await Promise.all(
    embeddings.map(async (embedding, index) => {
      const namespace = namespaces[index];
      const viewName = Object.keys(views)[index];

      // Store in Pinecone with metadata
      const stored = await pinecone.upsert({
        namespace,
        vectors: [{
          id: `${observationId}_${viewName}`,
          values: Array.from(embedding),
          metadata: {
            observationId,
            viewType: viewName,
            dimensions: embedding.length,
            createdAt: new Date().toISOString(),
            textLength: views[viewName].length,
            hash: hashText(views[viewName])
          }
        }]
      });

      // Store in database for tracking
      const [record] = await db.insert(neuralEmbeddings).values({
        id: generateEmbeddingId(),
        observationId,
        viewType: viewName,
        namespace,
        dimensions: embedding.length,
        pineconeId: stored.upsertedIds[0]
      }).returning();

      return record.id;
    })
  );

  return {
    titleEmbeddingId: storedIds[0],
    contentEmbeddingId: storedIds[1],
    summaryEmbeddingId: storedIds[2],
    contextEmbeddingId: storedIds[3],
    temporalEmbeddingId: storedIds[4],
    technicalEmbeddingId: storedIds[5],
    decisionEmbeddingId: storedIds[6]
  };
}

/**
 * Extract Technical Content
 * Identifies and extracts technical aspects from observation
 */
function extractTechnicalContent(content: string): string | null {
  const technical = [];

  // Extract code blocks
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  technical.push(...codeBlocks.map(block =>
    block.replace(/```(\w+)?\n?/, '').replace(/```$/, '')
  ));

  // Extract technical terms
  const techTerms = extractTechnicalTerms(content);
  if (techTerms.length > 0) {
    technical.push(`Technologies: ${techTerms.join(', ')}`);
  }

  // Extract metrics and numbers
  const metrics = extractMetrics(content);
  if (metrics.length > 0) {
    technical.push(`Metrics: ${metrics.join(', ')}`);
  }

  // Extract API endpoints
  const endpoints = extractAPIEndpoints(content);
  if (endpoints.length > 0) {
    technical.push(`APIs: ${endpoints.join(', ')}`);
  }

  return technical.length > 0 ? technical.join('\n\n') : null;
}

/**
 * Extract Decision Content
 * Identifies decision-making aspects of the observation
 */
function extractDecisionContent(observation: Observation): string | null {
  const decision = [];

  // Check if it's a decision type
  if (observation.type === 'decision') {
    decision.push(`Decision Type: ${observation.decisionType}`);

    if (observation.alternatives?.length > 0) {
      decision.push(`Alternatives Considered: ${observation.alternatives.join(', ')}`);
    }

    if (observation.rationale) {
      decision.push(`Rationale: ${observation.rationale}`);
    }

    if (observation.impact) {
      decision.push(`Impact: ${observation.impact}`);
    }
  }

  // Extract decision indicators from content
  const decisionPhrases = [
    /decided to/gi,
    /chose to/gi,
    /will go with/gi,
    /the plan is/gi,
    /agreed on/gi,
    /conclusion:/gi
  ];

  for (const phrase of decisionPhrases) {
    const matches = observation.content.match(phrase);
    if (matches) {
      const context = extractSurroundingText(observation.content, phrase);
      decision.push(context);
    }
  }

  return decision.length > 0 ? decision.join('\n') : null;
}
```

---

## 5. Advanced Observation Classification

The classification system uses multiple approaches to accurately categorize observations.

```typescript
/**
 * Sophisticated Observation Type Classification
 * Multi-model ensemble approach for accurate classification
 */
async function classifyObservationType(
  rawEvent: RawEventContext,
  enrichedContext: EnrichedContext
): Promise<{
  type: ObservationType;
  confidence: number;
  subtype?: string;
  characteristics: Record<string, any>;
  reasoning: string;
}> {
  // Multi-model classification approach
  const [llmClass, ruleClass, patternClass, mlClass] = await Promise.all([
    // 1. LLM-based classification
    classifyWithLLM(rawEvent, enrichedContext),

    // 2. Rule-based classification
    classifyWithRules(rawEvent),

    // 3. Pattern matching classification
    classifyWithPatterns(rawEvent.rawEvent),

    // 4. ML model classification
    classifyWithMLModel(rawEvent, enrichedContext)
  ]);

  // Ensemble voting with weighted confidence
  const ensemble = combineClassifications(
    [llmClass, ruleClass, patternClass, mlClass],
    {
      weights: [0.4, 0.2, 0.2, 0.2],
      strategy: 'weighted_voting'
    }
  );

  // Extract detailed characteristics based on type
  const characteristics = await extractCharacteristics(
    ensemble.type,
    rawEvent,
    enrichedContext
  );

  // Generate reasoning for the classification
  const reasoning = generateClassificationReasoning(
    ensemble,
    [llmClass, ruleClass, patternClass, mlClass]
  );

  return {
    type: ensemble.type,
    confidence: ensemble.confidence,
    subtype: ensemble.subtype,
    characteristics,
    reasoning
  };
}

/**
 * LLM-based Classification
 * Uses language model for nuanced classification
 */
async function classifyWithLLM(
  rawEvent: RawEventContext,
  context: EnrichedContext
): Promise<ClassificationResult> {
  const prompt = `
    Classify this event into one of these observation types:
    - decision: A choice or decision was made
    - incident: An issue, bug, or problem occurred
    - highlight: A notable achievement or learning
    - change: A significant change or update
    - insight: A discovery or realization
    - milestone: A project milestone was reached

    Event Context:
    Source: ${rawEvent.sourceType}
    Content: ${truncate(rawEvent.rawEvent.content, 1000)}
    Actor: ${context.actor?.name}
    Entities: ${context.entities.map(e => e.name).join(', ')}

    Provide classification with confidence (0-1) and reasoning.

    Return JSON:
    {
      "type": "...",
      "confidence": 0.X,
      "subtype": "optional specific subtype",
      "indicators": ["list", "of", "key", "indicators"],
      "reasoning": "explanation of classification"
    }
  `;

  const response = await llm.classify({
    model: 'claude-3-haiku',
    prompt,
    temperature: 0.3,
    maxTokens: 500
  });

  return response;
}

/**
 * Rule-based Classification
 * Deterministic rules for clear-cut cases
 */
async function classifyWithRules(
  rawEvent: RawEventContext
): Promise<ClassificationResult> {
  const rules: ClassificationRule[] = [
    // Decision rules
    {
      type: 'decision',
      conditions: [
        { field: 'sourceType', value: 'github', subfield: 'type', equals: 'pr_merged' },
        { field: 'content', contains: ['decided', 'chose', 'will go with'] }
      ],
      confidence: 0.9
    },

    // Incident rules
    {
      type: 'incident',
      conditions: [
        { field: 'labels', contains: ['bug', 'incident', 'outage'] },
        { field: 'content', contains: ['error', 'failed', 'broken'] }
      ],
      confidence: 0.85
    },

    // Milestone rules
    {
      type: 'milestone',
      conditions: [
        { field: 'sourceType', value: 'linear', subfield: 'state', equals: 'completed' },
        { field: 'labels', contains: ['milestone', 'release'] }
      ],
      confidence: 0.95
    }
  ];

  for (const rule of rules) {
    if (evaluateRule(rule, rawEvent)) {
      return {
        type: rule.type,
        confidence: rule.confidence,
        method: 'rule_based'
      };
    }
  }

  // Default classification
  return {
    type: 'change',
    confidence: 0.5,
    method: 'rule_based_default'
  };
}

/**
 * Extract Characteristics
 * Detailed feature extraction based on observation type
 */
async function extractCharacteristics(
  type: ObservationType,
  rawEvent: RawEventContext,
  context: EnrichedContext
): Promise<Record<string, any>> {
  switch (type) {
    case 'decision':
      return await extractDecisionCharacteristics(rawEvent, context);

    case 'incident':
      return await extractIncidentCharacteristics(rawEvent, context);

    case 'highlight':
      return await extractHighlightCharacteristics(rawEvent, context);

    case 'change':
      return await extractChangeCharacteristics(rawEvent, context);

    case 'insight':
      return await extractInsightCharacteristics(rawEvent, context);

    case 'milestone':
      return await extractMilestoneCharacteristics(rawEvent, context);

    default:
      return {};
  }
}

/**
 * Extract Decision Characteristics
 */
async function extractDecisionCharacteristics(
  rawEvent: RawEventContext,
  context: EnrichedContext
): Promise<DecisionCharacteristics> {
  const content = extractContent(rawEvent);

  return {
    decisionType: await detectDecisionType(content),
    alternatives: await extractAlternatives(content),
    rationale: await extractRationale(content),
    stakeholders: context.entities.filter(e => e.type === 'user'),
    impact: await assessImpact(rawEvent, context),
    reversibility: await assessReversibility(content),
    confidence: await assessDecisionConfidence(content),
    tradeoffs: await extractTradeoffs(content),
    constraints: await extractConstraints(content),
    timeline: await extractDecisionTimeline(rawEvent),
    dependencies: await extractDependencies(content, context),
    risks: await assessRisks(content),
    consensus: await assessConsensusLevel(context)
  };
}

/**
 * Extract Incident Characteristics
 */
async function extractIncidentCharacteristics(
  rawEvent: RawEventContext,
  context: EnrichedContext
): Promise<IncidentCharacteristics> {
  const content = extractContent(rawEvent);

  // Analyze incident details
  const incidentAnalysis = await analyzeIncident(content, context);

  return {
    severity: detectSeverity(content, context),
    affectedSystems: extractAffectedSystems(content, context),
    rootCause: await inferRootCause(content, context),
    timeline: extractIncidentTimeline(rawEvent, context),
    resolution: extractResolution(content),
    preventionMeasures: await suggestPreventionMeasures(incidentAnalysis),
    impactedUsers: await estimateImpactedUsers(context),
    errorMessages: extractErrorMessages(content),
    stackTraces: extractStackTraces(content),
    relatedIncidents: await findRelatedIncidents(incidentAnalysis),
    lessonsLearned: await extractLessonsLearned(content, incidentAnalysis),
    responseTime: calculateResponseTime(rawEvent),
    resolutionTime: calculateResolutionTime(rawEvent)
  };
}
```

---

## 6. Quality Assurance & Validation

The quality assurance system ensures observations meet high standards before storage.

```typescript
/**
 * Observation Quality Validation Pipeline
 * Comprehensive quality checks and enhancement
 */
async function validateObservationQuality(
  observation: ProcessedObservation
): Promise<QualityReport> {
  const checks = await Promise.all([
    // Content quality checks
    checkContentQuality(observation),

    // Source verification
    verifySourceIntegrity(observation),

    // Relationship validity
    validateRelationships(observation),

    // Temporal consistency
    checkTemporalConsistency(observation),

    // Duplication check
    checkForDuplicates(observation),

    // Completeness check
    checkCompleteness(observation),

    // Consistency check
    checkConsistency(observation)
  ]);

  // Calculate overall quality score
  const overallScore = calculateQualityScore(checks);

  // Determine if enhancement is needed
  const needsEnhancement = overallScore < QUALITY_THRESHOLD ||
    checks.some(c => c.critical && !c.passed);

  if (needsEnhancement) {
    // Attempt automatic enhancement
    const enhanced = await enhanceObservation(observation, checks);

    // Re-validate if enhanced
    if (enhanced) {
      return validateObservationQuality(enhanced);
    }

    // Flag for manual review if can't enhance
    await flagForReview(observation, checks);
  }

  return {
    score: overallScore,
    checks,
    passed: overallScore >= QUALITY_THRESHOLD,
    recommendations: generateQualityRecommendations(checks),
    metadata: {
      validatedAt: new Date(),
      validationVersion: '1.0.0'
    }
  };
}

/**
 * Content Quality Check
 * Validates the quality of observation content
 */
async function checkContentQuality(
  observation: ProcessedObservation
): Promise<QualityCheck> {
  const issues: string[] = [];
  let score = 1.0;

  // Check content length
  if (observation.content.length < MIN_CONTENT_LENGTH) {
    issues.push('Content too short');
    score -= 0.2;
  }

  // Check for meaningful content
  const contentAnalysis = await analyzeContent(observation.content);
  if (contentAnalysis.informationDensity < 0.3) {
    issues.push('Low information density');
    score -= 0.15;
  }

  // Check for completeness
  if (!observation.title || observation.title.length < 10) {
    issues.push('Missing or inadequate title');
    score -= 0.1;
  }

  // Check for proper categorization
  if (observation.confidence < 0.6) {
    issues.push('Low classification confidence');
    score -= 0.1;
  }

  // Check for required fields based on type
  const requiredFields = getRequiredFields(observation.type);
  for (const field of requiredFields) {
    if (!observation[field]) {
      issues.push(`Missing required field: ${field}`);
      score -= 0.1;
    }
  }

  return {
    name: 'content_quality',
    passed: score >= 0.7,
    score,
    issues,
    critical: true
  };
}

/**
 * Source Verification
 * Verifies the integrity and authenticity of source references
 */
async function verifySourceIntegrity(
  observation: ProcessedObservation
): Promise<QualityCheck> {
  const issues: string[] = [];
  let verifiedCount = 0;

  for (const reference of observation.references) {
    try {
      // Verify URL is accessible
      const isValid = await verifyUrl(reference);
      if (isValid) {
        verifiedCount++;
      } else {
        issues.push(`Invalid reference: ${reference}`);
      }
    } catch (error) {
      issues.push(`Cannot verify reference: ${reference}`);
    }
  }

  const score = verifiedCount / observation.references.length;

  return {
    name: 'source_integrity',
    passed: score >= 0.8,
    score,
    issues,
    critical: false
  };
}

/**
 * Duplication Check
 * Detects if observation is duplicate or near-duplicate
 */
async function checkForDuplicates(
  observation: ProcessedObservation
): Promise<QualityCheck> {
  // Generate hash for exact duplicate detection
  const contentHash = hashContent(observation.content);

  // Check for exact duplicates
  const exactDuplicate = await db.select()
    .from(neuralObservations)
    .where(
      and(
        eq(neuralObservations.contentHash, contentHash),
        eq(neuralObservations.workspaceId, observation.workspaceId)
      )
    )
    .limit(1);

  if (exactDuplicate.length > 0) {
    return {
      name: 'duplication',
      passed: false,
      score: 0,
      issues: [`Exact duplicate of observation ${exactDuplicate[0].id}`],
      critical: true
    };
  }

  // Check for near-duplicates using embeddings
  const similarObservations = await findSimilarObservations(
    observation.embedding,
    {
      threshold: 0.95,
      limit: 5,
      timeWindow: { hours: 24 }
    }
  );

  if (similarObservations.length > 0) {
    const maxSimilarity = Math.max(...similarObservations.map(s => s.similarity));

    if (maxSimilarity > 0.98) {
      return {
        name: 'duplication',
        passed: false,
        score: 1 - maxSimilarity,
        issues: [`Near-duplicate detected (${(maxSimilarity * 100).toFixed(1)}% similar)`],
        critical: true
      };
    }
  }

  return {
    name: 'duplication',
    passed: true,
    score: 1.0,
    issues: [],
    critical: true
  };
}

/**
 * Automatic Enhancement
 * Attempts to improve observation quality automatically
 */
async function enhanceObservation(
  observation: ProcessedObservation,
  qualityChecks: QualityCheck[]
): Promise<ProcessedObservation | null> {
  const enhanced = { ...observation };
  let wasEnhanced = false;

  // Enhance title if needed
  if (qualityChecks.find(c => c.issues.includes('Missing or inadequate title'))) {
    enhanced.title = await generateTitle(observation.content);
    wasEnhanced = true;
  }

  // Enhance content if too short
  if (qualityChecks.find(c => c.issues.includes('Content too short'))) {
    const additionalContext = await fetchAdditionalContext(observation);
    if (additionalContext) {
      enhanced.content += `\n\n${additionalContext}`;
      wasEnhanced = true;
    }
  }

  // Add missing relationships
  if (qualityChecks.find(c => c.name === 'relationships' && !c.passed)) {
    const relationships = await inferRelationships(observation);
    enhanced.relatedDocuments.push(...relationships.documents);
    enhanced.relatedChunks.push(...relationships.chunks);
    wasEnhanced = true;
  }

  // Re-classify if confidence is low
  if (observation.confidence < 0.6) {
    const reclassified = await classifyObservationType(
      observation.rawEvent,
      observation.context
    );

    if (reclassified.confidence > observation.confidence) {
      enhanced.type = reclassified.type;
      enhanced.confidence = reclassified.confidence;
      enhanced.characteristics = reclassified.characteristics;
      wasEnhanced = true;
    }
  }

  return wasEnhanced ? enhanced : null;
}
```

---

## 7. Complete Pipeline Integration

Here's how all components integrate in the complete observation capture pipeline:

```typescript
/**
 * Complete Observation Capture Pipeline
 * Integrates all components for end-to-end processing
 */
export const observationCapture = inngest.createFunction(
  {
    id: "neural.observation.capture",
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId"
    },
    retries: 3
  },
  { event: "neural/observation.capture" },
  async ({ event, step }) => {
    const { sourceType, sourceId, workspaceId, rawEvent } = event.data;

    // Step 1: Deep Significance Evaluation (BLOCKING)
    const significance = await step.run("evaluate-significance", async () => {
      const evaluation = await evaluateSignificance(rawEvent);

      // Log evaluation for analytics
      await logSignificanceEvaluation(workspaceId, evaluation);

      if (evaluation.score < SIGNIFICANCE_THRESHOLD) {
        return {
          skip: true,
          reason: "Below significance threshold",
          score: evaluation.score,
          factors: evaluation.factors
        };
      }

      return {
        skip: false,
        ...evaluation
      };
    });

    if (significance.skip) {
      return {
        skipped: true,
        ...significance
      };
    }

    // Step 2: Rich Context Enrichment (BLOCKING)
    const context = await step.run("enrich-context", async () => {
      const enriched = await enrichContext(sourceType, sourceId);

      // Add web search context
      const webContext = await searchForExternalContext(
        extractContent(rawEvent)
      );

      enriched.externalSources = webContext.externalSources;

      return enriched;
    });

    // Step 3: Advanced Classification (BLOCKING)
    const classification = await step.run("classify-observation", async () => {
      return await classifyObservationType(rawEvent, context);
    });

    // Step 4: Extract Observation (BLOCKING)
    const observation = await step.run("extract-observation", async () => {
      return {
        id: generateObservationId(),
        workspaceId,
        occurredAt: rawEvent.metadata.timestamp,
        type: classification.type,
        subtype: classification.subtype,
        title: await generateTitle(rawEvent, classification),
        content: extractContent(rawEvent),
        actor: context.actor,
        entities: context.entities,
        confidence: classification.confidence,
        characteristics: classification.characteristics,
        reasoning: classification.reasoning,
        significance: significance.score,
        significanceFactors: significance.factors
      };
    });

    // Step 5: Parallel Processing (PARALLEL)
    const [docLinks, chunks, embeddings, quality] = await Promise.all([
      // Find related documents
      step.run("link-documents", async () => {
        return await findRelatedDocuments(
          workspaceId,
          observation,
          context.references
        );
      }),

      // Find related chunks
      step.run("link-chunks", async () => {
        return await findRelatedChunks(
          workspaceId,
          observation.content,
          context
        );
      }),

      // Generate multi-view embeddings
      step.run("generate-embeddings", async () => {
        return await generateMultiViewEmbeddings(observation);
      }),

      // Validate quality
      step.run("validate-quality", async () => {
        return await validateObservationQuality(observation);
      })
    ]);

    // Step 6: Quality Gate (BLOCKING)
    if (!quality.passed) {
      await step.run("handle-quality-failure", async () => {
        // Send to manual review queue
        await sendToReviewQueue({
          observation,
          quality,
          context
        });

        // Still store but flag as needs_review
        observation.qualityStatus = 'needs_review';
        observation.qualityScore = quality.score;
      });
    }

    // Step 7: Store Observation (BLOCKING)
    const stored = await step.run("store-observation", async () => {
      return await db.transaction(async (tx) => {
        // Store main observation
        const [obs] = await tx.insert(workspaceNeuralObservations).values({
          ...observation,
          ...embeddings,
          documentReferences: docLinks.map(d => d.id),
          chunkReferences: chunks.map(c => c.id),
          externalSources: context.externalSources,
          qualityScore: quality.score,
          qualityChecks: quality.checks,
          createdAt: new Date()
        }).returning();

        // Update statistics
        await tx.update(workspaceStores)
          .set({
            observationCount: sql`observation_count + 1`,
            lastObservationAt: new Date(),
            totalSignificanceScore: sql`total_significance_score + ${significance.score}`
          })
          .where(eq(workspaceStores.id, event.data.storeId));

        // Store relationships
        await storeObservationRelationships(tx, obs.id, {
          documents: docLinks,
          chunks,
          entities: context.entities,
          crossReferences: context.crossReferences
        });

        return obs;
      });
    });

    // Step 8: Trigger Downstream Events (NON-BLOCKING)
    await step.sendEvent("trigger-downstream", [
      // Update actor profile
      {
        name: "neural/profile.update",
        data: {
          actorId: observation.actor.id,
          actorType: observation.actor.type,
          observationId: stored.id,
          workspaceId
        }
      },

      // Check if summary needed
      {
        name: "neural/summary.check",
        data: {
          observationId: stored.id,
          topics: observation.topics,
          entities: context.entities,
          workspaceId
        }
      },

      // Track state transitions
      ...generateStateTransitionEvents(observation, context),

      // Analytics event
      {
        name: "analytics/observation.created",
        data: {
          observationId: stored.id,
          type: observation.type,
          significance: significance.score,
          quality: quality.score,
          workspaceId
        }
      }
    ]);

    // Step 9: Post-Processing Analytics (NON-BLOCKING)
    await step.run("post-processing", async () => {
      // Track metrics
      await trackObservationMetrics({
        workspaceId,
        observationId: stored.id,
        processingTime: Date.now() - rawEvent.metadata.timestamp,
        embeddingCount: Object.keys(embeddings).length,
        documentLinks: docLinks.length,
        chunkLinks: chunks.length,
        qualityScore: quality.score
      });

      // Update workspace learning
      await updateWorkspaceLearning(workspaceId, observation);
    });

    return {
      success: true,
      observationId: stored.id,
      type: observation.type,
      confidence: classification.confidence,
      significance: significance.score,
      quality: quality.score,
      embeddingIds: embeddings,
      linkedDocuments: docLinks.length,
      linkedChunks: chunks.length,
      processingTime: Date.now() - rawEvent.metadata.timestamp
    };
  }
);
```

---

## 8. Performance Optimization

Key optimization strategies for the observation capture pipeline:

```typescript
/**
 * Performance Optimization Configuration
 */
const OPTIMIZATION_CONFIG = {
  // Parallel processing limits
  parallelism: {
    maxConcurrentEmbeddings: 5,
    maxConcurrentWebSearches: 3,
    maxConcurrentDatabaseQueries: 10
  },

  // Caching configuration
  caching: {
    actorProfileTTL: 3600, // 1 hour
    documentMetadataTTL: 7200, // 2 hours
    embeddingCacheTTL: 86400 // 24 hours
  },

  // Batching configuration
  batching: {
    embeddingBatchSize: 10,
    databaseInsertBatchSize: 100,
    vectorSearchBatchSize: 50
  },

  // Timeout configuration
  timeouts: {
    webSearch: 5000, // 5s
    embeddingGeneration: 10000, // 10s
    totalProcessing: 60000 // 60s
  }
};

/**
 * Optimized Embedding Generation
 * Batches embedding requests for efficiency
 */
async function generateEmbeddingsBatched(
  texts: string[],
  options: EmbeddingOptions
): Promise<Float32Array[]> {
  const batches = chunk(texts, OPTIMIZATION_CONFIG.batching.embeddingBatchSize);
  const results: Float32Array[] = [];

  // Process batches with controlled concurrency
  const batchPromises = batches.map((batch, index) =>
    limit(() =>
      processEmbeddingBatch(batch, options)
        .then(embeddings => {
          results[index] = embeddings;
        })
    )
  );

  await Promise.all(batchPromises);

  return results.flat();
}

/**
 * Cached Actor Profile Retrieval
 */
const getActorProfile = memoize(
  async (actorId: string): Promise<ActorProfile> => {
    return await db.select()
      .from(workspaceActorProfiles)
      .where(eq(workspaceActorProfiles.actorId, actorId))
      .limit(1);
  },
  {
    ttl: OPTIMIZATION_CONFIG.caching.actorProfileTTL,
    key: (actorId) => `actor_profile_${actorId}`
  }
);

/**
 * Circuit Breaker for External Services
 */
const webSearchWithCircuitBreaker = withCircuitBreaker(
  searchForExternalContext,
  {
    failureThreshold: 3,
    resetTimeout: 60000,
    fallback: async () => ({
      relevanceScore: 0,
      externalSources: []
    })
  }
);
```

---

## Performance Characteristics

| Component | Latency | Throughput | Bottleneck |
|-----------|---------|------------|------------|
| Significance Evaluation | 50-200ms | High | LLM calls |
| Context Enrichment | 200-500ms | Medium | External API calls |
| Document/Chunk Linking | 100-300ms | High | Vector search |
| Multi-View Embeddings | 300-600ms | Medium | Embedding API |
| Classification | 100-300ms | High | LLM/ML model |
| Quality Validation | 50-150ms | High | Rule evaluation |
| Storage | 50-100ms | High | Database transaction |

## Key Metrics to Track

1. **Observation Quality**
   - Average quality score
   - Percentage requiring review
   - Enhancement success rate

2. **Processing Performance**
   - End-to-end latency
   - Component-level latency
   - Throughput (observations/minute)

3. **Retrieval Effectiveness**
   - Average documents linked
   - Average chunks linked
   - Relevance scores

4. **Classification Accuracy**
   - Type distribution
   - Confidence distribution
   - Manual correction rate

5. **System Health**
   - Error rates by component
   - Circuit breaker trips
   - Cache hit rates

---

## Conclusion

This deep implementation of observation capture provides:

1. **Comprehensive Analysis** - Multi-factor significance scoring with external context
2. **Rich Context** - Deep enrichment from multiple sources with cross-referencing
3. **Intelligent Retrieval** - Multi-stage, multi-strategy document and chunk discovery
4. **Specialized Embeddings** - Seven different embedding views for various use cases
5. **Accurate Classification** - Ensemble approach with detailed characteristic extraction
6. **Quality Assurance** - Automated validation and enhancement pipeline
7. **Performance Optimization** - Batching, caching, and circuit breakers for reliability

The system ensures that only high-quality, meaningful observations are captured while maintaining high performance and reliability at scale.