import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { produce } from "immer";
import { useTRPC } from "~/trpc/react";
import { showTRPCErrorToast } from "~/lib/trpc-errors";
import type { RouterOutputs } from "@vendor/trpc";

type Session = RouterOutputs["chat"]["session"]["list"][number];
type SessionsInfiniteData = InfiniteData<Session[]>;

export function usePinSession() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.chat.session.setPinned.mutationOptions({
			onMutate: async ({ sessionId, pinned }) => {
				// Cancel any outgoing refetches for session list queries
				await queryClient.cancelQueries({ 
					queryKey: [["chat", "session", "list"]],
				});

				// Get all infinite query cache entries for session list
				const queryCache = queryClient.getQueryCache();
				const queries = queryCache.findAll({
					queryKey: [["chat", "session", "list"]],
					type: 'active',
				});

				// Store all previous data for potential rollback
				const previousDataMap = new Map<string, SessionsInfiniteData>();
				
				// Update each cached query
				queries.forEach((query) => {
					const queryKey = query.queryKey;
					const previousData = queryClient.getQueryData<SessionsInfiniteData>(queryKey);
					
					if (previousData) {
						previousDataMap.set(JSON.stringify(queryKey), previousData);
						
						// Optimistically update the cache using immer
						queryClient.setQueryData<SessionsInfiniteData>(
							queryKey,
							produce(previousData, (draft) => {
								// Properly iterate through pages and sessions with type safety
								draft.pages.forEach((page) => {
									page.forEach((session) => {
										if (session.id === sessionId) {
											session.pinned = pinned;
										}
									});
								});
							})
						);
					}
				});

				// Return a context object with the snapshotted values
				return { previousDataMap };
			},
			onError: (err, _variables, context) => {
				showTRPCErrorToast(err, "Failed to update pin status");
				// If the mutation fails, rollback all queries
				if (context?.previousDataMap) {
					context.previousDataMap.forEach((data, keyString) => {
						const queryKey = JSON.parse(keyString);
						queryClient.setQueryData<SessionsInfiniteData>(queryKey, data);
					});
				}
			},
			onSettled: () => {
				// Invalidate all session list queries to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: [["chat", "session", "list"]],
					refetchType: "none", // Don't trigger suspense
				});
			},
		}),
	);
}

