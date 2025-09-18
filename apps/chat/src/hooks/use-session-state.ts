import { useEffect, useMemo, useState } from "react";
import type { ChatRouterOutputs } from "@api/chat";

type Session = ChatRouterOutputs["session"]["getMetadata"];

/**
 * Manages session identifiers and whether a resumable stream is currently active.
 * The hook keeps `hasActiveStream` in local state so the UI can react to runtime
 * signals (e.g., persistence/resume failures) without waiting for a server refetch.
 */
export function useSessionState(session?: Session, fallbackSessionId?: string) {
	const sessionId = useMemo(
		() => session?.id ?? fallbackSessionId ?? crypto.randomUUID(),
		[session?.id, fallbackSessionId],
	);

	const initialHasActiveStream = Boolean(session?.activeStreamId);
	const [hasActiveStream, setHasActiveStream] = useState(initialHasActiveStream);

	// Sync local state when the server-provided session metadata changes (e.g., refetch).
	useEffect(() => {
		setHasActiveStream(Boolean(session?.activeStreamId));
	}, [session?.activeStreamId]);

	return {
		sessionId,
		resume: hasActiveStream,
		hasActiveStream,
		setHasActiveStream,
	};
}
