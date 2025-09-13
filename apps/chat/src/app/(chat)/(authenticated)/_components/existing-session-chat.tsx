"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "~/trpc/react";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType } from "~/lib/billing/types";

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

	// Batch all queries together for better performance
	const [{ data: user, isLoading: isUserLoading }, { data: messages, isLoading: isMessagesLoading }, { data: usageLimits, isLoading: isUsageLoading }] =
		useQueries({
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
					...usageQueryOptions,
					staleTime: 60 * 1000, // Consider usage data fresh for 1 minute (we update optimistically)
					gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
					refetchOnMount: false, // Don't refetch on mount to prevent blocking
					refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
				},
			],
		});

	// Handle loading states
	if (isUserLoading || isMessagesLoading || isUsageLoading) {
		return null; // Let parent handle loading state
	}

	// Handle missing data
	if (!user || !messages || !usageLimits) {
		return null; // Let parent handle error state
	}

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

					// Optimistically update usage limits
					queryClient.setQueryData(
						usageQueryOptions.queryKey,
						(oldUsageData) => {
							if (!oldUsageData) return oldUsageData;

							const messageType = getMessageType(selectedModelId);
							const isPremium = messageType === MessageType.PREMIUM;

							// Create updated usage data
							const updatedUsage = {
								...oldUsageData,
								usage: {
									...oldUsageData.usage,
									nonPremiumMessages: isPremium
										? oldUsageData.usage.nonPremiumMessages
										: (oldUsageData.usage.nonPremiumMessages || 0) + 1,
									premiumMessages: isPremium
										? (oldUsageData.usage.premiumMessages || 0) + 1
										: oldUsageData.usage.premiumMessages,
								},
								remainingQuota: {
									nonPremiumMessages: isPremium
										? oldUsageData.remainingQuota.nonPremiumMessages
										: Math.max(
												0,
												oldUsageData.remainingQuota.nonPremiumMessages - 1,
											),
									premiumMessages: isPremium
										? Math.max(
												0,
												oldUsageData.remainingQuota.premiumMessages - 1,
											)
										: oldUsageData.remainingQuota.premiumMessages,
								},
							};

							console.log(
								`[Optimistic Update] Updated usage for ${isPremium ? "premium" : "non-premium"} message:`,
								{
									model: selectedModelId,
									remainingNonPremium:
										updatedUsage.remainingQuota.nonPremiumMessages,
									remainingPremium: updatedUsage.remainingQuota.premiumMessages,
								},
							);

							return updatedUsage;
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
