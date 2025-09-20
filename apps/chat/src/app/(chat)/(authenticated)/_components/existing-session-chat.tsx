"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType } from "~/lib/billing/types";
import { produce } from "immer";

interface ExistingSessionChatProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that loads existing session data and renders the chat interface.
 * With prefetched data from the server, this should render instantly.
 */
export function ExistingSessionChat({
	sessionId,
	agentId,
}: ExistingSessionChatProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	// Model selection (authenticated users only have model selection)
	const { selectedModelId } = useModelSelection(true);

	// Get query options for cache updates
	const messagesQueryOptions = trpc.message.list.queryOptions({
		sessionId,
	});
	const usageQueryOptions = trpc.usage.checkLimits.queryOptions({});
	const sessionQueryOptions = trpc.session.getMetadata.queryOptions({ sessionId });

	// Batch all queries together with suspense for better performance
	const [{ data: user }, { data: messages }, { data: session }, { data: usageLimits }] = useSuspenseQueries({
		queries: [
			{
				...trpc.user.getUser.queryOptions(),
				staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
				refetchOnMount: false, // Prevent blocking navigation
				refetchOnWindowFocus: false, // Don't refetch on window focus
			},
			{
				...messagesQueryOptions,
				staleTime: 30 * 1000, // Consider data fresh for 30 seconds (we update via callbacks)
				gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes for better navigation
				refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
				refetchOnMount: false, // Don't refetch on mount to prevent blocking navigation
			},
			{
				...sessionQueryOptions,
				staleTime: 30 * 1000, // Consider session metadata fresh for 30 seconds
				gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
				refetchOnWindowFocus: false, // Don't refetch on focus
				refetchOnMount: false, // Don't refetch on mount to prevent blocking navigation
			},
			{
				...usageQueryOptions,
				staleTime: 60 * 1000, // Consider usage data fresh for 1 minute (we update optimistically)
				gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
				refetchOnMount: false, // Don't refetch on mount to prevent blocking
				refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
			},
		],
	});

	// Redirect to not-found for temporary sessions - they shouldn't be directly accessible
	useEffect(() => {
		if (session.isTemporary) {
			notFound();
		}
	}, [session.isTemporary]);

	if (session.isTemporary) {
		return null;
	}


	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	})) as LightfastAppChatUIMessage[];

	// Session already includes activeStreamId now

	// No-op for existing sessions - session already exists
	const handleSessionCreation = (_firstMessage: string) => {
		// Existing sessions don't need creation
	};

	return (
		<DataStreamProvider>
			<ChatInterface
				key={`${agentId}-${sessionId}`}
				agentId={agentId}
				session={session}
				initialMessages={initialMessages}
				isNewSession={false}
				handleSessionCreation={handleSessionCreation}
				user={user}
				usageLimits={usageLimits}
				onNewUserMessage={(userMessage) => {
					// Optimistically append the user message to the cache
					queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
						const currentMessages = oldData ?? [];
						// Check if message with this ID already exists
						if (currentMessages.some((msg) => msg.id === userMessage.id)) {
							return currentMessages;
						}
						return [
							...currentMessages,
							{
								id: userMessage.id,
								role: userMessage.role,
								parts: userMessage.parts,
								modelId: selectedModelId,
							},
						];
					});

					// Optimistically update usage for immediate UI feedback (prevents spam clicking)
					// Server-side reservation system provides authoritative validation
					queryClient.setQueryData(
						usageQueryOptions.queryKey,
						(oldUsageData) => {
							if (!oldUsageData) return oldUsageData;

							const messageType = getMessageType(selectedModelId);
							const isPremium = messageType === MessageType.PREMIUM;

							// Optimistic decrement to prevent spam clicking and keep billing view in sync
							return produce(oldUsageData, (draft) => {
								if (isPremium) {
									draft.remainingQuota.premiumMessages = Math.max(
										0,
										draft.remainingQuota.premiumMessages - 1,
									);
									draft.usage.premiumMessages += 1;
									const premiumLimit = draft.limits.premiumMessages;
									draft.exceeded.premiumMessages =
										draft.usage.premiumMessages >= premiumLimit;
								} else {
									draft.remainingQuota.nonPremiumMessages = Math.max(
										0,
										draft.remainingQuota.nonPremiumMessages - 1,
									);
									draft.usage.nonPremiumMessages += 1;
									const standardLimit = draft.limits.nonPremiumMessages;
									draft.exceeded.nonPremiumMessages =
										draft.usage.nonPremiumMessages >= standardLimit;
								}
							});
						},
					);
				}}
				onQuotaError={(modelId) => {
					// Rollback optimistic quota update when server rejects
					queryClient.setQueryData(
						usageQueryOptions.queryKey,
						(oldUsageData) => {
							if (!oldUsageData) return oldUsageData;

							const messageType = getMessageType(modelId);
							const isPremium = messageType === MessageType.PREMIUM;

							// Rollback: increment quota back
							return produce(oldUsageData, (draft) => {
								if (isPremium) {
									draft.remainingQuota.premiumMessages += 1;
									draft.usage.premiumMessages = Math.max(
										0,
										draft.usage.premiumMessages - 1,
									);
									const premiumLimit = draft.limits.premiumMessages;
									draft.exceeded.premiumMessages =
										draft.usage.premiumMessages >= premiumLimit;
								} else {
									draft.remainingQuota.nonPremiumMessages += 1;
									draft.usage.nonPremiumMessages = Math.max(
										0,
										draft.usage.nonPremiumMessages - 1,
									);
									const standardLimit = draft.limits.nonPremiumMessages;
									draft.exceeded.nonPremiumMessages =
										draft.usage.nonPremiumMessages >= standardLimit;
								}
							});
						},
					);
					console.log('[ExistingSessionChat] Rolled back optimistic quota update for model:', modelId);
				}}
				onNewAssistantMessage={(assistantMessage) => {
					// Optimistically append the assistant message to the cache
					queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
						const currentMessages = oldData ?? [];
						// Check if message with this ID already exists
						if (currentMessages.some((msg) => msg.id === assistantMessage.id)) {
							return currentMessages;
						}
						return [
							...currentMessages,
							{
								id: assistantMessage.id,
								role: assistantMessage.role,
								parts: assistantMessage.parts,
								modelId: null,
							},
						];
					});

					// Trigger background refetch to sync with database
					// This ensures eventual consistency with the persisted data
					void queryClient.invalidateQueries({
						queryKey: messagesQueryOptions.queryKey,
					});

					// Also refetch usage data to sync with server-side tracking
					void queryClient.invalidateQueries({
						queryKey: usageQueryOptions.queryKey,
					});
				}}
				onAssistantStreamError={({ messageId }) => {
					if (!messageId) return;
					queryClient.setQueryData(messagesQueryOptions.queryKey, (oldData) => {
						if (!oldData) return oldData;
						return oldData.filter((msg) => msg.id !== messageId);
					});
				}}
				onResumeStateChange={(active) => {
					if (active) {
						return;
					}
					queryClient.setQueryData(sessionQueryOptions.queryKey, (oldSession) => {
						if (!oldSession) return oldSession;
						if (oldSession.activeStreamId == null) return oldSession;
						return { ...oldSession, activeStreamId: null };
					});
				}}
			/>
		</DataStreamProvider>
	);
}
