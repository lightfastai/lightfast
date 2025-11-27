# Neural Memory Step Runs Design

Last Updated: 2025-11-27

## Overview

This document details the Inngest step run design for each neural memory event type, following the established patterns of blocking steps (`step.invoke()`), parallel processing (`step.sendEvent()`), and aggregation (`step.waitForEvent()`).

---

## 1. Observation Capture Pipeline

### Event: `observation.capture`

Triggered by significant moments in source data (PR merged, deployment completed, incident detected).

```typescript
// inngest/workflow/neural/observation-capture.ts
export const observationCapture = inngest.createFunction(
  {
    id: "neural.observation.capture",
    concurrency: {
      limit: 20,
      key: "event.data.workspaceId"
    }
  },
  { event: "neural/observation.capture" },
  async ({ event, step }) => {
    const { sourceType, sourceId, workspaceId, rawEvent } = event.data;

    // Step 1: Validate & Enrich Context (BLOCKING)
    const context = await step.run("validate-and-enrich", async () => {
      // Check if this is truly significant
      const significance = await evaluateSignificance(rawEvent);
      if (significance.score < SIGNIFICANCE_THRESHOLD) {
        return { skip: true, reason: "Below significance threshold" };
      }

      // Fetch additional context if needed
      const enriched = await enrichContext(sourceType, sourceId);
      return {
        skip: false,
        actor: enriched.actor,
        relatedEntities: enriched.entities,
        sourceReferences: enriched.references
      };
    });

    if (context.skip) {
      return { skipped: true, reason: context.reason };
    }

    // Step 2: Extract Observation (BLOCKING)
    const observation = await step.run("extract-observation", async () => {
      return {
        id: generateObservationId(),
        occurredAt: rawEvent.timestamp,
        type: classifyObservationType(rawEvent), // decision|highlight|change|incident
        title: generateTitle(rawEvent),
        content: extractContent(rawEvent),
        actor: context.actor,
        confidence: calculateConfidence(rawEvent)
      };
    });

    // Step 3: Link to Source Documents (PARALLEL)
    const [docLinks, chunkLinks] = await Promise.all([
      step.run("link-to-documents", async () => {
        // Find related documents in knowledge layer
        const docs = await findRelatedDocuments(
          workspaceId,
          observation.sourceReferences
        );
        return docs.map(d => ({
          documentId: d.id,
          relevance: d.score,
          relationshipType: "source"
        }));
      }),

      step.run("link-to-chunks", async () => {
        // Find specific chunks that relate
        const chunks = await findRelatedChunks(
          workspaceId,
          observation.content
        );
        return chunks.slice(0, 5); // Top 5 most relevant
      })
    ]);

    // Step 4: Generate Multi-View Embeddings (PARALLEL)
    const embeddings = await step.run("generate-embeddings", async () => {
      const [titleEmb, contentEmb, summaryEmb] = await Promise.all([
        // Title embedding - high-level matching
        generateEmbedding(observation.title, "title"),

        // Content embedding - detailed similarity
        generateEmbedding(observation.content, "content"),

        // Summary embedding - conceptual alignment
        generateEmbedding(
          `${observation.title}. ${summarize(observation.content)}`,
          "summary"
        )
      ]);

      return {
        titleEmbeddingId: await storeEmbedding(titleEmb, "neural_title"),
        contentEmbeddingId: await storeEmbedding(contentEmb, "neural_content"),
        summaryEmbeddingId: await storeEmbedding(summaryEmb, "neural_summary")
      };
    });

    // Step 5: Store Observation (BLOCKING)
    const stored = await step.run("store-observation", async () => {
      return await db.transaction(async (tx) => {
        // Store main observation
        const [obs] = await tx.insert(workspaceNeuralObservations).values({
          ...observation,
          workspaceId,
          storeId: event.data.storeId,
          ...embeddings,
          sourceReferences: docLinks,
          relatedChunks: chunkLinks
        }).returning();

        // Update observation count for workspace
        await tx.update(workspaceStores)
          .set({
            observationCount: sql`observation_count + 1`,
            lastObservationAt: new Date()
          })
          .where(eq(workspaceStores.id, event.data.storeId));

        return obs;
      });
    });

    // Step 6: Trigger Downstream Events (NON-BLOCKING)
    await step.sendEvent("trigger-downstream", [
      {
        name: "neural/profile.check",
        data: {
          actorId: observation.actor.id,
          actorType: observation.actor.type,
          observationId: stored.id,
          workspaceId
        }
      },
      {
        name: "neural/summary.check",
        data: {
          observationId: stored.id,
          topics: extractTopics(observation),
          entities: context.relatedEntities,
          workspaceId
        }
      }
    ]);

    return {
      success: true,
      observationId: stored.id,
      embeddingIds: embeddings,
      linkedDocuments: docLinks.length,
      linkedChunks: chunkLinks.length
    };
  }
);
```

