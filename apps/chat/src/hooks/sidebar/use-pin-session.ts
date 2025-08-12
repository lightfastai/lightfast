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
				// Cancel queries
				await queryClient.cancelQueries({
					queryKey: [["chat", "session", "list"]],
				});
				await queryClient.cancelQueries({
					queryKey: [["chat", "session", "listPinned"]],
				});

				// Get session from infinite list
				const queryCache = queryClient.getQueryCache();
				const queries = queryCache.findAll({
					queryKey: [["chat", "session", "list"]],
					type: "active",
				});

				let session: Session | undefined;
				queries.forEach((query) => {
					const data = queryClient.getQueryData<SessionsInfiniteData>(query.queryKey);
					if (data && !session) {
						session = data.pages.flat().find(s => s.id === sessionId);
					}
				});

				if (!session) return;

				// Update infinite list queries
				queries.forEach((query) => {
					const queryKey = query.queryKey;
					const previousData = queryClient.getQueryData<SessionsInfiniteData>(queryKey);
					
					if (previousData) {
						queryClient.setQueryData<SessionsInfiniteData>(
							queryKey,
							produce(previousData, draft => {
								draft.pages.forEach(page => {
									const item = page.find(s => s.id === sessionId);
									if (item) item.pinned = pinned;
								});
							})
						);
					}
				});

				// Update pinned list
				const pinnedQueryKey = trpc.chat.session.listPinned.queryOptions().queryKey;
				const previousPinned = queryClient.getQueryData<Session[]>(pinnedQueryKey);
				
				// Update pinned list with the found session (session is guaranteed to exist here)
				// Store session in a const for TypeScript to understand it's not undefined
				const foundSession = session;
				queryClient.setQueryData<Session[]>(
					pinnedQueryKey,
					(old) => {
						const current = old ?? [];
						
						if (pinned) {
							// Add to pinned list in correct position
							if (current.find(s => s.id === sessionId)) return current;
							
							const newSession: Session = { 
								id: foundSession.id,
								title: foundSession.title,
								pinned: true,
								createdAt: foundSession.createdAt,
								updatedAt: foundSession.updatedAt
							};
							const sorted = [...current, newSession].sort((a, b) => 
								new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
							);
							return sorted;
						} else {
							// Remove from pinned list
							return current.filter(s => s.id !== sessionId);
						}
					}
				);

				return { previousPinned };
			},
			onError: (err, _variables, context) => {
				showTRPCErrorToast(err, "Failed to update pin status");
				// Rollback pinned list on error
				if (context?.previousPinned !== undefined) {
					const pinnedQueryKey = trpc.chat.session.listPinned.queryOptions().queryKey;
					queryClient.setQueryData<Session[]>(pinnedQueryKey, context.previousPinned);
				}
				// Invalidate to get fresh data
				void queryClient.invalidateQueries({
					queryKey: [["chat", "session", "list"]],
				});
				void queryClient.invalidateQueries({
					queryKey: [["chat", "session", "listPinned"]],
				});
			},
			onSettled: () => {
				// Always invalidate to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: [["chat", "session", "list"]],
					refetchType: "none",
				});
				void queryClient.invalidateQueries({
					queryKey: [["chat", "session", "listPinned"]],
					refetchType: "none",
				});
			},
		}),
	);
}

