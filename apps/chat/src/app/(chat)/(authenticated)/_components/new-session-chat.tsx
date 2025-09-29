"use client";

import { useEffect, useState } from "react";
import { ChatInterface } from "../../_components/chat-interface";
import { useCreateSession } from "~/hooks/use-create-session";
import { useSessionId } from "~/hooks/use-session-id";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "@repo/chat-trpc/react";
import { useSuspenseQueries, useQueryClient } from "@tanstack/react-query";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType } from "@repo/chat-billing";
import { produce } from "immer";
import { computeMessageCharCount } from "@repo/chat-ai-types";

interface NewSessionChatProps {
	agentId: string;
	mode?: "permanent" | "temporary";
}

/**
 * Component for creating new chat sessions.
 * Uses useSessionId hook to manage session ID generation and navigation.
 *
 * Flow:
 * 1. User visits /new -> Hook generates a fresh session ID
 * 2. User types and sends first message
 * 3. handleSessionCreation() is called -> Navigate to /{sessionId} via Next.js router
 * 4. Proper navigation ensures page component executes and data is prefetched
 * 5. If user hits back button to /new, a new ID is generated
 */
export function NewSessionChat({
	agentId,
	mode = "permanent",
}: NewSessionChatProps) {
	// Use the hook to manage session ID generation and navigation state
	const { sessionId, isNewSession } = useSessionId();
	const isTemporaryChat = mode === "temporary";
	const [hasTemporarySessionStarted, setHasTemporarySessionStarted] = useState(false);

	// Get user info and usage data
	const trpc = useTRPC();
	const usageQueryOptions = trpc.usage.checkLimits.queryOptions({});

	const [{ data: user }, { data: usageLimits }] = useSuspenseQueries({
		queries: [
			{
				...trpc.user.getUser.queryOptions(),
				staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
				refetchOnMount: false, // Prevent blocking navigation
				refetchOnWindowFocus: false, // Don't refetch on window focus
			},
			{
				...usageQueryOptions,
				staleTime: 60 * 1000, // Consider usage data fresh for 1 minute
				gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
				refetchOnMount: false, // Don't refetch on mount to prevent blocking
				refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
			},
		],
	});

	// Model selection (authenticated users only have model selection)
	const { selectedModelId } = useModelSelection(true);

	const effectiveIsNewSession =
		isTemporaryChat ? !hasTemporarySessionStarted : isNewSession;

	useEffect(() => {
		setHasTemporarySessionStarted(false);
	}, [isTemporaryChat, sessionId]);

	// Hook for creating sessions optimistically
	const createSession = useCreateSession();

	// Get query client to optimistically update cache
	const queryClient = useQueryClient();

	// Get the query key for messages
	const messagesQueryKey = trpc.message.list.queryOptions({
		sessionId,
	}).queryKey;

	// Handle session creation when the first message is sent
	const handleSessionCreation = (firstMessage: string) => {
		if (!effectiveIsNewSession) {
			// Already transitioned to /{sessionId}, no need to create
			return;
		}

		if (isTemporaryChat) {
			setHasTemporarySessionStarted(true);
		} else {
			// Update the URL immediately for instant feedback
			window.history.replaceState({}, "", `/${sessionId}`);
		}

		// Create the session optimistically (fire-and-forget)
		// The backend will also create it if needed (upsert behavior)
		// This ensures instant UI updates without blocking message sending
		createSession.mutate({
			id: sessionId,
			firstMessage,
			isTemporary: isTemporaryChat,
		});
	};

	return (
		<DataStreamProvider key={`${mode}-${sessionId}`}>
			<ChatInterface
				key={`${mode}-${sessionId}`}
				agentId={agentId}
				fallbackSessionId={sessionId}
				initialMessages={[]}
				isNewSession={effectiveIsNewSession}
				handleSessionCreation={handleSessionCreation}
				user={user}
				usageLimits={usageLimits}
					onNewUserMessage={(userMessage) => {
						const metrics = computeMessageCharCount(userMessage.parts);

						// Optimistically append the user message to the cache
						queryClient.setQueryData(messagesQueryKey, (oldData) => {
							const currentMessages = oldData ?? [];
							// Check if message with this ID already exists
							if (currentMessages.some((msg) => msg.id === userMessage.id)) {
								return currentMessages;
							}
							const createdAt = new Date().toISOString();
							return [
								...currentMessages,
								{
									id: userMessage.id,
									role: userMessage.role,
									parts: userMessage.parts,
									modelId: selectedModelId,
									metadata: {
										sessionId,
										createdAt,
										charCount: metrics.charCount,
										tokenCount: metrics.tokenCount,
										hasFullContent: true,
									},
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
					console.log(
						"[NewSessionChat] Rolled back optimistic quota update for model:",
						modelId,
					);
				}}
				onNewAssistantMessage={(assistantMessage) => {
					const metrics = computeMessageCharCount(assistantMessage.parts);
					const assistantModelId = assistantMessage.metadata?.modelId ?? null;
					const createdAt = assistantMessage.metadata?.createdAt ?? new Date().toISOString();

					// Optimistically append the assistant message to the cache
					queryClient.setQueryData(messagesQueryKey, (oldData) => {
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
								modelId: assistantModelId,
								metadata: {
									sessionId,
									createdAt,
									charCount: metrics.charCount,
									tokenCount: metrics.tokenCount,
									hasFullContent: true,
								},
							},
						];
					});

					// Trigger background refetch to sync with database
					// This ensures eventual consistency with the persisted data
					void queryClient.invalidateQueries({ queryKey: messagesQueryKey });

					// Also refetch usage data to sync with server-side tracking
					void queryClient.invalidateQueries({
						queryKey: usageQueryOptions.queryKey,
					});
				}}
				onAssistantStreamError={({ messageId }) => {
					if (!messageId) return;
					queryClient.setQueryData(messagesQueryKey, (oldData) => {
						if (!oldData) return oldData;
						return oldData.filter((msg) => msg.id !== messageId);
					});
				}}
			/>
		</DataStreamProvider>
	);
}