---

## 2. Summary Generation Pipeline

### Event: `summary.generate`

Triggered periodically or when observation threshold is reached.

```typescript
// inngest/workflow/neural/summary-generate.ts
export const summaryGenerate = inngest.createFunction(
  {
    id: "neural.summary.generate",
    concurrency: {
      limit: 5,
      key: "event.data.workspaceId"
    }
  },
  { event: "neural/summary.generate" },
  async ({ event, step }) => {
    const { workspaceId, summaryType, scope, period } = event.data;

    // Step 1: Gather Observations (BLOCKING)
    const observations = await step.run("gather-observations", async () => {
      switch (summaryType) {
        case "temporal":
          return await getObservationsByTimeRange(
            workspaceId,
            period.start,
            period.end
          );

        case "topic":
          return await getObservationsByTopic(
            workspaceId,
            scope.topic,
            period
          );

        case "entity":
          return await getObservationsByEntity(
            workspaceId,
            scope.entityId,
            period
          );

        case "project":
          return await getObservationsByProject(
            workspaceId,
            scope.projectId,
            period
          );
      }
    });

    if (observations.length < MIN_OBSERVATIONS_FOR_SUMMARY) {
      return { skipped: true, reason: "Insufficient observations" };
    }

    // Step 2: Cluster Observations (BLOCKING)
    const clusters = await step.run("cluster-observations", async () => {
      // Group related observations
      const clustered = await clusterByEmbedding(observations, {
        method: "kmeans",
        maxClusters: Math.min(5, Math.floor(observations.length / 3))
      });

      return clustered.map(cluster => ({
        id: cluster.id,
        observations: cluster.items,
        centroid: cluster.centroid,
        coherence: cluster.coherenceScore
      }));
    });

    // Step 3: Generate Summaries per Cluster (PARALLEL)
    const clusterSummaries = await step.run("generate-cluster-summaries", async () => {
      return await Promise.all(
        clusters.map(async (cluster) => {
          const summary = await generateSummaryWithLLM({
            observations: cluster.observations,
            summaryType,
            scope,
            instructions: getSummaryInstructions(summaryType)
          });

          return {
            clusterId: cluster.id,
            summary: summary.text,
            keyPoints: summary.keyPoints,
            primaryEntities: summary.entities,
            sentiment: summary.sentiment
          };
        })
      );
    });

    // Step 4: Synthesize Master Summary (BLOCKING)
    const masterSummary = await step.run("synthesize-master-summary", async () => {
      const synthesis = await synthesizeSummaries({
        clusterSummaries,
        summaryType,
        totalObservations: observations.length,
        period
      });

      return {
        title: synthesis.title,
        summary: synthesis.summary,
        keyPoints: synthesis.keyPoints.slice(0, 10), // Top 10 key points
        topics: synthesis.topics,
        primaryEntities: synthesis.entities.slice(0, 5) // Top 5 entities
      };
    });

    // Step 5: Generate Summary Embedding (BLOCKING)
    const embedding = await step.run("generate-summary-embedding", async () => {
      const embVector = await generateEmbedding(
        `${masterSummary.title}. ${masterSummary.summary}`,
        "summary"
      );

      return await storeEmbedding(embVector, "neural_summary");
    });

    // Step 6: Store Summary (BLOCKING)
    const stored = await step.run("store-summary", async () => {
      return await db.insert(workspaceNeuralSummaries).values({
        id: generateSummaryId(),
        workspaceId,
        storeId: event.data.storeId,
        summaryType,
        summaryScope: scope,
        periodStart: period.start,
        periodEnd: period.end,
        ...masterSummary,
        observationIds: observations.map(o => o.id),
        observationCount: observations.length,
        embeddingId: embedding,
        generationMethod: "llm_synthesis",
        confidenceScore: calculateSummaryConfidence(clusterSummaries)
      }).returning();
    });

    // Step 7: Mark Observations as Summarized (NON-BLOCKING)
    await step.run("mark-observations-summarized", async () => {
      await db.update(workspaceNeuralObservations)
        .set({
          summarizedAt: new Date(),
          summaryIds: sql`array_append(summary_ids, ${stored[0].id})`
        })
        .where(
          and(
            eq(workspaceNeuralObservations.workspaceId, workspaceId),
            inArray(workspaceNeuralObservations.id, observations.map(o => o.id))
          )
        );
    });

    return {
      success: true,
      summaryId: stored[0].id,
      observationsCovered: observations.length,
      clusters: clusters.length,
      keyPoints: masterSummary.keyPoints.length
    };
  }
);
```

