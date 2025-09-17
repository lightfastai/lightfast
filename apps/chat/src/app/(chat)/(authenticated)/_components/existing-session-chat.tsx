"use client";

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

	// Batch all queries together with suspense for better performance
	const [{ data: user }, { data: messages }, { data: sessionData }, { data: usageLimits }] = useSuspenseQueries({
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
				...trpc.session.getActiveStream.queryOptions({ sessionId }),
				staleTime: 1000, // Fresh for 1 second (activeStreamId changes frequently)
				gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
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


	// Convert database messages to UI format
	const initialMessages: LightfastAppChatUIMessage[] = messages.map((msg) => ({
		id: msg.id,
		role: msg.role,
		parts: msg.parts,
	})) as LightfastAppChatUIMessage[];

	// No-op for existing sessions - session already exists
	const handleSessionCreation = (_firstMessage: string) => {
		// Existing sessions don't need creation
	};

	return (
		<DataStreamProvider>
			<ChatInterface
				key={`${agentId}-${sessionId}`}
				agentId={agentId}
				sessionId={sessionId}
				initialMessages={initialMessages}
				isNewSession={false}
				handleSessionCreation={handleSessionCreation}
				user={user}
				resume={sessionData.activeStreamId !== null}
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

					// Optimistically update usage limits using immer
					queryClient.setQueryData(
						usageQueryOptions.queryKey,
						(oldUsageData) => {
							if (!oldUsageData) return oldUsageData;

							const messageType = getMessageType(selectedModelId);
							const isPremium = messageType === MessageType.PREMIUM;

							// Use immer for clean immutable updates
							return produce(oldUsageData, (draft) => {
								// Update usage counts
								if (isPremium) {
									draft.usage.premiumMessages = (draft.usage.premiumMessages || 0) + 1;
									draft.remainingQuota.premiumMessages = Math.max(
										0,
										draft.remainingQuota.premiumMessages - 1,
									);
								} else {
									draft.usage.nonPremiumMessages = (draft.usage.nonPremiumMessages || 0) + 1;
									draft.remainingQuota.nonPremiumMessages = Math.max(
										0,
										draft.remainingQuota.nonPremiumMessages - 1,
									);
								}
							});
						},
					);
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
			/>
		</DataStreamProvider>
	);
}
