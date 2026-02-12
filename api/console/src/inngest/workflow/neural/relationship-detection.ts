/**
 * Relationship Detection
 *
 * Detects and creates relationships between observations based on:
 * 1. Explicit references (PR body contains "Fixes #123")
 * 2. Commit SHA matching (GitHub push → Vercel deployment)
 * 3. Branch name matching (Linear issue → GitHub PR)
 * 4. Issue ID co-occurrence (same issue mentioned in multiple observations)
 */

import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import type {
  InsertWorkspaceObservationRelationship,
  RelationshipType,
} from "@db/console/schema";
import type { SourceReference, SourceEvent } from "@repo/console-types";
import { log } from "@vendor/observability/log";
import { nanoid } from "nanoid";
import { eq, and, or, sql } from "drizzle-orm";

/**
 * Detected relationship before database insertion
 */
interface DetectedRelationship {
  targetObservationId: number;
  relationshipType: RelationshipType;
  linkingKey: string;
  linkingKeyType: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

/**
 * Detect relationships for a new observation
 *
 * @param workspaceId - Workspace ID
 * @param observationId - Internal ID of the new observation
 * @param sourceEvent - The source event that created this observation
 * @returns Number of relationships created
 */
export async function detectAndCreateRelationships(
  workspaceId: string,
  observationId: number,
  sourceEvent: SourceEvent
): Promise<number> {
  const references = sourceEvent.references;
  if (references.length === 0) return 0;

  const detectedRelationships: DetectedRelationship[] = [];

  // Extract linking keys from references
  const commitShas = references
    .filter((r) => r.type === "commit")
    .map((r) => r.id);
  const branchNames = references
    .filter((r) => r.type === "branch")
    .map((r) => r.id);
  const issueIds = references
    .filter((r) => r.type === "issue")
    .map((r) => r.id);
  const prIds = references
    .filter((r) => r.type === "pr")
    .map((r) => r.id);

  // 1. Find observations with matching commit SHAs
  if (commitShas.length > 0) {
    const commitMatches = await findObservationsByReference(
      workspaceId,
      observationId,
      "commit",
      commitShas
    );

    for (const match of commitMatches) {
      // Find the original commit reference that linked to this match
      const commitRef = references.find(
        (r) => r.type === "commit" && r.id === match.linkingKey
      );

      // Determine relationship type based on sources and labels
      const relType = determineCommitRelationType(
        sourceEvent.source,
        match.source,
        commitRef
      );

      // Explicit resolution gets "explicit" detection method
      const detectionMethod = commitRef?.label === "resolved_by" ? "explicit" : "commit_match";

      detectedRelationships.push({
        targetObservationId: match.id,
        relationshipType: relType,
        linkingKey: match.linkingKey,
        linkingKeyType: "commit",
        confidence: 1.0,
        metadata: { detectionMethod },
      });
    }
  }

  // 2. Find observations with matching branch names
  if (branchNames.length > 0) {
    const branchMatches = await findObservationsByReference(
      workspaceId,
      observationId,
      "branch",
      branchNames
    );

    for (const match of branchMatches) {
      detectedRelationships.push({
        targetObservationId: match.id,
        relationshipType: "same_branch",
        linkingKey: match.linkingKey,
        linkingKeyType: "branch",
        confidence: 0.9,
        metadata: { detectionMethod: "branch_match" },
      });
    }
  }

  // 3. Find observations with matching issue IDs (explicit "fixes" relationships)
  if (issueIds.length > 0) {
    // Check if this is a PR with explicit "fixes" labels
    const fixesIssues = references
      .filter(
        (r) =>
          r.type === "issue" &&
          r.label &&
          ["fixes", "closes", "resolves"].includes(r.label.toLowerCase())
      )
      .map((r) => r.id);

    if (fixesIssues.length > 0) {
      const issueMatches = await findObservationsByIssueId(
        workspaceId,
        observationId,
        fixesIssues
      );

      for (const match of issueMatches) {
        detectedRelationships.push({
          targetObservationId: match.id,
          relationshipType: "fixes",
          linkingKey: match.linkingKey,
          linkingKeyType: "issue",
          confidence: 1.0,
          metadata: { detectionMethod: "explicit" },
        });
      }
    }

    // Also create generic reference relationships for other issue mentions
    const otherIssues = issueIds.filter((id) => !fixesIssues.includes(id));
    if (otherIssues.length > 0) {
      const issueMatches = await findObservationsByIssueId(
        workspaceId,
        observationId,
        otherIssues
      );

      for (const match of issueMatches) {
        detectedRelationships.push({
          targetObservationId: match.id,
          relationshipType: "references",
          linkingKey: match.linkingKey,
          linkingKeyType: "issue",
          confidence: 0.8,
          metadata: { detectionMethod: "entity_cooccurrence" },
        });
      }
    }
  }

  // 4. Find observations with matching PR numbers (Linear → GitHub PR via attachments)
  if (prIds.length > 0) {
    const prMatches = await findObservationsByPrId(
      workspaceId,
      observationId,
      prIds
    );

    for (const match of prMatches) {
      // Linear issue linking to a GitHub PR is "tracked_in"
      detectedRelationships.push({
        targetObservationId: match.id,
        relationshipType: "tracked_in",
        linkingKey: match.linkingKey,
        linkingKeyType: "pr",
        confidence: 1.0,
        metadata: { detectionMethod: "pr_match" },
      });
    }
  }

  // 5. Detect "triggers" relationships (Sentry → Linear via attachments)
  // When a Linear issue has a Sentry attachment, it means the Sentry issue triggered the Linear work
  const linkedSentryIssues = references
    .filter(
      (r) =>
        r.type === "issue" &&
        r.label === "linked" &&
        sourceEvent.source === "linear"
    )
    .map((r) => r.id);

  if (linkedSentryIssues.length > 0) {
    // Find Sentry observations matching these issue IDs
    const sentryMatches = await findObservationsByReference(
      workspaceId,
      observationId,
      "issue",
      linkedSentryIssues
    );

    // Also check by title/sourceId for Sentry observations
    const sentryTitleMatches = await findObservationsByIssueId(
      workspaceId,
      observationId,
      linkedSentryIssues
    );

    // Combine and deduplicate
    const allSentryMatches = new Map<number, { id: number; linkingKey: string }>();
    for (const m of [...sentryMatches, ...sentryTitleMatches]) {
      if (!allSentryMatches.has(m.id)) {
        allSentryMatches.set(m.id, { id: m.id, linkingKey: m.linkingKey });
      }
    }

    for (const match of allSentryMatches.values()) {
      detectedRelationships.push({
        targetObservationId: match.id,
        relationshipType: "triggers",
        linkingKey: match.linkingKey,
        linkingKeyType: "issue",
        confidence: 0.8,
        metadata: { detectionMethod: "explicit" },
      });
    }
  }

  // Deduplicate relationships (prefer higher confidence for same target)
  const deduped = deduplicateRelationships(detectedRelationships);

  // Insert relationships
  if (deduped.length === 0) return 0;

  const inserts: InsertWorkspaceObservationRelationship[] = deduped.map(
    (rel) => ({
      externalId: nanoid(),
      workspaceId,
      sourceObservationId: observationId,
      targetObservationId: rel.targetObservationId,
      relationshipType: rel.relationshipType,
      linkingKey: rel.linkingKey,
      linkingKeyType: rel.linkingKeyType,
      confidence: rel.confidence,
      metadata: rel.metadata,
    })
  );

  try {
    await db
      .insert(workspaceObservationRelationships)
      .values(inserts)
      .onConflictDoNothing(); // Ignore duplicates

    log.info("Created observation relationships", {
      workspaceId,
      observationId: observationId.toString(),
      count: inserts.length,
      types: [...new Set(inserts.map((i) => i.relationshipType))],
    });

    return inserts.length;
  } catch (error) {
    log.error("Failed to create relationships", { error, workspaceId });
    return 0;
  }
}

/**
 * Find observations with matching reference type and IDs
 */
async function findObservationsByReference(
  workspaceId: string,
  excludeId: number,
  refType: string,
  refIds: string[]
): Promise<{ id: number; source: string; linkingKey: string }[]> {
  if (refIds.length === 0) return [];

  // Build JSONB containment conditions for each ref ID
  const conditions = refIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: refType, id }])}::jsonb`
  );

  const results = await db
    .select({
      id: workspaceNeuralObservations.id,
      source: workspaceNeuralObservations.source,
      sourceReferences: workspaceNeuralObservations.sourceReferences,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.id} != ${excludeId}`,
        or(...conditions)
      )
    )
    .limit(50);

  // Extract matching linking keys
  return results.map((r) => {
    const refs = (r.sourceReferences ?? []) as SourceReference[];
    const matchingRef = refs.find(
      (ref) => ref.type === refType && refIds.includes(ref.id)
    );
    return {
      id: r.id,
      source: r.source,
      linkingKey: matchingRef?.id ?? refIds[0] ?? "",
    };
  });
}