---

## 3. Profile Update Pipeline

### Event: `profile.update`

Updates actor/entity profiles based on new observations.

```typescript
// inngest/workflow/neural/profile-update.ts
export const profileUpdate = inngest.createFunction(
  {
    id: "neural.profile.update",
    concurrency: {
      limit: 10,
      key: "event.data.actorId"  // One update per actor at a time
    }
  },
  { event: "neural/profile.update" },
  async ({ event, step }) => {
    const { actorId, actorType, workspaceId } = event.data;

    // Step 1: Load Existing Profile (BLOCKING)
    const existingProfile = await step.run("load-existing-profile", async () => {
      const profile = await db.select()
        .from(workspaceActorProfiles)
        .where(
          and(
            eq(workspaceActorProfiles.workspaceId, workspaceId),
            eq(workspaceActorProfiles.actorId, actorId)
          )
        )
        .limit(1);

      return profile[0] || null;
    });

    // Step 2: Gather Recent Activity (PARALLEL)
    const [observations, interactions, contributions] = await Promise.all([
      step.run("gather-recent-observations", async () => {
        return await getRecentObservations(workspaceId, actorId, {
          limit: 100,
          since: existingProfile?.updatedAt || subDays(new Date(), 30)
        });
      }),

      step.run("gather-interactions", async () => {
        return await getActorInteractions(workspaceId, actorId, {
          types: ["collaborated", "reviewed", "mentioned"],
          limit: 50
        });
      }),

      step.run("gather-contributions", async () => {
        return await getActorContributions(workspaceId, actorId, {
          types: ["code", "documentation", "review", "decision"],
          limit: 50
        });
      })
    ]);

    // Step 3: Extract Features (BLOCKING)
    const features = await step.run("extract-features", async () => {
      // Expertise vectors from topics
      const expertiseVectors = await extractExpertise(observations, contributions);

      // Activity patterns
      const activityPatterns = extractActivityPatterns(observations);

      // Contribution distribution
      const contributionTypes = calculateContributionDistribution(contributions);

      // Collaboration network
      const collaborators = extractFrequentCollaborators(interactions);

      return {
        expertise: expertiseVectors,
        interests: extractInterests(observations),
        skills: extractSkills(contributions),
        activeHours: activityPatterns.hourlyDistribution,
        activeDays: activityPatterns.dailyDistribution,
        contributionTypes,
        frequentCollaborators: collaborators.slice(0, 10),
        interactionFrequency: calculateInteractionFrequency(interactions)
      };
    });

    // Step 4: Compute Profile Embeddings (PARALLEL)
    const embeddings = await step.run("compute-profile-embeddings", async () => {
      const [expertiseEmb, interestsEmb] = await Promise.all([
        // Expertise centroid for skill matching
        generateEmbedding(
          Object.entries(features.expertise)
            .map(([topic, score]) => `${topic}:${score}`)
            .join(" "),
          "profile_expertise"
        ),

        // Interests embedding for discovery
        generateEmbedding(
          features.interests.join(" "),
          "profile_interests"
        )
      ]);

      return {
        expertiseEmbeddingId: await storeEmbedding(expertiseEmb, "neural_profile"),
        interestsEmbeddingId: await storeEmbedding(interestsEmb, "neural_profile")
      };
    });

    // Step 5: Calculate Profile Confidence (BLOCKING)
    const confidence = await step.run("calculate-confidence", async () => {
      return calculateProfileConfidence({
        observationCount: observations.length,
        timeSpan: existingProfile
          ? daysBetween(existingProfile.createdAt, new Date())
          : 0,
        featureCompleteness: calculateFeatureCompleteness(features),
        activityRecency: calculateRecency(observations[0]?.occurredAt)
      });
    });

    // Step 6: Upsert Profile (BLOCKING)
    const profile = await step.run("upsert-profile", async () => {
      const profileData = {
        workspaceId,
        profileType: actorType,
        actorId,
        actorName: event.data.actorName || existingProfile?.actorName,
        ...features,
        ...embeddings,
        observationCount: (existingProfile?.observationCount || 0) + observations.length,
        lastActiveAt: observations[0]?.occurredAt || existingProfile?.lastActiveAt,
        profileConfidence: confidence,
        updatedAt: new Date()
      };

      if (existingProfile) {
        // Merge with existing, preserving history
        return await db.update(workspaceActorProfiles)
          .set({
            ...profileData,
            // Merge expertise vectors with decay
            expertiseVectors: mergeExpertise(
              existingProfile.expertiseVectors,
              features.expertise,
              0.8 // decay factor for old expertise
            )
          })
          .where(eq(workspaceActorProfiles.id, existingProfile.id))
          .returning();
      } else {
        // Create new profile
        return await db.insert(workspaceActorProfiles)
          .values({
            id: generateProfileId(),
            ...profileData,
            createdAt: new Date()
          })
          .returning();
      }
    });

    // Step 7: Trigger Related Updates (NON-BLOCKING)
    if (features.frequentCollaborators.length > 0) {
      await step.sendEvent("trigger-collaborator-updates",
        features.frequentCollaborators.slice(0, 3).map(collaboratorId => ({
          name: "neural/profile.refresh",
          data: {
            actorId: collaboratorId,
            actorType: "user",
            workspaceId,
            reason: "collaborator_update"
          }
        }))
      );
    }

    return {
      success: true,
      profileId: profile[0].id,
      isNew: !existingProfile,
      expertiseTopics: Object.keys(features.expertise).length,
      collaborators: features.frequentCollaborators.length,
      confidence
    };
  }
);
```

