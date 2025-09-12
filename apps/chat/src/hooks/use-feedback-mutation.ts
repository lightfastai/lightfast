import { useMutation, useQueryClient } from "@tanstack/react-query";
import { produce } from "immer";
import { useCallback } from "react";
import { useTRPC } from "~/trpc/react";
import { showTRPCErrorToast } from "~/lib/trpc-errors";

interface SubmitFeedbackInput {
	sessionId: string;
	messageId: string;
	feedbackType: "upvote" | "downvote";
}

interface UseFeedbackMutationProps {
	sessionId: string;
	isAuthenticated: boolean;
}

/**
 * Hook for submitting message feedback with optimistic updates
 * Provides instant UI feedback while the request is processed
 * Returns no-op handlers for unauthenticated users
 */
export function useFeedbackMutation({ sessionId, isAuthenticated }: UseFeedbackMutationProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const submitMutation = useMutation(
		trpc.messageFeedback.submit.mutationOptions({
			onMutate: async ({ sessionId, messageId, feedbackType }: SubmitFeedbackInput) => {
				// Cancel any outgoing queries for this session's feedback
				await queryClient.cancelQueries({
					queryKey: trpc.messageFeedback.getBySession.queryOptions({ sessionId }).queryKey,
				});

				// Get the current feedback data
				const previousFeedback = queryClient.getQueryData<Record<string, "upvote" | "downvote">>(
					trpc.messageFeedback.getBySession.queryOptions({ sessionId }).queryKey,
				);

				// Optimistically update the feedback
				queryClient.setQueryData<Record<string, "upvote" | "downvote">>(
					trpc.messageFeedback.getBySession.queryOptions({ sessionId }).queryKey,
					produce(previousFeedback ?? {}, (draft) => {
						draft[messageId] = feedbackType;
					}),
				);

				return { previousFeedback, sessionId, messageId, feedbackType };
			},

			onError: (err, _variables, context) => {
				showTRPCErrorToast(err, "Failed to submit feedback");

				// Rollback the optimistic update
				if (context?.previousFeedback && context.sessionId) {
					queryClient.setQueryData(
						trpc.messageFeedback.getBySession.queryOptions({ sessionId: context.sessionId }).queryKey,
						context.previousFeedback,
					);
				}
			},

			onSettled: (_data, _error, variables) => {
				// Invalidate the query to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: trpc.messageFeedback.getBySession.queryOptions({ sessionId: variables.sessionId }).queryKey,
				});
			},
		}),
	);

	const removeMutation = useMutation(
		trpc.messageFeedback.remove.mutationOptions({
			onMutate: async ({ sessionId, messageId }) => {
				// Cancel any outgoing queries for this session's feedback
				await queryClient.cancelQueries({
					queryKey: trpc.messageFeedback.getBySession.queryOptions({ sessionId }).queryKey,
				});

				// Get the current feedback data
				const previousFeedback = queryClient.getQueryData<Record<string, "upvote" | "downvote">>(
					trpc.messageFeedback.getBySession.queryOptions({ sessionId }).queryKey,
				);

				// Optimistically remove the feedback
				queryClient.setQueryData<Record<string, "upvote" | "downvote">>(
					trpc.messageFeedback.getBySession.queryOptions({ sessionId }).queryKey,
					produce(previousFeedback ?? {}, (draft) => {
						delete draft[messageId];
					}),
				);

				return { previousFeedback, sessionId, messageId };
			},

			onError: (err, _variables, context) => {
				showTRPCErrorToast(err, "Failed to remove feedback");

				// Rollback the optimistic update
				if (context?.previousFeedback && context.sessionId) {
					queryClient.setQueryData(
						trpc.messageFeedback.getBySession.queryOptions({ sessionId: context.sessionId }).queryKey,
						context.previousFeedback,
					);
				}
			},

			onSettled: (_data, _error, variables) => {
				// Invalidate the query to ensure consistency
				void queryClient.invalidateQueries({
					queryKey: trpc.messageFeedback.getBySession.queryOptions({ sessionId: variables.sessionId }).queryKey,
				});
			},
		}),
	);

	// Create callback handlers that respect authentication
	const handleSubmit = useCallback(
		(messageId: string, feedbackType: "upvote" | "downvote") => {
			if (!isAuthenticated) return;
			
			submitMutation.mutate({
				sessionId,
				messageId,
				feedbackType,
			});
		},
		[isAuthenticated, submitMutation, sessionId]
	);

	const handleRemove = useCallback(
		(messageId: string) => {
			if (!isAuthenticated) return;
			
			removeMutation.mutate({
				sessionId,
				messageId,
			});
		},
		[isAuthenticated, removeMutation, sessionId]
	);

	return {
		submit: submitMutation,
		remove: removeMutation,
		handleSubmit: isAuthenticated ? handleSubmit : undefined,
		handleRemove: isAuthenticated ? handleRemove : undefined,
	};
}