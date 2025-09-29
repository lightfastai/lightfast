"use client";

import dynamic from "next/dynamic";
import {
	addBreadcrumb,
	captureException,
	captureMessage,
} from "@sentry/nextjs";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessages } from "./chat-messages";
import { PromptSuggestions } from "./prompt-suggestions";
import {
	PromptInput,
	PromptInputBody,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
	PromptInputSubmit,
	PromptInputButton,
} from "@repo/ui/components/ai-elements/prompt-input";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import type { FormEvent } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp, Globe, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import {
	useState,
	useMemo,
	useEffect,
	useRef,
	useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useErrorBoundaryHandler } from "~/hooks/use-error-boundary-handler";
import { useBillingContext } from "~/hooks/use-billing-context";
import { ChatErrorHandler } from "~/lib/errors/chat-error-handler";
import { ChatErrorType } from "~/lib/errors/types";
import type { ChatError } from "~/lib/errors/types";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import type { ChatRouterOutputs } from "@api/chat";
import type { ArtifactApiResponse } from "~/components/artifacts/types";
import { useTRPC } from "@repo/chat-trpc/react";
import {
	isNotFound,
	isTRPCClientError,
	isUnauthorized,
	getTRPCErrorMessage,
} from "~/lib/trpc-errors";

// Session type from API - use getMetadata which includes activeStreamId
type Session = ChatRouterOutputs["session"]["getMetadata"];
import { useDataStream } from "~/hooks/use-data-stream";
import { useArtifact } from "~/components/artifacts";
import { useArtifactStreaming } from "~/hooks/use-artifact-streaming";
import { useFeedbackQuery } from "~/hooks/use-feedback-query";
import { useFeedbackMutation } from "~/hooks/use-feedback-mutation";
import { useSessionState } from "~/hooks/use-session-state";
import type { ChatInlineError } from "./chat-inline-error";
import type { MessageHistoryMeta } from "~/lib/messages/loading";

const getMetadataString = (metadata: unknown, key: string): string | undefined => {
	if (!metadata || typeof metadata !== "object") return undefined;
	const value = (metadata as Record<string, unknown>)[key];
	return typeof value === "string" ? value : undefined;
};

// Dynamic imports for components that are conditionally rendered
const ProviderModelSelector = dynamic(
	() =>
		import("./provider-model-selector").then(
			(mod) => mod.ProviderModelSelector,
		),
	{ ssr: false },
);

// Import ProcessedModel type for model processing
import type { ProcessedModel } from "./provider-model-selector";
import { getVisibleModels } from "~/ai/providers";
import type { ModelId } from "~/ai/providers";

const AuthPromptSelector = dynamic(
	() => import("./auth-prompt-selector").then((mod) => mod.AuthPromptSelector),
	{ ssr: false },
);

const RateLimitIndicator = dynamic(
	() => import("./rate-limit-indicator").then((mod) => mod.RateLimitIndicator),
	{ ssr: false },
);

const RateLimitDialog = dynamic(
	() => import("./rate-limit-dialog").then((mod) => mod.RateLimitDialog),
	{ ssr: false },
);

const ArtifactPane = dynamic(
	() => import("./artifact-pane").then((mod) => mod.ArtifactPane),
	{ ssr: false },
);

type UserInfo = ChatRouterOutputs["user"]["getUser"];
type UsageLimitsData = ChatRouterOutputs["usage"]["checkLimits"];

interface ChatInterfaceProps {
	agentId: string;
	session?: Session; // Optional - undefined for unauthenticated users
	fallbackSessionId?: string; // Used when session is undefined (unauthenticated/new sessions)
	initialMessages: LightfastAppChatUIMessage[];
	isNewSession: boolean;
	handleSessionCreation: (firstMessage: string) => void; // Required - pass no-op function for scenarios where session creation isn't needed
	user: UserInfo | null; // null for unauthenticated users
	onNewUserMessage?: (userMessage: LightfastAppChatUIMessage) => void; // Optional callback when user sends a message
	onNewAssistantMessage?: (assistantMessage: LightfastAppChatUIMessage) => void; // Optional callback when AI finishes responding
	onQuotaError?: (modelId: string) => void; // Callback when quota exceeded - allows rollback of optimistic updates
	onAssistantStreamError?: (info: {
		messageId?: string;
		category?: string;
	}) => void;
	onResumeStateChange?: (hasActiveStream: boolean) => void;
	usageLimits?: UsageLimitsData; // Optional pre-fetched usage limits data (for authenticated users)
	historyMeta?: MessageHistoryMeta;
	onLoadEntireHistory?: () => void;
	onOversizedMessageHydrated?: (args: {
		messageId: string;
		parts: LightfastAppChatUIMessage["parts"];
		charCount: number;
		tokenCount?: number;
	}) => void;
}

