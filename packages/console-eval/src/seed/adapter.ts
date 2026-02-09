import { createHash } from "node:crypto";
import type { SourceEvent } from "@repo/console-types";
import { isInternalEventType } from "@repo/console-types";
import type { SeedObservation, SeedCorpus } from "../schemas";
import { seedObservationSchema } from "../schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Fixed salt scoping eval IDs to this corpus context.
 * Changing this invalidates all previously generated externalIds.
 */
const EVAL_ID_SALT = "lightfast-eval-corpus-v1";

// ---------------------------------------------------------------------------
// deriveObservationType  (extracted from observation-capture.ts:103-117)
// ---------------------------------------------------------------------------

/**
 * Derive the stored observationType from a SourceEvent's sourceType.
 *
 * Replicates production logic exactly:
 * - Vercel: replace first dot with underscore
 * - All others: passthrough
 *
 * @see api/console/src/inngest/workflow/neural/observation-capture.ts:103-117
 */
export function deriveObservationType(sourceEvent: SourceEvent): string {
  if (sourceEvent.source === "vercel") {
    return sourceEvent.sourceType.replace(".", "_");
  }
  return sourceEvent.sourceType;
}

// ---------------------------------------------------------------------------
// deterministicExternalId
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic externalId from a SourceEvent's sourceId.
 *
 * Uses SHA-256 of (salt + sourceId), truncated to 16 hex chars.
 * Prefixed with "eval_" for easy identification.
 *
 * @returns string like "eval_a1b2c3d4e5f6g7h8" (21 chars total)
 */
export function deterministicExternalId(sourceId: string): string {
  const hash = createHash("sha256")
    .update(`${EVAL_ID_SALT}:${sourceId}`)
    .digest("hex")
    .slice(0, 16);
  return `eval_${hash}`;
}

// ---------------------------------------------------------------------------
// sourceEventToSeedObservation
// ---------------------------------------------------------------------------

/**
 * Convert a SourceEvent (from webhook transformers) into a SeedObservation
 * (for eval seeding).
 *
 * Field mapping:
 * - externalId:       deterministic SHA-256 from sourceId
 * - title:            direct passthrough
 * - content:          SourceEvent.body -> SeedObservation.content
 * - source:           direct passthrough (SourceType enum)
 * - sourceType:       direct passthrough (internal format string)
 * - sourceId:         direct passthrough
 * - observationType:  derived via deriveObservationType()
 * - occurredAt:       direct passthrough (ISO timestamp)
 * - metadata:         direct passthrough + sourceEventRef provenance
 * - actor:            optional passthrough from SourceEvent.actor
 * - references:       optional passthrough from SourceEvent.references
 */
export function sourceEventToSeedObservation(
  event: SourceEvent,
  options?: {
    entities?: Array<{ category: string; key: string; value?: string }>;
  },
): SeedObservation {
  const observation: SeedObservation = {
    externalId: deterministicExternalId(event.sourceId),
    title: event.title,
    content: event.body,
    source: event.source,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    observationType: deriveObservationType(event),
    occurredAt: event.occurredAt,
    metadata: {
      ...event.metadata,
      sourceEventRef: event.sourceId,
    },
    actor: event.actor
      ? {
          id: event.actor.id,
          name: event.actor.name,
          email: event.actor.email,
          avatarUrl: event.actor.avatarUrl,
        }
      : undefined,
    references: event.references.length > 0 ? event.references : undefined,
    entities: options?.entities,
  };

  // Validate output against schema (catches adapter bugs early)
  return seedObservationSchema.parse(observation);
}

// ---------------------------------------------------------------------------
// sourceEventsToCorpus
// ---------------------------------------------------------------------------

/**
 * Convert an array of SourceEvents into a SeedCorpus.
 *
 * Optionally runs entity extraction on each event via callbacks.
 * Reference entities take priority over text entities in dedup.
 */
export function sourceEventsToCorpus(
  events: SourceEvent[],
  options?: {
    extractEntities?: (
      title: string,
      body: string,
    ) => Array<{ category: string; key: string; value?: string }>;
    extractFromReferences?: (
      references: Array<{ type: string; id: string; label?: string }>,
    ) => Array<{ category: string; key: string; value?: string }>;
  },
): SeedCorpus {
  const observations = events.map((event) => {
    let entities: Array<{ category: string; key: string; value?: string }> | undefined;

    if (options?.extractEntities || options?.extractFromReferences) {
      const textEntities = options.extractEntities?.(event.title, event.body) ?? [];
      const refEntities = options.extractFromReferences?.(event.references) ?? [];

      // Deduplicate by category:key (reference entities take priority)
      const seen = new Set<string>();
      const merged: Array<{ category: string; key: string; value?: string }> = [];
      for (const e of [...refEntities, ...textEntities]) {
        const dedupeKey = `${e.category}:${e.key.toLowerCase()}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          merged.push(e);
        }
      }
      entities = merged.length > 0 ? merged : undefined;
    }

    return sourceEventToSeedObservation(event, { entities });
  });

  return { observations };
}

// ---------------------------------------------------------------------------
// Validation utilities
// ---------------------------------------------------------------------------

/**
 * Validate that all observations in a corpus use valid InternalEventType values.
 *
 * Checks `sourceType` (the canonical EVENT_REGISTRY key),
 * NOT `observationType` (the normalized DB storage format).
 *
 * @returns Array of observations with invalid sourceType values
 */
export function validateCorpusEventTypes(
  corpus: SeedCorpus,
): Array<{ externalId: string; sourceType: string }> {
  return corpus.observations
    .filter((obs) => !isInternalEventType(obs.sourceType))
    .map((obs) => ({
      externalId: obs.externalId,
      sourceType: obs.sourceType,
    }));
}