---

## 4. Temporal State Transition Pipeline

### Event: `state.transition`

Tracks how entities evolve over time.

```typescript
// inngest/workflow/neural/state-transition.ts
export const stateTransition = inngest.createFunction(
  {
    id: "neural.state.transition",
    concurrency: {
      limit: 20,
      key: "event.data.entityId"
    }
  },
  { event: "neural/state.transition" },
  async ({ event, step }) => {
    const {
      entityType,
      entityId,
      newState,
      stateType,
      reason,
      observationId,
      workspaceId
    } = event.data;

    // Step 1: Validate State Transition (BLOCKING)
    const validation = await step.run("validate-transition", async () => {
      // Get current state
      const currentState = await getCurrentState(workspaceId, entityId, stateType);

      // Check if transition is valid
      const isValid = validateStateTransition(
        stateType,
        currentState?.stateValue,
        newState
      );

      if (!isValid) {
        return {
          valid: false,
          reason: `Invalid transition from ${currentState?.stateValue} to ${newState}`
        };
      }

      // Check for duplicate transitions
      if (currentState?.stateValue === newState) {
        return {
          valid: false,
          reason: "State unchanged",
          isDuplicate: true
        };
      }

      return {
        valid: true,
        currentState,
        requiresArchive: !!currentState
      };
    });

    if (!validation.valid) {
      return {
        skipped: true,
        reason: validation.reason,
        isDuplicate: validation.isDuplicate
      };
    }

    // Step 2: Archive Current State (CONDITIONAL BLOCKING)
    if (validation.requiresArchive) {
      await step.run("archive-current-state", async () => {
        await db.update(workspaceTemporalStates)
          .set({
            validTo: new Date(),
            isCurrent: false,
            archivedAt: new Date()
          })
          .where(
            and(
              eq(workspaceTemporalStates.id, validation.currentState.id),
              eq(workspaceTemporalStates.isCurrent, true)
            )
          );
      });
    }

    // Step 3: Extract Metadata (BLOCKING)
    const metadata = await step.run("extract-metadata", async () => {
      // Get related observation details
      const observation = observationId
        ? await getObservation(observationId)
        : null;

      // Calculate state metadata based on type
      switch (stateType) {
        case "progress":
          return {
            percentComplete: parseProgress(newState),
            milestone: detectMilestone(newState),
            velocity: calculateVelocity(validation.currentState, newState)
          };

        case "health":
          return {
            healthScore: parseHealthScore(newState),
            trend: calculateTrend(validation.currentState, newState),
            alerts: detectHealthAlerts(newState)
          };

        case "status":
          return {
            isActive: isActiveStatus(newState),
            isBlocked: isBlockedStatus(newState),
            priority: extractPriority(newState)
          };

        case "risk":
          return {
            riskLevel: parseRiskLevel(newState),
            factors: extractRiskFactors(observation),
            mitigations: suggestMitigations(newState)
          };

        default:
          return {};
      }
    });

    // Step 4: Store New State (BLOCKING)
    const storedState = await step.run("store-new-state", async () => {
      return await db.insert(workspaceTemporalStates).values({
        id: generateStateId(),
        workspaceId,
        entityType,
        entityId,
        entityName: event.data.entityName,
        stateType,
        stateValue: newState,
        stateMetadata: metadata,
        validFrom: new Date(),
        validTo: null,
        isCurrent: true,
        changedByActorId: event.data.actorId,
        changeReason: reason,
        relatedObservationId: observationId,
        createdAt: new Date()
      }).returning();
    });

    // Step 5: Update Entity Metadata (NON-BLOCKING)
    await step.run("update-entity-metadata", async () => {
      // Update the entity's current state reference
      await updateEntityCurrentState(
        workspaceId,
        entityType,
        entityId,
        stateType,
        newState
      );
    });

    // Step 6: Trigger Dependent Updates (CONDITIONAL NON-BLOCKING)
    const dependentEvents = await step.run("trigger-dependent-updates", async () => {
      const events = [];

      // If project reaches 100%, trigger completion summary
      if (stateType === "progress" && metadata.percentComplete === 100) {
        events.push({
          name: "neural/summary.generate",
          data: {
            workspaceId,
            summaryType: "project",
            scope: { projectId: entityId },
            period: {
              start: validation.currentState?.validFrom,
              end: new Date()
            },
            trigger: "project_completion"
          }
        });
      }

      // If health degrades, trigger alert
      if (stateType === "health" && metadata.trend === "degrading") {
        events.push({
          name: "alert/health.degraded",
          data: {
            workspaceId,
            entityType,
            entityId,
            currentHealth: newState,
            previousHealth: validation.currentState?.stateValue
          }
        });
      }

      // If risk increases, trigger analysis
      if (stateType === "risk" && metadata.riskLevel > 0.7) {
        events.push({
          name: "neural/risk.analyze",
          data: {
            workspaceId,
            entityType,
            entityId,
            riskLevel: metadata.riskLevel,
            factors: metadata.factors
          }
        });
      }

      if (events.length > 0) {
        await step.sendEvent("dependent-events", events);
      }

      return events.length;
    });

    return {
      success: true,
      stateId: storedState[0].id,
      previousState: validation.currentState?.stateValue,
      newState,
      metadata,
      dependentEventsTriggered: dependentEvents
    };
  }
);
```