export function ChatInterface({
	agentId,
	session,
	fallbackSessionId,
	initialMessages,
	isNewSession,
	handleSessionCreation,
	user,
	onNewUserMessage,
	onNewAssistantMessage,
	onQuotaError,
	onAssistantStreamError,
	onResumeStateChange,
	usageLimits: externalUsageLimits,
	historyMeta,
	onLoadEntireHistory,
	onOversizedMessageHydrated,
}: ChatInterfaceProps) {
	// Use hook to manage session state (handles both authenticated and unauthenticated cases)
	const {
		sessionId,
		resume,
		hasActiveStream,
		setHasActiveStream,
		disableResume,
	} = useSessionState(session, fallbackSessionId);
	// Most errors escalate to the boundary; streaming/storage issues are handled inline

	// Hook for handling ALL errors via error boundaries
	const { throwToErrorBoundary } = useErrorBoundaryHandler();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	// Derive authentication status from user presence
	const isAuthenticated = user !== null;

	// Get unified billing context
	const billingContext = useBillingContext({
		externalUsageData: externalUsageLimits,
	});

	const fetchFullMessage = useCallback(
		async ({
			sessionId: targetSessionId,
			messageId,
		}: {
			sessionId: string;
			messageId: string;
		}) => {
				const message = await queryClient.fetchQuery(
					trpc.message.get.queryOptions({
						sessionId: targetSessionId,
						messageId,
					}),
				);

				const metadataFromServer: LightfastAppChatUIMessage["metadata"] =
					message.metadata;
				const baseMetadata = { ...metadataFromServer };
				const normalizedModelId =
					message.modelId ??
					(typeof baseMetadata.modelId === "string"
						? baseMetadata.modelId
						: undefined);

			return {
				id: message.id,
				role: message.role,
				parts: message.parts,
				metadata: {
					...baseMetadata,
					sessionId: targetSessionId,
					modelId: normalizedModelId,
				},
				modelId: normalizedModelId,
			} satisfies LightfastAppChatUIMessage;
		},
		[trpc],
	);

	// Streaming/storage errors surfaced inline in the conversation
	const [inlineErrors, setInlineErrors] = useState<ChatInlineError[]>([]);
	const [hasStreamAnimation, setHasStreamAnimation] = useState(false);
	const [pendingDisable, setPendingDisable] = useState(false);

	const addInlineError = useCallback(
		(error: ChatError) => {
			const metadata: Record<string, unknown> = error.metadata ?? {};

			const getStringMetadata = (key: string): string | undefined => {
				const value = metadata[key];
				return typeof value === "string" ? value : undefined;
			};

			const relatedAssistantMessageId = getStringMetadata("messageId");
			const relatedUserMessageId = getStringMetadata("userMessageId");
			const errorCode = error.errorCode ?? getStringMetadata("errorCode");
			const category = error.category ?? getStringMetadata("category");
			const severity = error.severity ?? getStringMetadata("severity");
			const source = error.source ?? getStringMetadata("source");

			setInlineErrors((current) => {
				const entry: ChatInlineError = {
					id: crypto.randomUUID(),
					error,
					relatedAssistantMessageId,
					relatedUserMessageId,
					category,
					severity,
					source,
					errorCode,
				};

				const deduped = current.filter((existing) => {
					if (
						entry.relatedAssistantMessageId &&
						existing.relatedAssistantMessageId ===
							entry.relatedAssistantMessageId
					) {
						return false;
					}
					if (
						entry.relatedUserMessageId &&
						existing.relatedUserMessageId === entry.relatedUserMessageId &&
						!entry.relatedAssistantMessageId &&
						!existing.relatedAssistantMessageId
					) {
						return false;
					}
					if (
						!entry.relatedAssistantMessageId &&
						!entry.relatedUserMessageId &&
						!existing.relatedAssistantMessageId &&
						!existing.relatedUserMessageId &&
						existing.error.type === entry.error.type &&
						(existing.category ?? null) === (entry.category ?? null)
					) {
						return false;
					}
					return true;
				});

				return [...deduped, entry];
			});
		},
		[setInlineErrors],
	);

	const dismissInlineError = useCallback(
		(errorId: string) => {
			setInlineErrors((current) =>
				current.filter((entry) => entry.id !== errorId),
			);
		},
		[setInlineErrors],
	);

	// Process models with accessibility information for the model selector
	const processedModels = useMemo((): ProcessedModel[] => {
		return getVisibleModels().map((model) => {
			const isAccessible = billingContext.models.isAccessible(
				model.id,
				model.accessLevel,
				model.billingTier,
			);
			const restrictionReason = billingContext.models.getRestrictionReason(
				model.id,
				model.accessLevel,
				model.billingTier,
			);

			return {
				...model,
				id: model.id as ModelId,
				isAccessible,
				restrictionReason,
				isPremium: model.billingTier === "premium",
				requiresAuth: model.accessLevel === "authenticated",
			};
		});
	}, [billingContext.models]);

	// Fetch artifacts through the tRPC API so we reuse authentication and caching
	const fetchArtifact = useCallback(
		async (artifactId: string): Promise<ArtifactApiResponse> => {
			try {
				const artifact = await queryClient.fetchQuery({
					...trpc.artifact.get.queryOptions({ id: artifactId }),
				});

				if (!artifact) {
					throw new Error("Artifact not found");
				}

				let content = "";
				if (typeof artifact.content === "string") {
					content = artifact.content;
				}

				return {
					id: artifact.id,
					title: artifact.title,
					content,
					kind: artifact.kind,
					createdAt: artifact.createdAt,
				};
			} catch (unknownError) {
				if (isUnauthorized(unknownError)) {
					throw new Error("Authentication required to access artifacts");
				}
				if (isNotFound(unknownError)) {
					throw new Error("Artifact not found");
				}
				if (isTRPCClientError(unknownError)) {
					throw new Error(getTRPCErrorMessage(unknownError));
				}
				if (unknownError instanceof Error) {
					throw unknownError;
				}
				throw new Error("Failed to load artifact");
			}
		},
		[queryClient, trpc],
	);

	// Data stream for artifact handling
	const { setDataStream } = useDataStream();

	// Artifact state management
	const {
		artifact,
		metadata,
		setMetadata,
		showArtifact,
		hideArtifact,
		updateArtifactContent,
		setArtifact,
	} = useArtifact();

	// Connect streaming data to artifact updates
	useArtifactStreaming({
		showArtifact,
		hideArtifact,
		updateArtifactContent,
		setArtifact,
		setMetadata,
	});

	// State for rate limit dialog
	const [showRateLimitDialog, setShowRateLimitDialog] = useState(false);

	// Web search toggle state
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);

	// Anonymous message limit tracking (only for unauthenticated users)
	const {
		messageCount,
		remainingMessages,
		incrementCount,
		hasReachedLimit,
		isLoading: isLimitLoading,
	} = useAnonymousMessageLimit();

	// Preload dialog image when user is close to limit (3 messages left)
	useEffect(() => {
		if (!isAuthenticated && remainingMessages <= 3 && remainingMessages > 0) {
			// Preload the image using Next.js Image preloader
			const img = new Image();
			img.src = "/og-bg-only.jpg";
		}
	}, [isAuthenticated, remainingMessages]);

	// Model selection with persistence
	const { selectedModelId, handleModelChange } =
		useModelSelection(isAuthenticated);

	const metricsTags = useMemo(
		() => ({
			agentId,
			modelId: selectedModelId,
			authenticated: isAuthenticated ? "true" : "false",
		}),
		[agentId, selectedModelId, isAuthenticated],
	);

	// Check if current model can be used (for UI state)
	const canUseCurrentModel = billingContext.isLoaded
		? billingContext.usage.canUseModel(selectedModelId)
		: { allowed: true };

	// Create transport for AI SDK v5
	// Uses session ID directly as the primary key
	const transport = useChatTransport({
		sessionId,
		agentId,
		webSearchEnabled,
	});

	// Use Vercel's useChat directly with transport
	const {
		messages,
		sendMessage: vercelSendMessage,
		status,
	} = useChat<LightfastAppChatUIMessage>({
		id: `${agentId}-${sessionId}`,
		transport,
		messages: initialMessages,
		resume,
		//		experimental_throttle: ,
		onError: (error) => {
			const chatError = ChatErrorHandler.handleError(error);
			const metadata = chatError.metadata;
			const category =
				chatError.category ?? getMetadataString(metadata, "category");
			const severity =
				chatError.severity ?? getMetadataString(metadata, "severity");
			const source = chatError.source ?? getMetadataString(metadata, "source");
				const failedMessageId = getMetadataString(metadata, "messageId");

			addBreadcrumb({
				category: "chat-ui",
				level: severity === "fatal" ? "error" : "warning",
				message: "Chat interface error",
				data: {
					agentId,
					sessionId,
					category,
					severity,
					source,
					errorCode: chatError.errorCode,
				},
			});

			const inlineStreamCategories = new Set([
				"stream",
				"persistence",
				"resume",
			]);
			const isStreamingRelated =
				category !== undefined && inlineStreamCategories.has(category);

			if (isStreamingRelated && category) {
				captureMessage("chat.ui.error.streaming", {
					level: "error",
					extra: {
						...metricsTags,
						category,
					},
				});
				console.error("[Streaming Error] Inline-stream failure detected:", {
					category,
					severity,
					source,
					statusCode: chatError.statusCode,
					message: chatError.message,
					details: chatError.details,
					metadata,
				});
				setDataStream([]);
				disableResume();
				setPendingDisable(false);
				onResumeStateChange?.(false);
				onAssistantStreamError?.({
					messageId: failedMessageId,
					category,
				});
				addInlineError(chatError);
				return;
			}

			if (chatError.type === ChatErrorType.USAGE_LIMIT_EXCEEDED) {
				console.warn("[ChatInterface] Quota exceeded, triggering rollback", {
					statusCode: chatError.statusCode,
					category,
					severity,
				});
				onQuotaError?.(selectedModelId);
				addInlineError(chatError);
				return;
			}

			const CRITICAL_ERROR_TYPES = [
				ChatErrorType.AUTHENTICATION,
				ChatErrorType.BOT_DETECTION,
				ChatErrorType.SECURITY_BLOCKED,
				ChatErrorType.MODEL_ACCESS_DENIED,
				// Rate limit is only critical for anonymous users
				...(isAuthenticated ? [] : [ChatErrorType.RATE_LIMIT]),
			];

			const fatalBySeverity = severity === "fatal";
			const fatalBySource = source === "guard";
			const fatalByType = CRITICAL_ERROR_TYPES.includes(chatError.type);

				if (fatalBySeverity || fatalBySource || fatalByType) {
				interface EnhancedError extends Error {
					statusCode?: number;
					type?: ChatErrorType;
					details?: string;
					metadata?: Record<string, unknown>;
				}
				const errorForBoundary = new Error(chatError.message) as EnhancedError;
				errorForBoundary.statusCode = chatError.statusCode;
				errorForBoundary.type = chatError.type;
				errorForBoundary.details = chatError.details;
				errorForBoundary.metadata = chatError.metadata;

				console.error("[Critical Error] Throwing to error boundary:", {
					type: chatError.type,
					statusCode: chatError.statusCode,
					severity,
					source,
					message: chatError.message,
				});

					captureMessage("Chat interface fatal error", {
						level: "error",
					});
					throwToErrorBoundary(errorForBoundary);
				}

			console.error("[Chat Error] Non-fatal error captured inline", {
				type: chatError.type,
				statusCode: chatError.statusCode,
				severity,
				source,
				category,
				message: chatError.message,
				details: chatError.details,
			});

			addInlineError(chatError);
		},
		onFinish: (event) => {
			// Pass the assistant message to the callback
			// This allows parent components to optimistically update the cache
			onNewAssistantMessage?.(event.message);
			if (!hasStreamAnimation) {
				setPendingDisable(false);
				disableResume();
				onResumeStateChange?.(false);
			}
		},
		onData: (dataPart) => {
			// Accumulate streaming data parts for artifact processing
			setDataStream((ds) => [...ds, dataPart]);
		},
	});

	const previousStatusRef = useRef(status);
	const streamStartedAtRef = useRef<number | null>(null);
	useEffect(() => {
		const previousStatus = previousStatusRef.current;
		if (status === "streaming" && previousStatus !== "streaming") {
			if (typeof performance !== "undefined") {
				streamStartedAtRef.current = performance.now();
			}
			addBreadcrumb({
				category: "chat-ui",
				message: "stream_started",
				data: {
					agentId,
					sessionId,
					modelId: selectedModelId,
				},
			});
			setHasActiveStream(true);
			onResumeStateChange?.(true);
			setPendingDisable(false);
		}
		if (status !== "streaming" && previousStatus === "streaming") {
			if (typeof performance !== "undefined" && streamStartedAtRef.current !== null) {
				const duration = performance.now() - streamStartedAtRef.current;
				addBreadcrumb({
					category: "chat-ui",
					message: "stream_duration",
					data: {
						...metricsTags,
						duration,
						finalStatus: status,
					},
				});
			}
			streamStartedAtRef.current = null;
			addBreadcrumb({
				category: "chat-ui",
				message: "stream_completed",
				data: {
					agentId,
					sessionId,
					modelId: selectedModelId,
					finalStatus: status,
				},
			});
			setPendingDisable(true);
		}
		previousStatusRef.current = status;
	}, [
		status,
		setHasActiveStream,
		onResumeStateChange,
		disableResume,
		metricsTags,
		agentId,
		sessionId,
		selectedModelId,
	]);

	useEffect(() => {
		if (!pendingDisable) {
			return;
		}
		if (status === "streaming" || status === "submitted") {
			return;
		}
		if (hasStreamAnimation) {
			return;
		}
		setPendingDisable(false);
		disableResume();
		onResumeStateChange?.(false);
	}, [
		pendingDisable,
		status,
		hasStreamAnimation,
		disableResume,
		onResumeStateChange,
	]);

	const handleStreamAnimationChange = useCallback(
		(isAnimating: boolean) => {
			setHasStreamAnimation(isAnimating);
			if (isAnimating) {
				setHasActiveStream(true);
				onResumeStateChange?.(true);
				return;
			}

			setHasActiveStream(false);
			onResumeStateChange?.(false);
		},
		[setHasActiveStream, onResumeStateChange],
	);

	// Fetch feedback for this session (only for authenticated users with existing sessions, after streaming completes)
	const { data: feedback } = useFeedbackQuery({
		sessionId,
		enabled: isAuthenticated && !isNewSession && status === "ready", // Only fetch feedback when streaming is complete
	});

	// Feedback mutation hooks with authentication-aware handlers
	const feedbackMutation = useFeedbackMutation({
		sessionId,
		isAuthenticated,
	});

	// AI SDK will handle resume automatically when resume={true} is passed to useChat

	const handleSendMessage = async (message: string) => {
		if (
			!message.trim() ||
			status === "streaming" ||
			status === "submitted" ||
			hasStreamAnimation
		) {
			return;
		}

		// For unauthenticated users, check anonymous message limit
		if (!isAuthenticated && hasReachedLimit) {
			addInlineError({
				type: ChatErrorType.RATE_LIMIT,
				message:
					"You've hit the anonymous message limit. Sign in to keep chatting.",
				retryable: false,
				details: undefined,
				metadata: { isAnonymous: true },
			});
			setShowRateLimitDialog(true);
			return;
		}

		// For authenticated users, check usage limits based on selected model
		if (isAuthenticated && billingContext.isLoaded) {
			const usageCheck = billingContext.usage.canUseModel(selectedModelId);
			if (!usageCheck.allowed) {
				addInlineError({
					type: ChatErrorType.USAGE_LIMIT_EXCEEDED,
					message:
						usageCheck.reason ??
						"You've reached your current usage limit for this model.",
					retryable: false,
					details: undefined,
					metadata: { modelId: selectedModelId },
				});
				return;
			}
		}

		addBreadcrumb({
			category: "chat-ui",
			message: "send_message",
			data: {
				agentId,
				sessionId,
				modelId: selectedModelId,
				length: message.length,
				webSearchEnabled,
			},
		});
		// Additional context stored as breadcrumb via send_message entry

		try {
			// Call handleSessionCreation when this is the first message in a new session
			// Only call when this is truly the first message (no existing messages)
			// Fires optimistically - backend will handle session creation if needed
			if (isNewSession && messages.length === 0) {
				handleSessionCreation(message);
			}

			// Generate UUID for the user message
			const userMessageId = crypto.randomUUID();

			// Create the user message object
			const userMessage: LightfastAppChatUIMessage = {
				role: "user",
				parts: [{ type: "text", text: message }],
				id: userMessageId,
			};

			// Call the callback to update cache BEFORE sending
			// This ensures the user message is in cache before assistant responds
			onNewUserMessage?.(userMessage);

			// Send message using Vercel's format
			await vercelSendMessage(userMessage, {
				body: {
					userMessageId,
					modelId: selectedModelId,
					webSearchEnabled,
				},
			});

			// Success breadcrumb already recorded above
			addBreadcrumb({
				category: "chat-ui",
				message: "send_message_success",
				data: {
					agentId,
					sessionId,
					modelId: selectedModelId,
				},
			});

			// Increment count for anonymous users after successful send
			if (!isAuthenticated) {
				incrementCount();
			}
		} catch (unknownError) {
			// Log and throw to error boundary
			const safeError =
				unknownError instanceof Error
					? unknownError
					: new Error(String(unknownError));
			ChatErrorHandler.handleError(unknownError);
			captureException(safeError, {
				contexts: {
					"chat-ui": {
						agentId,
						sessionId,
						modelId: selectedModelId,
					},
				},
			});
			throwToErrorBoundary(safeError);
		}
	};

	// Handle prompt input submission - converts PromptInput format to our handleSendMessage
	const handlePromptSubmit = async (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();

		if (!message.text?.trim()) {
			return;
		}

		// Clear the form immediately after preventing default
		event.currentTarget.reset();

		// Convert to our existing handleSendMessage format
		await handleSendMessage(message.text);
	};

	// Handle prompt input errors (both file upload errors and React form events)
	const handlePromptError = (
		errorOrEvent:
			| { code: "max_files" | "max_file_size" | "accept"; message: string }
			| FormEvent<HTMLFormElement>,
	) => {
		// Check if it's a file upload error (has 'code' property)
		if ("code" in errorOrEvent) {
			console.error("Prompt input error:", errorOrEvent);
			// Could integrate with toast system here if needed
		} else {
			// Handle React form events if needed
			console.error("Form error:", errorOrEvent);
		}
	};

	// Create model selector component - show auth prompt for unauthenticated users
	const modelSelector = isAuthenticated ? (
		<ProviderModelSelector
			value={selectedModelId}
			onValueChange={handleModelChange}
			models={processedModels}
			disabled={false} // Allow model selection even during streaming
			_isAuthenticated={isAuthenticated}
		/>
	) : (
		<AuthPromptSelector />
	);

	// Create the main chat content component
	// Determine the appropriate UI state:
	// 1. New session with no messages -> centered empty state
	// 2. Existing session with no messages -> conversation layout with empty state message
	// 3. Session with messages -> normal conversation layout
	const chatContent =
		messages.length === 0 && isNewSession ? (
			// For truly new chats (no messages yet), show centered layout
			<div className="h-full flex flex-col items-center justify-center bg-background">
				<div className="w-full max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
					<div className="mb-8">
						<ChatEmptyState
							prompt={
								user?.email
									? `Welcome back, ${user.email}`
									: "What can I do for you?"
							}
						/>
					</div>
					<PromptInput
						onSubmit={handlePromptSubmit}
						onError={handlePromptError}
						className={cn(
							"w-full border dark:shadow-md border-border/50 rounded-2xl overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
							"!divide-y-0 !shadow-sm",
						)}
					>
						<PromptInputBody className="flex flex-col">
							<div className="flex-1 max-h-[180px] overflow-y-auto scrollbar-thin">
								<PromptInputTextarea
									placeholder="Ask anything..."
									className={cn(
										"w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
										"!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
										"outline-none min-h-0 min-h-[72px]",
									)}
									style={{ lineHeight: "24px" }}
									maxLength={4000}
								/>
							</div>
							<PromptInputToolbar className="flex items-center justify-between p-2 bg-input-bg dark:bg-input-bg transition-[color,box-shadow]">
								{/* Left side tools */}
								<div className="flex items-center gap-2">
									<PromptInputButton
										variant={webSearchEnabled ? "secondary" : "outline"}
										onClick={() => {
											if (billingContext.features.webSearch.enabled) {
												setWebSearchEnabled(!webSearchEnabled);
											}
										}}
										disabled={!billingContext.features.webSearch.enabled}
										title={
											billingContext.features.webSearch.disabledReason ??
											undefined
										}
										className={cn(
											webSearchEnabled &&
												"bg-secondary text-secondary-foreground hover:bg-secondary/80",
											!billingContext.features.webSearch.enabled &&
												"opacity-60 cursor-not-allowed",
										)}
									>
										<Globe className="w-4 h-4" />
										Search
										{webSearchEnabled &&
											billingContext.features.webSearch.enabled && (
												<X
													className="w-3 h-3 ml-1 hover:opacity-70 cursor-pointer"
													onClick={(e) => {
														e.stopPropagation();
														setWebSearchEnabled(false);
													}}
												/>
											)}
									</PromptInputButton>
								</div>

								{/* Right side tools */}
								<PromptInputTools className="flex items-center gap-2">
									{modelSelector}
									<PromptInputSubmit
										status={status}
										disabled={
											status === "streaming" ||
											status === "submitted" ||
											hasStreamAnimation ||
											(!isAuthenticated && hasReachedLimit) ||
											(isAuthenticated && !canUseCurrentModel.allowed)
										}
										title={
											!canUseCurrentModel.allowed && isAuthenticated
												? "reason" in canUseCurrentModel
													? (canUseCurrentModel.reason ?? undefined)
													: undefined
												: undefined
										}
										size="icon"
										variant="outline"
										className="h-8 w-8 dark:border-border/50 rounded-full dark:shadow-sm"
									>
										<ArrowUp className="w-4 h-4" />
									</PromptInputSubmit>
								</PromptInputTools>
							</PromptInputToolbar>
						</PromptInputBody>
					</PromptInput>
					{/* Prompt suggestions - only visible on iPad and above (md breakpoint) */}
					<div className="hidden md:block relative mt-4 h-12">
						<div className="absolute top-0 left-0 right-0">
							<PromptSuggestions onSelectPrompt={handleSendMessage} />
						</div>
					</div>
				</div>
			</div>
		) : (
			// Thread view or chat with existing messages, OR existing session with no messages
			<div className="flex flex-col h-full bg-background">
				<ChatMessages
					messages={messages}
					status={status}
					feedback={feedback}
					onFeedbackSubmit={feedbackMutation.handleSubmit}
					onFeedbackRemove={feedbackMutation.handleRemove}
					_isAuthenticated={isAuthenticated}
					isExistingSessionWithNoMessages={
						messages.length === 0 && !isNewSession
					}
					hasActiveStream={hasActiveStream}
					onStreamAnimationChange={handleStreamAnimationChange}
					historyMeta={historyMeta}
					onLoadEntireHistory={onLoadEntireHistory}
					onOversizedMessageHydrated={onOversizedMessageHydrated}
					fetchFullMessage={fetchFullMessage}
					onArtifactClick={
						isAuthenticated
							? async (artifactId) => {
									try {
										// Fetch artifact data using clean REST API
										const artifactData = await fetchArtifact(artifactId);

										// Show the artifact with the fetched data
										showArtifact({
											documentId: artifactData.id,
											title: artifactData.title,
											kind: artifactData.kind,
											content: artifactData.content,
											status: "idle",
											boundingBox: {
												top: 100,
												left: 100,
												width: 300,
												height: 200,
											},
										});
									} catch (unknownError) {
										// Clean error handling with user-friendly messages
										const errorMessage =
											unknownError instanceof Error
												? unknownError.message
												: "Unknown error occurred";
										console.error("Artifact fetch failed:", errorMessage);

										// Could optionally show toast notification here
										// toast.error(`Failed to load artifact: ${errorMessage}`);
									}
								}
							: undefined // Disable artifact clicking for unauthenticated users
					}
					inlineErrors={inlineErrors}
					onInlineErrorDismiss={dismissInlineError}
				/>
				<div className="relative">
					<div className="max-w-3xl mx-auto px-1.5 md:px-3 lg:px-6 xl:px-10">
						{/* Show rate limit indicator for anonymous users - only shows when messages exist (not on new chat) */}
						{!isAuthenticated && !isLimitLoading && messageCount > 0 && (
							<div className="mb-2">
								<RateLimitIndicator remainingMessages={remainingMessages} />
							</div>
						)}

						<div className="flex-shrink-0">
							<div className="chat-container relative px-1.5 md:px-3 lg:px-5 xl:px-8">
								{/* Gradient overlay */}
								{isAuthenticated && (
									<div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none z-10">
										<div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
									</div>
								)}

								<PromptInput
									onSubmit={handlePromptSubmit}
									onError={handlePromptError}
									className={cn(
										"w-full border dark:shadow-md border-border/50 rounded-2xl overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
										"!divide-y-0 !shadow-sm",
									)}
								>
									<PromptInputBody className="flex flex-col">
										<div className="flex-1 max-h-[180px] overflow-y-auto scrollbar-thin">
											<PromptInputTextarea
												placeholder={
													messages.length === 0
														? "Ask anything..."
														: "Continue the conversation..."
												}
												className={cn(
													"w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
													"!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
													"outline-none min-h-0 min-h-[72px]",
												)}
												style={{ lineHeight: "24px" }}
												maxLength={4000}
											/>
										</div>
										<PromptInputToolbar className="flex items-center justify-between p-2 bg-input-bg dark:bg-input-bg transition-[color,box-shadow]">
											{/* Left side tools */}
											<div className="flex items-center gap-2">
												<PromptInputButton
													variant={webSearchEnabled ? "secondary" : "outline"}
													onClick={() => {
														if (billingContext.features.webSearch.enabled) {
															setWebSearchEnabled(!webSearchEnabled);
														}
													}}
													disabled={!billingContext.features.webSearch.enabled}
													title={
														billingContext.features.webSearch.disabledReason ??
														undefined
													}
													className={cn(
														webSearchEnabled &&
															"bg-secondary text-secondary-foreground hover:bg-secondary/80",
														!billingContext.features.webSearch.enabled &&
															"opacity-60 cursor-not-allowed",
													)}
												>
													<Globe className="w-4 h-4" />
													Search
													{webSearchEnabled &&
														billingContext.features.webSearch.enabled && (
															<X
																className="w-3 h-3 ml-1 hover:opacity-70 cursor-pointer"
																onClick={(e) => {
																	e.stopPropagation();
																	setWebSearchEnabled(false);
																}}
															/>
														)}
												</PromptInputButton>
											</div>

											{/* Right side tools */}
											<PromptInputTools className="flex items-center gap-2">
												{modelSelector}
												<PromptInputSubmit
													status={status}
													disabled={
														status === "streaming" ||
														status === "submitted" ||
														hasStreamAnimation ||
														(!isAuthenticated && hasReachedLimit) ||
														(isAuthenticated && !canUseCurrentModel.allowed)
													}
													title={
														!canUseCurrentModel.allowed && isAuthenticated
															? "reason" in canUseCurrentModel
																? (canUseCurrentModel.reason ?? undefined)
																: undefined
															: undefined
													}
													size="icon"
													variant="outline"
													className="h-8 w-8 dark:border-border/50 rounded-full dark:shadow-sm"
												>
													<ArrowUp className="w-4 h-4" />
												</PromptInputSubmit>
											</PromptInputTools>
										</PromptInputToolbar>
									</PromptInputBody>
								</PromptInput>
							</div>

							{/* Description text */}
							{messages.length > 0 && (
								<div className="chat-container px-1.5 md:px-3 lg:px-5 xl:px-8">
									<p className="text-xs text-muted-foreground text-center mt-2">
										Lightfast may make mistakes. Use with discretion.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);

	// Return the full layout with artifact support
	return (
		<div className="flex h-full min-h-0 w-full overflow-hidden">
			{/* Chat interface area */}
			<div
				className="min-w-0 flex-shrink-0 h-full min-h-0 transition-[width] duration-300 ease-out"
				style={{
					width: isAuthenticated && artifact.isVisible ? "50%" : "100%",
				}}
			>
				{chatContent}
			</div>

			{/* Artifact panel - rendered on demand for authenticated users */}
			<ArtifactPane
				artifact={artifact}
				metadata={metadata}
				setMetadata={setMetadata}
				hideArtifact={hideArtifact}
				showArtifact={showArtifact}
				fetchArtifact={fetchArtifact}
				sessionId={sessionId}
				isAuthenticated={isAuthenticated}
			/>

			{/* Rate limit dialog - shown when anonymous user hits limit */}
			<RateLimitDialog
				open={showRateLimitDialog}
				onOpenChange={setShowRateLimitDialog}
			/>
		</div>
	);
}
