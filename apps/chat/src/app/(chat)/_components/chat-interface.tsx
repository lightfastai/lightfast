"use client";

import dynamic from "next/dynamic";
import {
	addBreadcrumb,
	captureException,
	captureMessage,
} from "@sentry/nextjs";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import type { FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { useAnonymousMessageLimit } from "~/hooks/use-anonymous-message-limit";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useErrorBoundaryHandler } from "~/hooks/use-error-boundary-handler";
import { useBillingContext } from "~/hooks/use-billing-context";
import { ChatErrorHandler } from "~/lib/errors/chat-error-handler";
import { ChatErrorType } from "@repo/chat-ai-types/errors";
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
import { useInlineErrors } from "~/hooks/use-inline-errors";
import { useAttachmentUpload } from "~/hooks/use-attachment-upload";
import { useStreamLifecycle } from "~/hooks/use-stream-lifecycle";
import { validateAttachments } from "~/lib/chat/message-validation";
import {
	findUnresolvedAttachment,
	convertAttachmentsToUploaded,
	createMessageParts,
	generateSessionSeedText,
} from "~/lib/chat/attachment-processing";
import type { UploadedAttachment } from "~/lib/chat/attachment-processing";
import { ChatNewSessionView } from "./chat-new-session-view";
import { ChatExistingSessionView } from "./chat-existing-session-view";
import { toast } from "sonner";

const ProviderModelSelector = dynamic(
	() =>
		import("./provider-model-selector").then(
			(mod) => mod.ProviderModelSelector,
		),
	{ ssr: false },
);

const AuthPromptSelector = dynamic(
	() => import("./auth-prompt-selector").then((mod) => mod.AuthPromptSelector),
	{ ssr: false },
);

const getMetadataString = (
	metadata: unknown,
	key: string,
): string | undefined => {
	if (!metadata || typeof metadata !== "object") return undefined;
	const value = (metadata as Record<string, unknown>)[key];
	return typeof value === "string" ? value : undefined;
};

