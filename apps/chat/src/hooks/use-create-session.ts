import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { produce } from "immer";
import { useTRPC } from "~/trpc/react";
import { showTRPCErrorToast } from "~/lib/trpc-errors";
import type { RouterOutputs } from "@vendor/trpc";
import { DEFAULT_SESSION_TITLE } from "@vendor/db/lightfast/schema";

type Session = RouterOutputs["chat"]["session"]["list"][number];
type SessionsInfiniteData = InfiniteData<Session[]>;

interface CreateSessionInput {
	clientSessionId: string;
}

/**
 * Hook for creating a new chat session with optimistic updates
 * Makes session creation feel instant in the UI
 */
export function useCreateSession() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.chat.session.create.mutationOptions({
			onMutate: async ({ clientSessionId }: CreateSessionInput) => {
				// Cancel any outgoing refetches for session list queries
				await queryClient.cancelQueries({
					queryKey: [["chat", "session", "list"]],
				});

				// Get all infinite query cache entries for session list
				const queryCache = queryClient.getQueryCache();
				const queries = queryCache.findAll({
					queryKey: [["chat", "session", "list"]],
					type: "active",
				});

				// Store all previous data for potential rollback
				const previousDataMap = new Map<string, SessionsInfiniteData>();

				// Create optimistic session with client session ID
				const now = new Date().toISOString();
				const optimisticSession: Session & { clientSessionId: string } = {
					id: clientSessionId, // Use the client session ID as the temporary ID
					title: DEFAULT_SESSION_TITLE,
					pinned: false,
					createdAt: now,
					updatedAt: now,
					clientSessionId, // Include the client session ID
				};

				// Update each cached query
				queries.forEach((query) => {
					const queryKey = query.queryKey;
					const previousData =
						queryClient.getQueryData<SessionsInfiniteData>(queryKey);

					if (previousData) {
						previousDataMap.set(JSON.stringify(queryKey), previousData);

						// Optimistically update the cache using immer
						queryClient.setQueryData<SessionsInfiniteData>(
							queryKey,
							produce(previousData, (draft) => {
								// Add the new session to the first page
								if (draft.pages.length > 0 && draft.pages[0]) {
									draft.pages[0].unshift(optimisticSession as Session);
								} else {
									// If no pages exist, create one with the new session
									draft.pages = [[optimisticSession as Session]];
								}
							}),
						);
					}
				});

				// Also update regular (non-infinite) queries if they exist
				const regularQueryKey = trpc.chat.session.list.queryOptions({ limit: 20 }).queryKey;
				const regularData =
					queryClient.getQueryData<Session[]>(regularQueryKey);

				if (regularData) {
					queryClient.setQueryData<Session[]>(
						regularQueryKey,
						produce(regularData, (draft) => {
							draft.unshift(optimisticSession as Session);
						}),
					);
				}

				// Return context for rollback
				return { previousDataMap, optimisticSession, clientSessionId };
			},

			onError: (err, _variables, context) => {
				showTRPCErrorToast(err, "Failed to create session");

				// Rollback all queries on error
				if (context?.previousDataMap) {
					context.previousDataMap.forEach((data, keyString) => {
						const queryKey = JSON.parse(keyString);
						queryClient.setQueryData<SessionsInfiniteData>(queryKey, data);
					});
				}
			},

			onSuccess: (data, variables, context) => {
				// Replace the temporary optimistic session with the real one
				if (context?.optimisticSession && data?.id) {
					const { clientSessionId } = variables;

					// Get all infinite query cache entries
					const queryCache = queryClient.getQueryCache();
					const queries = queryCache.findAll({
						queryKey: [["chat", "session", "list"]],
						type: "active",
					});

					// Update each cached query with the real session data
					queries.forEach((query) => {
						const queryKey = query.queryKey;
						const currentData =
							queryClient.getQueryData<SessionsInfiniteData>(queryKey);

						if (currentData) {
							queryClient.setQueryData<SessionsInfiniteData>(
								queryKey,
								produce(currentData, (draft) => {
									draft.pages.forEach((page) => {
										page.forEach((session, index) => {
											// Replace the optimistic session with the real one
											if (session.id === clientSessionId) {
												page[index] = {
													...session,
													id: data.id,
													clientSessionId:
														data.clientSessionId || clientSessionId,
												};
											}
										});
									});
								}),
							);
						}
					});

					// Also update regular queries
					const regularQueryKey =
						trpc.chat.session.list.queryOptions({ limit: 20 }).queryKey;
					const regularData =
						queryClient.getQueryData<Session[]>(regularQueryKey);

					if (regularData) {
						queryClient.setQueryData<Session[]>(
							regularQueryKey,
							produce(regularData, (draft) => {
								const index = draft.findIndex((s) => s.id === clientSessionId);
								if (index !== -1 && draft[index]) {
									draft[index] = {
										...draft[index],
										id: data.id,
										clientSessionId: data.clientSessionId || clientSessionId,
									};
								}
							}),
						);
					}
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

