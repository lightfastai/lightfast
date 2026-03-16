/**
 * Neural Memory Workflows
 *
 * Event pipeline (three-function fast path):
 * 1. eventStore  - Fast path: store facts + entities + junctions (<2s)
 *                  Emits: entity.upserted → entityGraph
 * 2. entityGraph - Fast path: resolve entity↔entity edges via co-occurrence (<500ms)
 *                  Emits: entity.graphed → entityEmbed
 * 3. entityEmbed - Fast path: build narrative + embed to Pinecone layer="entities" (~2s, debounced 30s)
 */

export { entityEmbed } from "./entity-embed";
export { entityGraph } from "./entity-graph";
export { eventStore } from "./event-store";
