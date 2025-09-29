"use client";

import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
	useQuery,
	useQueryClient,
	useSuspenseQueries,
} from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "@repo/chat-trpc/react";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType } from "@repo/chat-billing";
import { produce } from "immer";
import { ChatLoadingSkeleton } from "./chat-loading-skeleton";
import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import {
	getTRPCErrorMessage,
	isNotFound,
	isUnauthorized,
} from "~/lib/trpc-errors";

interface ExistingSessionChatProps {
	sessionId: string;
	agentId: string;
}

/**
 * Client component that loads existing session data and renders the chat interface.
 * React Query handles fetching; cached conversations render instantly after the first load.
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
	const messagesQueryOptions = trpc.message.list.queryOptions({ sessionId });
	const usageQueryOptions = trpc.usage.checkLimits.queryOptions({});
	const sessionQueryOptions = trpc.session.getMetadata.queryOptions({ sessionId });

	// Batch lightweight queries together with suspense for instant hydration.
	const [{ data: user }, { data: session }, { data: usageLimits }] = useSuspenseQueries({
		queries: [
			{
				...trpc.user.getUser.queryOptions(),
				staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
				refetchOnMount: false, // Prevent blocking navigation
				refetchOnWindowFocus: false, // Don't refetch on window focus
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

	const {
		data: messagesData,
		isPending: isMessagesPending,
		isError: isMessagesError,
		error: messagesError,
	} = useQuery({
		...messagesQueryOptions,
		staleTime: 30 * 1000,
		gcTime: 30 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchOnMount: false,
		retry: 2,
	});

	let fallbackContent: ReactNode | null = null;

	if (isMessagesError) {
		if (isNotFound(messagesError)) {
			notFound();
		}

		if (isUnauthorized(messagesError)) {
			fallbackContent = (
				<div className="flex h-full items-center justify-center p-6">
					<div className="max-w-sm text-center text-sm text-muted-foreground">
						You no longer have access to this chat.
					</div>
				</div>
			);
		} else {
			captureException(messagesError, {
				tags: { component: "ExistingSessionChat", query: "message.list" },
				extra: { sessionId },
			});

			const retry = () => {
				void queryClient.invalidateQueries({
					queryKey: messagesQueryOptions.queryKey,
				});
			};

			fallbackContent = (
				<div className="flex h-full items-center justify-center p-6">
					<div className="flex max-w-sm flex-col items-center gap-3 text-center">
						<p className="text-sm text-muted-foreground">
							{getTRPCErrorMessage(messagesError)}
						</p>
						<Button size="sm" variant="outline" onClick={retry}>
							Retry loading chat
						</Button>
					</div>
				</div>
			);
		}
	}

	const messages = messagesData ?? [];

	if (!fallbackContent && isMessagesPending && messages.length === 0) {
		fallbackContent = <ChatLoadingSkeleton />;
	}

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
	const initialMessages = useMemo<LightfastAppChatUIMessage[]>(
		() =>
			messages.map((msg) => ({
				id: msg.id,
				role: msg.role,
				parts: msg.parts,
			})) as LightfastAppChatUIMessage[],
		[messages],
	);

	if (fallbackContent) {
		return fallbackContent;
	}

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