---

## 5. Memory Consolidation Pipeline

### Event: `memory.consolidate`

Optimizes and consolidates memory for better retrieval.

```typescript
// inngest/workflow/neural/memory-consolidate.ts
export const memoryConsolidate = inngest.createFunction(
  {
    id: "neural.memory.consolidate",
    concurrency: {
      limit: 1,  // Only one consolidation per workspace at a time
      key: "event.data.workspaceId"
    }
  },
  { event: "neural/memory.consolidate", cron: "0 3 * * *" }, // Daily at 3 AM
  async ({ event, step }) => {
    const { workspaceId } = event.data;

    // Step 1: Analyze Memory Health (BLOCKING)
    const analysis = await step.run("analyze-memory-health", async () => {
      const [obsStats, sumStats, profStats] = await Promise.all([
        getObservationStats(workspaceId),
        getSummaryStats(workspaceId),
        getProfileStats(workspaceId)
      ]);

      return {
        observations: {
          total: obsStats.total,
          unsummarized: obsStats.unsummarized,
          orphaned: obsStats.orphaned,
          lowConfidence: obsStats.lowConfidence
        },
        summaries: {
          total: sumStats.total,
          stale: sumStats.stale,
          overlapping: sumStats.overlapping
        },
        profiles: {
          total: profStats.total,
          inactive: profStats.inactive,
          lowConfidence: profStats.lowConfidence
        },
        shouldConsolidate: (
          obsStats.unsummarized > 100 ||
          sumStats.overlapping > 10 ||
          profStats.inactive > 20
        )
      };
    });

    if (!analysis.shouldConsolidate) {
      return { skipped: true, reason: "No consolidation needed", stats: analysis };
    }

    // Step 2: Consolidate Observations (PARALLEL BATCHES)
    const obsConsolidation = await step.run("consolidate-observations", async () => {
      const results = {
        summarized: 0,
        archived: 0,
        merged: 0
      };

      // Batch 1: Summarize unsummarized observations
      if (analysis.observations.unsummarized > MIN_OBSERVATIONS_FOR_SUMMARY) {
        const batchSize = 100;
        const batches = Math.ceil(analysis.observations.unsummarized / batchSize);

        for (let i = 0; i < batches; i++) {
          await step.sendEvent(`summarize-batch-${i}`, {
            name: "neural/summary.generate",
            data: {
              workspaceId,
              summaryType: "temporal",
              scope: "unsummarized",
              period: {
                start: subDays(new Date(), 7),
                end: new Date()
              },
              batchOffset: i * batchSize,
              batchLimit: batchSize
            }
          });
          results.summarized += batchSize;
        }
      }

      // Batch 2: Archive old low-confidence observations
      const archived = await archiveOldObservations(workspaceId, {
        olderThan: subDays(new Date(), 90),
        confidenceBelow: 0.3
      });
      results.archived = archived.count;

      // Batch 3: Merge duplicate observations
      const merged = await mergeDuplicateObservations(workspaceId);
      results.merged = merged.count;

      return results;
    });

    // Step 3: Consolidate Summaries (BLOCKING)
    const sumConsolidation = await step.run("consolidate-summaries", async () => {
      // Find overlapping summaries
      const overlapping = await findOverlappingSummaries(workspaceId);

      const results = {
        merged: 0,
        regenerated: 0,
        deleted: 0
      };

      for (const group of overlapping) {
        if (group.summaries.length > 1) {
          // Merge overlapping summaries into one
          const merged = await mergeSummaries(group.summaries);

          // Delete old summaries
          await db.delete(workspaceNeuralSummaries)
            .where(
              inArray(
                workspaceNeuralSummaries.id,
                group.summaries.map(s => s.id)
              )
            );

          // Insert merged summary
          await db.insert(workspaceNeuralSummaries).values(merged);

          results.merged++;
        }
      }

      // Regenerate stale summaries
      const stale = await findStaleSummaries(workspaceId, {
        olderThan: subDays(new Date(), 30)
      });

      for (const summary of stale) {
        await step.sendEvent(`regenerate-summary-${summary.id}`, {
          name: "neural/summary.generate",
          data: {
            workspaceId,
            summaryType: summary.summaryType,
            scope: summary.summaryScope,
            period: {
              start: summary.periodStart,
              end: new Date()
            },
            replaceSummaryId: summary.id
          }
        });
        results.regenerated++;
      }

      return results;
    });

    // Step 4: Update Profiles (PARALLEL)
    const profConsolidation = await step.run("update-profiles", async () => {
      const results = {
        refreshed: 0,
        archived: 0,
        merged: 0
      };

      // Refresh active profiles
      const activeProfiles = await getActiveProfiles(workspaceId, {
        activeSince: subDays(new Date(), 30)
      });

      const refreshBatches = chunk(activeProfiles, 10);
      for (const batch of refreshBatches) {
        await step.sendEvent(`refresh-profiles-batch`,
          batch.map(profile => ({
            name: "neural/profile.update",
            data: {
              actorId: profile.actorId,
              actorType: profile.profileType,
              workspaceId,
              reason: "consolidation"
            }
          }))
        );
        results.refreshed += batch.length;
      }

      // Archive inactive profiles
      const archived = await archiveInactiveProfiles(workspaceId, {
        inactiveSince: subDays(new Date(), 180)
      });
      results.archived = archived.count;

      // Merge duplicate profiles
      const merged = await mergeDuplicateProfiles(workspaceId);
      results.merged = merged.count;

      return results;
    });

    // Step 5: Optimize Embeddings (BLOCKING)
    const embeddingOptimization = await step.run("optimize-embeddings", async () => {
      // Re-index embeddings for better clustering
      const reindexed = await reindexEmbeddings(workspaceId, {
        namespace: `workspace_${workspaceId}_neural`,
        strategy: "clustering_optimization"
      });

      // Remove orphaned embeddings
      const cleaned = await cleanOrphanedEmbeddings(workspaceId);

      return {
        reindexed: reindexed.count,
        cleaned: cleaned.count
      };
    });

    // Step 6: Update Consolidation Metrics (BLOCKING)
    const metrics = await step.run("update-metrics", async () => {
      return await db.insert(workspaceConsolidationMetrics).values({
        id: generateMetricId(),
        workspaceId,
        consolidatedAt: new Date(),
        observations: obsConsolidation,
        summaries: sumConsolidation,
        profiles: profConsolidation,
        embeddings: embeddingOptimization,
        memoryHealthBefore: analysis,
        memoryHealthAfter: await getMemoryHealth(workspaceId)
      }).returning();
    });

    return {
      success: true,
      consolidationId: metrics[0].id,
      observations: obsConsolidation,
      summaries: sumConsolidation,
      profiles: profConsolidation,
      embeddings: embeddingOptimization,
      healthImprovement: calculateHealthImprovement(
        analysis,
        metrics[0].memoryHealthAfter
      )
    };
  }
);
```

