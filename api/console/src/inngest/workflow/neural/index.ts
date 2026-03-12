/**
 * Neural Memory Workflows
 *
 * Observation pipeline (two-function split):
 * 1. observationStore  - Fast path: store facts + entities + junctions (<2s)
 * 2. observationInterpret - Slow path: classify + embed + store interpretation (5-30s)
 */

export { observationInterpret } from "./observation-interpret";
export { observationStore } from "./observation-store";
