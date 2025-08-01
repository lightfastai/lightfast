/**
 * Redis key generation utilities
 * Centralized location for all Redis key patterns
 */

/**
 * Get session key for storing agent session state
 */
export function getSessionKey(sessionId: string): string {
	return `v2:session:${sessionId}`;
}

/**
 * Get message key for storing UIMessages
 */
export function getMessageKey(sessionId: string): string {
	return `v2:messages:${sessionId}`;
}

/**
 * Get delta stream key for real-time streaming
 */
export function getDeltaStreamKey(sessionId: string): string {
	return `llm:stream:${sessionId}`;
}

/**
 * Get event stream key for system events
 */
export function getEventStreamKey(sessionId: string): string {
	return `v2:events:${sessionId}`;
}
