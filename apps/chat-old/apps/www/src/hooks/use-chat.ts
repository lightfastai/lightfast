"use client";

import { nanoid } from "@/lib/nanoid";
import { useChat as useVercelChat } from "@ai-sdk/react";
import { useAuth } from "@clerk/nextjs";
import { DEFAULT_MODEL_ID } from "@lightfast/ai/providers";
import type { Preloaded } from "convex/react";
import { useConvexAuth, usePreloadedQuery, useQuery } from "convex/react";
import React, { useCallback } from "react";
import { api } from "../../convex/_generated/api";
import type {
	LightfastUIMessage,
	LightfastUIMessageOptions,
} from "./convertDbMessagesToUIMessages";
import { useChatTransport } from "./use-chat-transport";
import { useCreateSubsequentMessages } from "./use-create-subsequent-messages";
import { useCreateThreadWithFirstMessages } from "./use-create-thread-with-first-messages";

interface UseChatProps {
	initialMessages: LightfastUIMessage[];
	preloadedUserSettings?: Preloaded<typeof api.userSettings.getUserSettings>;
	clientId: string | null;
}

/**
 * Core chat hook that manages all chat state and interactions
 * Uses Vercel AI SDK with custom Convex transport for streaming
 */
export function useChat({
	initialMessages,
	preloadedUserSettings,
	clientId,
}: UseChatProps) {
	// Check authentication status (recommended by Convex docs)
	const { isAuthenticated } = useConvexAuth();

	// Get token for HTTP requests (only when needed)
	const { getToken } = useAuth();
	const [authToken, setAuthToken] = React.useState<string | null>(null);

	// Get Clerk auth token for Convex HTTP requests
	React.useEffect(() => {
		async function fetchToken() {
			if (!isAuthenticated) {
				setAuthToken(null);
				return;
			}

			try {
				const token = await getToken({ template: "convex" });
				setAuthToken(token);
				console.log("foudn");
			} catch (error) {
				console.error("Failed to get auth token:", error);
				setAuthToken(null);
			}
		}

		fetchToken();
	}, [getToken, isAuthenticated]);

	const createThreadOptimistic = useCreateThreadWithFirstMessages();
	const createMessageOptimistic = useCreateSubsequentMessages();

	// Query thread if we have a clientId and are authenticated
	const thread = useQuery(
		api.threads.getByClientId,
		clientId && isAuthenticated ? { clientId } : "skip",
	);

	// Extract data from preloaded queries if available
	let userSettings = null;

	if (preloadedUserSettings) {
		userSettings = usePreloadedQuery(preloadedUserSettings);
	}

	const defaultModel =
		userSettings?.preferences?.defaultModel || DEFAULT_MODEL_ID;

	// Create transport using the dedicated hook
	const transport = useChatTransport({
		authToken,
		defaultModel,
	});

	// Generate or use existing clientId for the chat session
	const chatId = clientId ?? nanoid();

	// Use Vercel AI SDK with custom transport and preloaded messages
	// IMPORTANT: We must provide transport, even if undefined, to prevent fallback to /api/chat
	const {
		messages: uiMessages,
		status,
		sendMessage: vercelSendMessage,
	} = useVercelChat<LightfastUIMessage>({
		id: chatId,
		transport, // This can be undefined, which should disable sending
		generateId: () => nanoid(),
		messages: initialMessages,
		onError: (error) => {
			console.error("Chat error:", error);
		},
	});

	// Adapt sendMessage to use Vercel AI SDK v5 with transport
	const sendMessage = useCallback(
		async (options: LightfastUIMessageOptions) => {
			// Don't allow sending messages until we have a transport (authenticated)
			if (!transport) {
				console.error("Cannot send message: Authentication not ready");
				return;
			}

			let userMessageId: string | undefined;
			let assistantMessageId: string | undefined;

			// Check if this is a new thread (no thread exists yet)
			if (!thread?._id) {
				// Update URL using replaceState for seamless navigation
				window.history.replaceState({}, "", `/chat/${chatId}`);
				const data = await createThreadOptimistic({
					clientThreadId: chatId,
					message: {
						type: "text",
						text: options.message,
						timestamp: Date.now(),
					},
					modelId: options.modelId,
				});
				userMessageId = data.userMessageId;
				assistantMessageId = data.assistantMessageId;
			} else {
				// Existing thread
				const data = await createMessageOptimistic({
					threadId: thread._id,
					message: {
						type: "text",
						text: options.message,
						timestamp: Date.now(),
					},
					modelId: options.modelId,
				});
				userMessageId = data.userMessageId;
				assistantMessageId = data.assistantMessageId;
			}

			if (!userMessageId || !assistantMessageId) {
				// @todo need to deep test so this never happens or rewrite our logic.
				console.error("User or assistant message ID not found", {
					userMessageId,
					assistantMessageId,
				});
				return;
			}


			await vercelSendMessage(
				{
					role: "user",
					parts: [{ type: "text", text: options.message }],
					id: userMessageId,
				},
				{
					body: {
						id: assistantMessageId,
						userMessageId,
						threadClientId: chatId,
						options: {
							webSearchEnabled: options.options.webSearchEnabled,
							attachments: options.options.attachments,
						},
					},
				},
			);
		},
		[
			vercelSendMessage,
			chatId,
			createThreadOptimistic,
			createMessageOptimistic,
			thread?._id,
			transport,
		],
	);

	return {
		// Messages
		messages: uiMessages,

		// Status - direct from Vercel AI SDK
		status,

		// Actions
		sendMessage,

		// User settings
		defaultModel,
	};
}
