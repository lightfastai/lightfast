import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/chat-trpc/react";

interface UseFeedbackQueryOptions {
	sessionId: string;
	enabled?: boolean;
}

/**
 * Hook for querying feedback for messages in a session
 * Returns a map of messageId -> feedback type for easy lookup
 */
export function useFeedbackQuery({ sessionId, enabled = true }: UseFeedbackQueryOptions) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.messageFeedback.getBySession.queryOptions({
			sessionId,
		}),
		enabled: Boolean(sessionId) && enabled,
		staleTime: 1000 * 60 * 5, // 5 minutes - feedback doesn't change often
		gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache longer
	});
}