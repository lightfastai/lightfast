import type { ChatRouterOutputs } from "@api/chat";

// Session type from API - use getMetadata which includes activeStreamId
type Session = ChatRouterOutputs["session"]["getMetadata"];

/**
 * Hook to manage session-related state for ChatInterface
 * Handles both authenticated (with session) and unauthenticated (without session) cases
 */
export function useSessionState(
	session?: Session, 
	fallbackSessionId?: string
) {
	// Use session ID if available, otherwise fallback, otherwise generate one
	const sessionId = session?.id ?? fallbackSessionId ?? crypto.randomUUID();
	
	// Derive resume and hasActiveStream from session.activeStreamId
	// For unauthenticated users (no session), these are always false
	const activeStreamId = session?.activeStreamId;
	const resume = activeStreamId !== null && activeStreamId !== undefined;
	const hasActiveStream = activeStreamId !== null && activeStreamId !== undefined;
	
	return {
		sessionId,
		resume,
		hasActiveStream,
	};
}