import type { SourceEvent, SourceActor } from "@repo/console-types";
import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { eq, and, sql } from "drizzle-orm";
import { log } from "@vendor/observability/log";

/**
 * Actor Resolution for Neural Observations
 *
 * For MVP, we don't resolve actors to Clerk users at webhook time.
 * We simply store the GitHub ID and use GitHub-provided profile data.
 *
 * Resolution to Clerk users can happen lazily when needed.
 *
 * For Vercel events, we attempt to resolve the username-based actor ID
 * to a numeric GitHub ID via commit SHA linkage.
 *
 * Future: Add github_clerk_mappings cache table for O(1) reverse lookups.
 */

interface ResolvedActor {
  /** Original actor from source event */
  sourceActor: SourceActor | null;
  /** Canonical actor ID for this workspace (source:id format) */
  actorId: string | null;
}

/**
 * Attempt to resolve Vercel actor to numeric GitHub ID via commit SHA.
 *
 * When a Vercel deployment arrives, we have username but not numeric ID.
 * If a GitHub push event with the same commit SHA already exists, we can
 * extract the numeric ID from that event's actor data.
 *
 * @returns Numeric GitHub user ID if found, null otherwise
 */
async function resolveVercelActorViaCommitSha(
  workspaceId: string,
  commitSha: string,
  _username: string,
): Promise<{ numericId: string } | null> {
  if (!commitSha) return null;

  try {
    // Find GitHub observation with same commit SHA in references
    // Using PostgreSQL JSONB containment to search within the array
    const githubEvent = await db.query.workspaceNeuralObservations.findFirst({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.source, "github"),
        // Check if sourceReferences contains a commit with this SHA
        sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: "commit", id: commitSha }])}::jsonb`,
      ),
      columns: {
        actor: true,
      },
    });

    if (!githubEvent?.actor) return null;

    // Extract numeric ID from GitHub actor
    const numericId = githubEvent.actor.id;
    if (!numericId || !/^\d+$/.test(numericId)) return null;

    log.info("Resolved Vercel actor via commit SHA", {
      commitSha,
      numericId,
    });

    return { numericId };
  } catch (error) {
    log.warn("Failed to resolve Vercel actor via commit SHA", {
      commitSha,
      error,
    });
    return null;
  }
}

/**
 * Resolve source actor to canonical actor ID.
 *
 * For GitHub events: constructs canonical ID from numeric user ID.
 * For Vercel events: attempts to resolve username to numeric ID via commit SHA.
 */
export async function resolveActor(
  workspaceId: string,
  sourceEvent: SourceEvent,
): Promise<ResolvedActor> {
  let sourceActor = sourceEvent.actor ?? null;

  if (!sourceActor) {
    return {
      sourceActor: null,
      actorId: null,
    };
  }

  // For Vercel events, try to resolve username to numeric GitHub ID
  if (sourceEvent.source === "vercel") {
    const references = sourceEvent.references;
    const commitRef = references.find((ref) => ref.type === "commit");

    if (commitRef?.id) {
      const resolved = await resolveVercelActorViaCommitSha(
        workspaceId,
        commitRef.id,
        sourceActor.id, // username
      );

      if (resolved) {
        // Upgrade actor ID to numeric format
        sourceActor = {
          ...sourceActor,
          id: resolved.numericId,
        };

        log.info("Vercel actor upgraded to numeric ID", {
          originalUsername: sourceActor.name,
          numericId: resolved.numericId,
        });
      }
    }
  }

  // Construct canonical actor ID: source:id
  // For GitHub: github:12345678 (numeric)
  // For Vercel: github:12345678 (if resolved) or github:username (if not)
  // Note: Vercel actors use "github:" prefix since they're GitHub users
  const actorId = sourceEvent.source === "vercel"
    ? `github:${sourceActor.id}`
    : `${sourceEvent.source}:${sourceActor.id}`;

  return {
    actorId,
    sourceActor,
  };
}
