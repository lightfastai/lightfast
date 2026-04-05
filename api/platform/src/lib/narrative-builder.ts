import { createHash } from "node:crypto";

interface NarrativeEvent {
  occurredAt: string; // ISO datetime string (mode: "string" from Drizzle)
  sourceType: string;
  title: string;
}

interface NarrativeEdge {
  relationshipType: string;
  targetCategory: string;
  targetKey: string;
}

interface NarrativeEntity {
  category: string;
  extractedAt: string | null; // ISO datetime string (mode: "string" from Drizzle)
  key: string;
  lastSeenAt: string | null; // ISO datetime string (mode: "string" from Drizzle)
  occurrenceCount: number;
  value: string | null;
}

/**
 * Build a structured narrative text from an entity's genesis context, recent
 * events, temporal span, and graph edges.
 *
 * Uses targeted queries (genesis + last 3 + edges) rather than a sliding
 * window so that founding context is never lost regardless of entity age.
 */
export function buildEntityNarrative(
  entity: NarrativeEntity,
  genesisEvent: NarrativeEvent | null,
  recentEvents: NarrativeEvent[],
  edges: NarrativeEdge[]
): string {
  // Narrative section order is intentional and must not be changed without
  // revisiting the NARRATIVE_CHAR_CAP in entity-embed.ts.
  //
  // Cohere embed-english-v3.0 has a 512-token context window (≈ 2,048 chars).
  // Sections are ordered most-important-first so that if the cap fires,
  // only the least semantically important content (graph edges) is lost:
  //
  //   1. Identity          — always present; the primary signal
  //   2. Genesis event     — founding context; never lost with LIMIT 1 query
  //   3. Temporal span     — first/last seen dates + event count
  //   4. Recent events     — recency signal (up to 3 events)
  //   5. Related entities  — graph edges (up to 3 edges)  <- first to be cut
  const sections: string[] = [];

  // -- Identity (from entity row -- always present)
  sections.push(
    `${entity.category} ${entity.key}: ${entity.value ?? entity.key}`
  );

  // -- Genesis (first event -- founding context, never lost)
  if (genesisEvent) {
    const date = genesisEvent.occurredAt.slice(0, 10);
    const action =
      genesisEvent.sourceType.split(".").pop() ?? genesisEvent.sourceType;
    sections.push(`Created: ${date} ${action}: ${genesisEvent.title}`);
  }

  // -- Temporal span (from entity row -- always present)
  const firstSeen = entity.extractedAt?.slice(0, 10);
  const lastSeen = entity.lastSeenAt?.slice(0, 10);
  sections.push(
    `First seen: ${firstSeen} | Last seen: ${lastSeen} | Events: ${entity.occurrenceCount}`
  );

  // -- Recent events (last 3, desc-ordered -- recency signal + current state)
  if (recentEvents.length > 0) {
    const timeline = recentEvents.map((e) => {
      const date = e.occurredAt.slice(0, 10);
      const action = e.sourceType.split(".").pop() ?? e.sourceType;
      return `  ${date} ${action}: ${e.title}`;
    });
    sections.push(`Recent:\n${timeline.join("\n")}`);
  }

  // -- Related entities (from graph edges)
  // slice(0, 3): matches the LIMIT 3 in entity-embed.ts fetch-narrative-inputs.
  // Keeping this guard consistent with the DB limit prevents accidental
  // over-embedding if this function is called from other contexts in future.
  if (edges.length > 0) {
    const edgeLines = edges
      .slice(0, 3)
      .map(
        (e) => `  ${e.relationshipType} → ${e.targetCategory} ${e.targetKey}`
      );
    sections.push(`Related:\n${edgeLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

/**
 * Compute a short content hash for dedup — stored in Pinecone metadata.
 * Allows future optimisation: skip re-embedding if narrative hasn't changed.
 */
export function narrativeHash(narrative: string): string {
  return createHash("sha256").update(narrative).digest("hex").slice(0, 16);
}