---

## Common Patterns Across All Neural Memory Events

### 1. **Blocking Steps for Critical Operations**
- Store creation/validation
- Data integrity checks
- Transaction operations

### 2. **Parallel Processing for Independent Work**
- Multi-view embedding generation
- Batch processing of observations
- Concurrent profile updates

### 3. **Event Cascading for Workflow Chains**
- Observation → Profile update
- Observation → Summary check
- State transition → Dependent alerts

### 4. **Batch Processing for Scale**
- Process observations in groups of 50-100
- Parallel embedding generation
- Chunked profile updates

### 5. **Quality Gates**
- Significance thresholds for observations
- Minimum counts for summary generation
- Confidence scoring at each stage

### 6. **Optimization Strategies**
- Incremental updates (merge with decay)
- Lazy consolidation (only when needed)
- Background optimization (off-peak hours)

## Performance Characteristics

| Pipeline | Typical Latency | Parallelism | Bottleneck |
|----------|----------------|-------------|------------|
| Observation Capture | 200-500ms | High (20 concurrent) | Embedding generation |
| Summary Generation | 5-10s | Medium (5 concurrent) | LLM synthesis |
| Profile Update | 1-2s | Medium (10 concurrent) | Feature extraction |
| State Transition | 100-300ms | High (20 concurrent) | Validation |
| Memory Consolidation | 5-10 min | Low (1 per workspace) | Batch processing |

## Error Handling & Retries

Each pipeline includes:
- **Automatic retries**: 3 attempts with exponential backoff
- **Partial failure handling**: Continue with degraded functionality
- **Dead letter queues**: For observations that can't be processed
- **Monitoring alerts**: For systemic failures

## Monitoring & Metrics

Key metrics tracked:
- **Observation capture rate**: Events/second
- **Summary coverage**: % of observations summarized
- **Profile freshness**: Average age of profiles
- **State consistency**: Validation failures
- **Consolidation efficiency**: Memory saved vs time spent