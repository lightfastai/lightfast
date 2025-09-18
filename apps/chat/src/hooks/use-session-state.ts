import { useEffect, useMemo, useState } from "react";
import type { ChatRouterOutputs } from "@api/chat";

type Session = ChatRouterOutputs["session"]["getMetadata"];

/**
 * Manages session identifiers and stream state.
 * - `resume` reflects whether the server reported an active stream when the page loaded.
 * - `hasActiveStream` tracks the optimistic client view (used for UI treatment).
 */
export function useSessionState(session?: Session, fallbackSessionId?: string) {
	const sessionId = useMemo(
		() => session?.id ?? fallbackSessionId ?? crypto.randomUUID(),
		[session?.id, fallbackSessionId],
	);

	const initialActive = Boolean(session?.activeStreamId);
	const [hasActiveStream, setHasActiveStream] = useState(initialActive);
	const [resumeEnabled, setResumeEnabled] = useState(initialActive);

	// Sync from server metadata when it changes (e.g., refetch after resume cleanup).
	useEffect(() => {
		const active = Boolean(session?.activeStreamId);
		setHasActiveStream(active);
		setResumeEnabled(active);
	}, [session?.activeStreamId]);

	const disableResume = () => {
		setResumeEnabled(false);
		setHasActiveStream(false);
	};

	return {
		sessionId,
		resume: resumeEnabled,
		hasActiveStream,
		setHasActiveStream,
		disableResume,
	};
}
