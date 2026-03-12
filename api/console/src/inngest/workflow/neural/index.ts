/**
 * Neural Memory Workflows
 *
 * Observation pipeline:
 * 1. observationCapture - Main write path (sync)
 * 2. profileUpdate - Actor profile updates (async, fire-and-forget)
 */

export { observationCapture } from "./observation-capture";
export { profileUpdate } from "./profile-update";