/**
 * Find observations that mention specific issue IDs
 * Searches: JSONB sourceReferences, title, and sourceId
 */
async function findObservationsByIssueId(
  workspaceId: string,
  excludeId: number,
  issueIds: string[]
): Promise<{ id: number; linkingKey: string }[]> {
  if (issueIds.length === 0) return [];

  // JSONB containment conditions for issue references
  const jsonbConditions = issueIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: "issue", id }])}::jsonb`
  );

  // Title/sourceId ILIKE conditions
  const titleConditions = issueIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.title} ILIKE ${"%" + id + "%"}`
  );
  const sourceIdConditions = issueIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.sourceId} ILIKE ${"%" + id + "%"}`
  );

  const results = await db
    .select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      sourceId: workspaceNeuralObservations.sourceId,
      sourceReferences: workspaceNeuralObservations.sourceReferences,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.id} != ${excludeId}`,
        or(...jsonbConditions, ...titleConditions, ...sourceIdConditions)
      )
    )
    .limit(50);

  return results.map((r) => {
    // Check JSONB references first (higher quality match)
    const refs = (r.sourceReferences ?? []) as SourceReference[];
    const jsonbMatch = refs.find(
      (ref) => ref.type === "issue" && issueIds.includes(ref.id)
    );
    if (jsonbMatch) {
      return { id: r.id, linkingKey: jsonbMatch.id };
    }
    // Fall back to title/sourceId match
    const matchingId = issueIds.find(
      (id) => r.title.includes(id) || r.sourceId.includes(id)
    );
    return {
      id: r.id,
      linkingKey: matchingId ?? issueIds[0] ?? "",
    };
  });
}

