/**
 * V2 Server exports for easy imports
 * @module @lightfast/ai/v2/server
 */

export { type FetchRequestHandlerOptions, fetchRequestHandler } from "../core/v2/server/adapters/fetch";
export { MessageReader } from "../core/v2/server/readers/message-reader";
export { StreamConsumer } from "../core/v2/server/stream/consumer";
export { generateSessionId } from "../core/v2/server/utils";
export { EventWriter } from "../core/v2/server/events/event-writer";
export { EventConsumer } from "../core/v2/server/events/consumer";
export * from "../core/v2/server/events/types";
export { MessageWriter } from "../core/v2/server/writers/message-writer";
export { SessionWriter } from "../core/v2/server/writers/session-writer";

// Export runtime handlers
export * from "../core/v2/server/handlers/runtime";
