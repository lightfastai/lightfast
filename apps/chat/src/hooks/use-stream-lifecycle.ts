import { useEffect, useRef } from "react";
import { addBreadcrumb } from "@sentry/nextjs";
import type { ChatStatus } from "ai";

interface UseStreamLifecycleOptions {
	status: ChatStatus;
	agentId: string;
	sessionId: string;
	selectedModelId: string;
	metricsTags: Record<string, string>;
	setHasActiveStream: (active: boolean) => void;
	onResumeStateChange?: (hasActiveStream: boolean) => void;
	disableResume: () => void;
}

/**
 * Hook for managing stream lifecycle events and tracking.
 * Handles stream start/end tracking, performance metrics, and breadcrumbs.
 */
export function useStreamLifecycle({
	status,
	agentId,
	sessionId,
	selectedModelId,
	metricsTags,
	setHasActiveStream,
	onResumeStateChange,
}: UseStreamLifecycleOptions) {
	const previousStatusRef = useRef(status);
	const streamStartedAtRef = useRef<number | null>(null);

	useEffect(() => {
		const previousStatus = previousStatusRef.current;
		if (status === "streaming" && previousStatus !== "streaming") {
			if (typeof performance !== "undefined") {
				streamStartedAtRef.current = performance.now();
			}
			addBreadcrumb({
				category: "chat-ui",
				message: "stream_started",
				data: {
					agentId,
					sessionId,
					modelId: selectedModelId,
				},
			});
			setHasActiveStream(true);
			onResumeStateChange?.(true);
		}
		if (status !== "streaming" && previousStatus === "streaming") {
			if (typeof performance !== "undefined" && streamStartedAtRef.current !== null) {
				const duration = performance.now() - streamStartedAtRef.current;
				addBreadcrumb({
					category: "chat-ui",
					message: "stream_duration",
					data: {
						...metricsTags,
						duration,
						finalStatus: status,
					},
				});
			}
			streamStartedAtRef.current = null;
			addBreadcrumb({
				category: "chat-ui",
				message: "stream_completed",
				data: {
					agentId,
					sessionId,
					modelId: selectedModelId,
					finalStatus: status,
				},
			});
		}
		previousStatusRef.current = status;
	}, [
		status,
		setHasActiveStream,
		onResumeStateChange,
		metricsTags,
		agentId,
		sessionId,
		selectedModelId,
	]);

	return {
		// Currently no return values needed, but can add if necessary
	};
}