/**
 * Find observations that match PR numbers (e.g., #478)
 * Used for Linear → GitHub PR linking via attachments
 */
async function findObservationsByPrId(
  workspaceId: string,
  excludeId: number,
  prIds: string[]
): Promise<{ id: number; linkingKey: string }[]> {
  if (prIds.length === 0) return [];

  // Build conditions for sourceId matching (PR IDs are in sourceId like "pr:acme/platform#478")
  const sourceIdConditions = prIds.map(
    (id) =>
      sql`${workspaceNeuralObservations.sourceId} ILIKE ${"%" + id + "%"}`
  );

  const results = await db
    .select({
      id: workspaceNeuralObservations.id,
      sourceId: workspaceNeuralObservations.sourceId,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.id} != ${excludeId}`,
        or(...sourceIdConditions)
      )
    )
    .limit(50);

  // Find which PR ID matched
  return results.map((r) => {
    const matchingId = prIds.find((id) => r.sourceId.includes(id));
    return {
      id: r.id,
      linkingKey: matchingId ?? prIds[0] ?? "",
    };
  });
}

/**
 * Determine relationship type based on source types and commit reference labels
 *
 * Strictly assigns types per the definitive links research:
 * - `resolves` (1.0, explicit) — Only when Sentry provides a commit with `label: "resolved_by"`
 * - `deploys` (1.0) — Vercel deployment ↔ GitHub commit
 * - `same_commit` (1.0) — Default for commit SHA matching across sources
 */
function determineCommitRelationType(
  newSource: string,
  matchSource: string,
  commitRef: SourceReference | undefined
): RelationshipType {
  // Explicit Sentry → commit resolution (statusDetails.inCommit)
  // Only when the new observation is Sentry AND the commit ref has "resolved_by" label
  if (newSource === "sentry" && commitRef?.label === "resolved_by") {
    return "resolves";
  }
  // Or when we're matching against a Sentry observation that has resolved_by
  if (matchSource === "sentry" && commitRef?.label === "resolved_by") {
    return "resolves";
  }

  // Vercel ↔ GitHub commit = deploys
  if (
    (newSource === "vercel" && matchSource === "github") ||
    (newSource === "github" && matchSource === "vercel")
  ) {
    return "deploys";
  }

  // Default: same commit SHA across any sources
  return "same_commit";
}

/**
 * Deduplicate relationships, keeping highest confidence for each target
 */
function deduplicateRelationships(
  relationships: DetectedRelationship[]
): DetectedRelationship[] {
  const byTarget = new Map<string, DetectedRelationship>();

  for (const rel of relationships) {
    const key = `${rel.targetObservationId}-${rel.relationshipType}`;
    const existing = byTarget.get(key);

    if (!existing || rel.confidence > existing.confidence) {
      byTarget.set(key, rel);
    }
  }

  return Array.from(byTarget.values());
}
