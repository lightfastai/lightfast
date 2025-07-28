/**
 * Event-driven architecture exports
 */

export type { EventEmitterConfig } from "./emitter";

// Export event emitter
export * from "./emitter";
export { EventEmitter, SessionEventEmitter } from "./emitter";
// Export all schemas and types (includes EventType)
export * from "./schemas";