// Import model processing types
import { getModelConfig, getVisibleModels } from "~/ai/providers";
import type { ModelId, ChatProcessedModel } from "~/ai/providers";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENT_COUNT,
	IMAGE_ACCEPT,
	PDF_ACCEPT,
} from "@repo/chat-ai-types/attachments";

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
}: ChatInterfaceProps) {
	// Store callback refs to avoid dependency loop issues
	const onResumeStateChangeRef = useRef(onResumeStateChange);
	useEffect(() => {
		onResumeStateChangeRef.current = onResumeStateChange;
	}, [onResumeStateChange]);

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

	// Streaming/storage errors surfaced inline in the conversation
	const { inlineErrors, addInlineError, dismissInlineError } =
		useInlineErrors();
	const [hasStreamAnimation, setHasStreamAnimation] = useState(false);

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

	// Web search toggle state - simplified now that it's decoupled from attachments
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
	const hasPreloadedImage = useRef(false);
	useEffect(() => {
		if (
			!isAuthenticated &&
			remainingMessages <= 3 &&
			remainingMessages > 0 &&
			!hasPreloadedImage.current
		) {
			// Preload the image using Next.js Image preloader
			const img = new Image();
			img.src = "/og-bg-only.jpg";
			hasPreloadedImage.current = true;

			return () => {
				// Cancel loading if component unmounts before image loads
				img.src = "";
			};
		}
	}, [isAuthenticated, remainingMessages]);

	// Model selection with persistence
	const { selectedModelId, handleModelChange } =
		useModelSelection(isAuthenticated);

	// Invalidate usage query when model changes to ensure fresh quota data
	// This prevents showing stale quota after model switch (30s cache window)
	const previousModelIdRef = useRef(selectedModelId);
	useEffect(() => {
		// Only invalidate if model actually changed (not on initial render or billing context changes)
		const modelChanged = previousModelIdRef.current !== selectedModelId;
		previousModelIdRef.current = selectedModelId;

		if (!modelChanged || !isAuthenticated || !billingContext.isLoaded) {
			return;
		}

		// Invalidate usage limits to refresh quota display
		void queryClient.invalidateQueries({
			predicate: (query) =>
				query.queryKey[0] === "usage" && query.queryKey[1] === "checkLimits",
		});
	}, [selectedModelId, isAuthenticated, billingContext.isLoaded, queryClient]);

	const selectedModelConfig = useMemo(() => {
		return getModelConfig(selectedModelId);
	}, [selectedModelId]);

	const supportsImageAttachments = selectedModelConfig.features.vision;
	const supportsPdfAttachments = selectedModelConfig.features.pdfSupport;
	const attachmentAccept = useMemo(() => {
		const types: string[] = [];
		if (supportsImageAttachments) {
			types.push(IMAGE_ACCEPT);
		}
		if (supportsPdfAttachments) {
			types.push(PDF_ACCEPT);
		}
		const result = types.join(",");
		// Return undefined if no types supported (prevents accept="" which allows all files)
		return result.length > 0 ? result : undefined;
	}, [supportsImageAttachments, supportsPdfAttachments]);

	const attachmentsAllowed = supportsImageAttachments || supportsPdfAttachments;

	// Process models with accessibility information for the model selector
	const processedModels = useMemo((): ChatProcessedModel[] => {
		return getVisibleModels().map((model): ChatProcessedModel => {
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

	// Attachment upload hook
	const { handleAttachmentUpload, isUploadingAttachments } =
		useAttachmentUpload({
			selectedModelId,
		});

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

	// Check if web search can be used (requires both feature access AND quota)
	const canUseWebSearch = useMemo(() => {
		if (!billingContext.features.webSearch.enabled) {
			return {
				allowed: false,
				reason:
					billingContext.features.webSearch.disabledReason ??
					"Web search not available",
			};
		}

		// If authenticated, also check if user has any remaining quota
		if (isAuthenticated && billingContext.isLoaded) {
			const hasAnyQuota =
				billingContext.usage.remainingMessages.nonPremium > 0 ||
				billingContext.usage.remainingMessages.premium > 0;

			if (!hasAnyQuota) {
				return {
					allowed: false,
					reason: "No message quota remaining. Upgrade or wait for next month.",
				};
			}
		}

		return { allowed: true, reason: null };
	}, [billingContext, isAuthenticated]);

	// Create transport for AI SDK v5
	// Uses session ID directly as the primary key
	// Note: webSearchEnabled is passed per-message in request body, not in transport
	const transport = useChatTransport({
		sessionId,
		agentId,
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
				onResumeStateChangeRef.current?.(false);
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
			// Note: Resume disabling is handled by the consolidated effect above
			// which waits for both stream AND animation to complete
		},
		onData: (dataPart) => {
			// Accumulate streaming data parts for artifact processing
			setDataStream((ds) => [...ds, dataPart]);
		},
	});

	const isPromptSubmissionDisabled =
		status === "streaming" ||
		status === "submitted" ||
		hasStreamAnimation ||
		isUploadingAttachments ||
		(!isAuthenticated && hasReachedLimit) ||
		(isAuthenticated && !canUseCurrentModel.allowed);

	// Stream lifecycle tracking
	useStreamLifecycle({
		status,
		agentId,
		sessionId,
		selectedModelId,
		metricsTags,
		setHasActiveStream,
		onResumeStateChange,
		disableResume,
	});

	// Disable resume when BOTH stream and animation complete
	// This consolidates the previous dual-effect state machine into a single effect
	const previousStreamActiveRef = useRef(false);
	const previousHasAnimationRef = useRef(false);

	useEffect(() => {
		const streamActive = status === "streaming" || status === "submitted";
		const wasActive = previousStreamActiveRef.current || previousHasAnimationRef.current;
		const isNowInactive = !streamActive && !hasStreamAnimation;

		// Only disable resume when transitioning from active to inactive
		// (not on every render when already inactive)
		if (wasActive && isNowInactive) {
			disableResume();
			onResumeStateChangeRef.current?.(false);
		}

		previousStreamActiveRef.current = streamActive;
		previousHasAnimationRef.current = hasStreamAnimation;
	}, [status, hasStreamAnimation, disableResume]);

	const handleStreamAnimationChange = useCallback(
		(isAnimating: boolean) => {
			setHasStreamAnimation(isAnimating);
			if (isAnimating) {
				setHasActiveStream(true);
				onResumeStateChangeRef.current?.(true);
				return;
			}

			setHasActiveStream(false);
			onResumeStateChangeRef.current?.(false);
		},
		[setHasActiveStream],
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

	const handleSendMessage = (input: string | PromptInputMessage): boolean => {
		const text = typeof input === "string" ? input : (input.text ?? "");
		const trimmedText = text.trim();
		const attachments =
			typeof input === "string" ? [] : (input.attachments ?? []);
		const hasText = trimmedText.length > 0;
		const hasAttachments = attachments.length > 0;

		if (
			(!hasText && !hasAttachments) ||
			status === "streaming" ||
			status === "submitted" ||
			hasStreamAnimation ||
			isUploadingAttachments
		) {
			return false;
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
			return false;
		}

		// For authenticated users, check usage limits based on selected model
		if (isAuthenticated && billingContext.isLoaded) {
			const usageCheck = billingContext.usage.canUseModel(selectedModelId);
			if (!usageCheck.allowed) {
				toast.error("Usage limit reached", {
					description:
						usageCheck.reason ??
						"You've reached your current usage limit for this model.",
					duration: 5000,
				});
				return false;
			}
		}

		// Fast-fail checks in order of importance
		if (hasAttachments && !attachmentsAllowed) {
			toast.error("Attachments not supported", {
				description: "The selected model does not support file attachments.",
				duration: 4000,
			});
			return false;
		}

		// Validate all attachments before checking billing/features
		// This gives immediate feedback on file issues
		if (hasAttachments) {
			const validationError = validateAttachments(attachments, {
				supportsImageAttachments,
				supportsPdfAttachments,
			});

			if (validationError) {
				toast.error(validationError.message, {
					description: validationError.details,
					duration: 4000,
				});
				return false;
			}
		}

		// Check if attachments are allowed for user's plan
		// This check happens after file validation to give clear, relevant error messages
		if (hasAttachments && !billingContext.features.attachments.enabled) {
			toast.error("Attachments not available", {
				description:
					billingContext.features.attachments.disabledReason ??
					"File attachments are not available on your current plan.",
				duration: 5000,
			});
			return false;
		}

		// Web search state is independent from attachments
		const nextWebSearchEnabled = webSearchEnabled;

		addBreadcrumb({
			category: "chat-ui",
			message: "send_message",
			data: {
				agentId,
				sessionId,
				modelId: selectedModelId,
				length: trimmedText.length,
				attachmentCount: attachments.length,
				webSearchEnabled: nextWebSearchEnabled,
			},
		});

		let uploadedAttachments: UploadedAttachment[] = [];

		try {
			if (hasAttachments) {
				// Check for empty attachments array (shouldn't happen, but defensive)
				if (attachments.length === 0) {
					toast.error("No attachments", {
						description:
							"Please add at least one file or remove the attachment.",
						duration: 4000,
					});
					return false;
				}

				// Check for unresolved attachments
				const unresolved = findUnresolvedAttachment(attachments);
				if (unresolved) {
					toast.error("Upload in progress", {
						description: `"${unresolved.filename}" is still uploading. Please wait before sending.`,
						duration: 4000,
					});
					return false;
				}

				// Convert attachments to uploaded format
				uploadedAttachments = convertAttachmentsToUploaded(attachments);

				// Verify conversion succeeded
				if (uploadedAttachments.length === 0 && attachments.length > 0) {
					toast.error("Attachment error", {
						description:
							"Failed to process attachments. Please try re-uploading.",
						duration: 4000,
					});
					return false;
				}
			}

			// Handle session creation for new sessions
			if (isNewSession && messages.length === 0) {
				const seedText = generateSessionSeedText(
					trimmedText,
					uploadedAttachments,
				);
				handleSessionCreation(seedText);
			}

			// Create user message
			const userMessageId = crypto.randomUUID();
			const userMessageParts = createMessageParts(
				trimmedText,
				uploadedAttachments,
			);

			const userMessage: LightfastAppChatUIMessage = {
				role: "user",
				parts: userMessageParts,
				id: userMessageId,
			};

			onNewUserMessage?.(userMessage);

			const requestBody: Record<string, unknown> = {
				userMessageId,
				modelId: selectedModelId,
				webSearchEnabled: nextWebSearchEnabled,
			};

			if (uploadedAttachments.length > 0) {
				requestBody.attachments = uploadedAttachments.map((uploaded) => ({
					id: uploaded.id,
					storagePath: uploaded.storagePath,
					size: uploaded.size,
					contentType: uploaded.contentType,
					filename: uploaded.filename ?? null,
					metadata: uploaded.metadata,
				}));
			}

			// Start sending message (don't await - fire and forget)
			// This allows form to clear immediately while streaming happens in background
			vercelSendMessage(userMessage, {
				body: requestBody,
			})
				.then(() => {
					// Log success after streaming completes
					addBreadcrumb({
						category: "chat-ui",
						message: "send_message_success",
						data: {
							agentId,
							sessionId,
							modelId: selectedModelId,
							attachmentCount: uploadedAttachments.length,
						},
					});
				})
				.catch((error) => {
					// Errors during streaming are handled by useChat's onError
					console.error("[handleSendMessage] Stream error:", error);
				});

			if (!isAuthenticated) {
				incrementCount();
			}

			// Return true immediately - message queued successfully, form can clear
			return true;
		} catch (unknownError) {
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
			return false;
		}
	};

	// Handle prompt input submission - converts PromptInput format to our handleSendMessage
	// Must be async to match component prop signature, but doesn't await (form clears synchronously)
	const handlePromptSubmit = async (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	): Promise<void> => {
		// eslint-disable-line @typescript-eslint/require-await
		event.preventDefault();

		// Capture form element reference for reset
		const formElement = event.currentTarget;

		const text = message.text ?? "";
		const hasText = text.trim().length > 0;
		const hasAttachments = Boolean(message.attachments?.length);

		if (isPromptSubmissionDisabled || (!hasText && !hasAttachments)) {
			return;
		}

		// CRITICAL: Synchronous check for unresolved attachments BEFORE calling handleSendMessage
		// RACE CONDITION PROTECTION: Prevents submission while attachments are uploading
		//
		// Why this is needed:
		// 1. isUploadingAttachments state is async and may lag behind actual upload state
		// 2. User can rapid-fire submit (e.g., pressing Enter multiple times)
		// 3. State updates happen after event handlers complete
		//
		// This synchronous check inspects the actual attachment data structure,
		// not the async state hook, providing a last-line defense against race conditions.
		if (hasAttachments && message.attachments) {
			const unresolved = findUnresolvedAttachment(message.attachments);
			if (unresolved) {
				// Don't proceed - show error and keep form populated with attachments
				toast.error("Upload in progress", {
					description: `"${unresolved.filename}" is still uploading. Please wait before sending.`,
					duration: 4000,
				});
				return; // Exit early - form stays intact, attachments preserved
			}
		}

		// Send message - returns true if validation passed and message queued
		// Form clears immediately, streaming happens in background
		const success = handleSendMessage(message);

		// Clear form only if message was successfully queued
		// On validation errors, form stays populated for retry
		if (success) {
			formElement.reset();
		}
	};

	// Handle prompt input errors
	const handlePromptError = (err: {
		code: "max_files" | "max_file_size" | "accept" | "upload_failed";
		message: string;
	}) => {
		console.error("Prompt input error:", err);

		let userMessage = err.message;
		let details: string | undefined;

		switch (err.code) {
			case "max_files":
				userMessage = `Maximum ${MAX_ATTACHMENT_COUNT} files allowed`;
				details = `Please select ${MAX_ATTACHMENT_COUNT} or fewer files`;
				break;
			case "max_file_size":
				userMessage = "File size limit exceeded";
				details = `Each file must be under ${Math.floor(
					MAX_ATTACHMENT_BYTES / (1024 * 1024),
				)}MB`;
				break;
			case "accept":
				if (supportsImageAttachments && supportsPdfAttachments) {
					userMessage = "Invalid file type";
					details = "Only images and PDFs are supported for this model";
				} else if (supportsImageAttachments) {
					userMessage = "Invalid file type";
					details = "Only images are supported for this model";
				} else if (supportsPdfAttachments) {
					userMessage = "Invalid file type";
					details = "Only PDFs are supported for this model";
				} else {
					userMessage = "File attachments not supported";
					details = "This model does not support file attachments";
				}
				break;
			case "upload_failed":
				userMessage = "Upload failed";
				details =
					err.message || "Unable to upload attachment. Please try again.";
				break;
		}

		// Use toast instead of inline error for pre-flight validation
		toast.error(userMessage, {
			description: details,
			duration: 5000,
		});
	};

	// Create model selector component - show auth prompt for unauthenticated users
	const modelSelector = isAuthenticated ? (
		<ProviderModelSelector
			value={selectedModelId}
			onValueChange={handleModelChange}
			models={processedModels}
			disabled={false}
			_isAuthenticated={isAuthenticated}
		/>
	) : (
		<AuthPromptSelector />
	);

	// Prepare rate limit indicator for anonymous users
	const rateLimitIndicator =
		!isAuthenticated && !isLimitLoading && messageCount > 0 ? (
			<div className="mb-2">
				<RateLimitIndicator remainingMessages={remainingMessages} />
			</div>
		) : null;

	// Determine attachment button state
	const attachmentButtonDisabled =
		!attachmentsAllowed ||
		!billingContext.features.attachments.enabled ||
		isUploadingAttachments;
	const attachmentDisabledReason = !billingContext.features.attachments.enabled
		? (billingContext.features.attachments.disabledReason ??
			"Attachments not available")
		: !attachmentsAllowed
			? "The selected model does not support file attachments"
			: isUploadingAttachments
				? "Uploading..."
				: undefined;

	// Determine submit button state
	const isSubmitDisabled =
		status === "streaming" ||
		isUploadingAttachments ||
		!canUseCurrentModel.allowed ||
		(!isAuthenticated && hasReachedLimit);

	const submitDisabledReason = isUploadingAttachments
		? "Uploading attachments..."
		: !canUseCurrentModel.allowed
			? "reason" in canUseCurrentModel
				? (canUseCurrentModel.reason ?? "Cannot use this model")
				: "Cannot use this model"
			: !isAuthenticated && hasReachedLimit
				? "Message limit reached"
				: status === "streaming"
					? "Generating response..."
					: undefined;

	// Memoized artifact click handler for authenticated users
	const handleArtifactClick = useCallback(
		async (artifactId: string) => {
			if (!isAuthenticated) return;

			try {
				const artifactData = await fetchArtifact(artifactId);
				// Calculate responsive bounding box based on viewport
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;
				showArtifact({
					documentId: artifactData.id,
					title: artifactData.title,
					kind: artifactData.kind,
					content: artifactData.content,
					status: "idle",
					boundingBox: {
						top: Math.max(60, viewportHeight * 0.1),
						left: Math.max(60, viewportWidth * 0.05),
						width: Math.min(400, viewportWidth * 0.4),
						height: Math.min(300, viewportHeight * 0.4),
					},
				});
			} catch (unknownError) {
				const errorMessage =
					unknownError instanceof Error
						? unknownError.message
						: "Failed to load artifact";

				toast.error("Unable to load artifact", {
					description: errorMessage,
					duration: 4000,
				});

				console.error("Artifact fetch failed:", errorMessage);
			}
		},
		[isAuthenticated, fetchArtifact, showArtifact],
	);

	// Wrapper to match expected signature for onSendMessage prop (ignores return value)
	const handleSendMessageVoid = useCallback(
		// eslint-disable-next-line @typescript-eslint/require-await
		async (input: string | PromptInputMessage): Promise<void> => {
			handleSendMessage(input);
		},
		[],
	);

	// Create the main chat content component using extracted view components
	const chatContent =
		messages.length === 0 && isNewSession ? (
			<ChatNewSessionView
				userEmail={user?.email ?? undefined}
				onSendMessage={handleSendMessageVoid}
				onPromptSubmit={handlePromptSubmit}
				onPromptError={handlePromptError}
				onAttachmentUpload={handleAttachmentUpload}
				attachmentAccept={attachmentAccept}
				attachmentButtonDisabled={attachmentButtonDisabled}
				attachmentDisabledReason={attachmentDisabledReason}
				webSearchEnabled={webSearchEnabled}
				webSearchAllowed={canUseWebSearch.allowed}
				webSearchDisabledReason={canUseWebSearch.reason ?? undefined}
				onWebSearchToggle={() => setWebSearchEnabled((prev) => !prev)}
				modelSelector={modelSelector}
				status={status}
				isSubmitDisabled={isSubmitDisabled}
				submitDisabledReason={submitDisabledReason}
			/>
		) : (
			<ChatExistingSessionView
				messages={messages}
				status={status}
				feedback={feedback}
				onFeedbackSubmit={feedbackMutation.handleSubmit}
				onFeedbackRemove={feedbackMutation.handleRemove}
				isAuthenticated={isAuthenticated}
				isExistingSessionWithNoMessages={messages.length === 0 && !isNewSession}
				hasActiveStream={hasActiveStream}
				onStreamAnimationChange={handleStreamAnimationChange}
				onArtifactClick={isAuthenticated ? handleArtifactClick : undefined}
				inlineErrors={inlineErrors}
				onInlineErrorDismiss={dismissInlineError}
				onPromptSubmit={handlePromptSubmit}
				onPromptError={handlePromptError}
				onAttachmentUpload={handleAttachmentUpload}
				attachmentAccept={attachmentAccept}
				attachmentButtonDisabled={attachmentButtonDisabled}
				attachmentDisabledReason={attachmentDisabledReason}
				webSearchEnabled={webSearchEnabled}
				webSearchAllowed={canUseWebSearch.allowed}
				webSearchDisabledReason={canUseWebSearch.reason ?? undefined}
				onWebSearchToggle={() => setWebSearchEnabled((prev) => !prev)}
				modelSelector={modelSelector}
				isSubmitDisabled={isSubmitDisabled}
				submitDisabledReason={submitDisabledReason}
				rateLimitIndicator={rateLimitIndicator}
			/>
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
