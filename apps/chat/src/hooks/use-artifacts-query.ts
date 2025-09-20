import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

interface UseArtifactsQueryOptions {
	sessionId: string;
	limit?: number;
	offset?: number;
	enabled?: boolean;
}

/**
 * Hook for querying artifacts in a session
 * Returns all artifacts belonging to the session
 */
export function useArtifactsQuery({ 
	sessionId, 
	limit = 50, 
	offset = 0,
	enabled = true
}: UseArtifactsQueryOptions) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.artifact.list.queryOptions({
			sessionId,
			limit,
			offset,
		}),
		enabled: Boolean(sessionId) && enabled,
		staleTime: 1000 * 60 * 2, // 2 minutes - artifacts might be created/updated during session
		gcTime: 1000 * 60 * 10, // 10 minutes - keep in cache longer
	});
}