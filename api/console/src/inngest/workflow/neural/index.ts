/**
 * Neural Memory Workflows
 *
 * Event pipeline (two-function split):
 * 1. eventStore     - Fast path: store facts + entities + junctions (<2s)
 * 2. eventInterpret - Slow path: classify + embed + store interpretation (5-30s)
 */

export { eventInterpret } from "./event-interpret";
export { eventStore } from "./event-store";
