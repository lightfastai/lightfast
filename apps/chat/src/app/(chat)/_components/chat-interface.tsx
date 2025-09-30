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
	PromptInputAttachments,
	PromptInputAttachment,
	usePromptInputAttachments,
} from "@repo/ui/components/ai-elements/prompt-input";
import type {
	PromptInputMessage,
	PromptInputAttachmentPayload,
	PromptInputAttachmentItem,
} from "@repo/ui/components/ai-elements/prompt-input";
import type { FormEvent } from "react";
import type { JSONValue } from "ai";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp, Globe, PaperclipIcon, X } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import {
	useState,
	useMemo,
	useEffect,
	useRef,
	useCallback,
} from "react";
import { nanoid } from "nanoid";
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
import { getVisibleModels, getModelConfig } from "~/ai/providers";
import type { ModelId } from "~/ai/providers";
import {
	MAX_ATTACHMENT_BYTES,
	MAX_ATTACHMENT_COUNT,
	ensureAttachmentAllowed,
	inferAttachmentKind,
} from "@repo/chat-ai-types";

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

const IMAGE_ACCEPT = "image/*";
const PDF_ACCEPT = "application/pdf";

interface UploadedAttachment {
	id: string;
	url: string;
	storagePath: string;
	size: number;
	contentType: string;
	filename?: string;
	metadata: Record<string, JSONValue> | null;
}

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
		return types.join(",");
	}, [supportsImageAttachments, supportsPdfAttachments]);

	const attachmentsAllowed = supportsImageAttachments || supportsPdfAttachments;
	const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
	const attachmentUploadCounterRef = useRef(0);

	const attachmentButtonDisabled =
		!attachmentsAllowed ||
		!billingContext.features.webSearch.enabled ||
		isUploadingAttachments;

	const attachmentDisabledReason = useMemo(() => {
		if (!attachmentsAllowed) {
			return "Selected model does not support attachments.";
		}
		if (!billingContext.features.webSearch.enabled) {
			return (
				billingContext.features.webSearch.disabledReason ??
				"Web search must be enabled to attach files."
			);
		}
		if (isUploadingAttachments) {
			return "Uploading attachments…";
		}
		return undefined;
	}, [
		attachmentsAllowed,
		billingContext.features.webSearch.disabledReason,
		billingContext.features.webSearch.enabled,
		isUploadingAttachments,
	]);

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

	const isPromptSubmissionDisabled =
		status === "streaming" ||
		status === "submitted" ||
		hasStreamAnimation ||
		isUploadingAttachments ||
		(!isAuthenticated && hasReachedLimit) ||
		(isAuthenticated && !canUseCurrentModel.allowed);

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

	const handleSendMessage = async (
		input: string | PromptInputMessage,
	): Promise<void> => {
		const text = typeof input === "string" ? input : input.text ?? "";
		const trimmedText = text.trim();
		const attachments =
			typeof input === "string" ? [] : input.attachments ?? [];
		const hasText = trimmedText.length > 0;
		const hasAttachments = attachments.length > 0;

		if (
			(!hasText && !hasAttachments) ||
			status === "streaming" ||
			status === "submitted" ||
			hasStreamAnimation ||
			isUploadingAttachments
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

		if (hasAttachments && !attachmentsAllowed) {
			addInlineError({
				type: ChatErrorType.INVALID_REQUEST,
				message: "The selected model does not support attachments.",
				retryable: false,
				details: undefined,
				metadata: { modelId: selectedModelId },
			});
			return;
		}

		if (
			hasAttachments &&
			!billingContext.features.webSearch.enabled
		) {
			addInlineError({
				type: ChatErrorType.INVALID_REQUEST,
				message:
					billingContext.features.webSearch.disabledReason ??
					"Attachments require web search, which is unavailable for your account.",
				retryable: false,
				details: undefined,
				metadata: { feature: "web-search", modelId: selectedModelId },
			});
			return;
		}

		for (const attachment of attachments) {
			const mediaType = attachment.mediaType;
			const filename = attachment.filename ?? "attachment";
		const size = attachment.size;
		const kind = inferAttachmentKind(mediaType, filename);

		if (typeof size === "number" && size > MAX_ATTACHMENT_BYTES) {
			addInlineError({
				type: ChatErrorType.INVALID_REQUEST,
				message: `"${filename}" is too large. Attachments must be under ${Math.floor(
					MAX_ATTACHMENT_BYTES / (1024 * 1024),
				)}MB.`,
				retryable: false,
				details: undefined,
				metadata: { filename, kind },
			});
			return;
		}

		if (typeof size !== "number") {
			addInlineError({
				type: ChatErrorType.INVALID_REQUEST,
				message: `Unable to determine the size of "${filename}". Please reattach the file.`,
				retryable: false,
				details: undefined,
				metadata: { filename, kind },
			});
			return;
		}

			const allowed = ensureAttachmentAllowed(kind, {
				allowImages: supportsImageAttachments,
				allowPdf: supportsPdfAttachments,
			});

			if (!allowed) {
				let errorMessage = "Only images and PDF files can be attached.";
				if (kind === "image" && !supportsImageAttachments) {
					errorMessage = "This model does not support image attachments.";
				} else if (kind === "pdf" && !supportsPdfAttachments) {
					errorMessage = "This model does not support PDF attachments.";
				}

				addInlineError({
					type: ChatErrorType.INVALID_REQUEST,
					message: errorMessage,
					retryable: false,
					details: undefined,
					metadata: { filename, mediaType, kind },
				});
				return;
			}
		}

		const nextWebSearchEnabled = hasAttachments
			? true
			: webSearchEnabled;

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
					const unresolved = attachments.find((attachment) => {
						const hasStoragePath = Boolean(attachment.storagePath);
						const hasSize = typeof attachment.size === "number";
						const hasAnyContentType =
							typeof attachment.contentType === "string" && attachment.contentType.length > 0
								? true
								: typeof attachment.mediaType === "string" && attachment.mediaType.length > 0;

						return !hasStoragePath || !hasSize || !hasAnyContentType;
					});
					if (unresolved) {
						addInlineError({
							type: ChatErrorType.INVALID_REQUEST,
							message: "Attachment is still uploading. Please wait before sending.",
							retryable: false,
							metadata: {
								attachmentId: unresolved.id,
								filename: unresolved.filename,
							},
						});
						return;
					}

					uploadedAttachments = attachments.map((attachment) => {
						if (
							!attachment.storagePath ||
							typeof attachment.size !== "number"
						) {
							throw new Error("Attachment missing upload metadata.");
						}

						let inferredContentType: string;
						if (typeof attachment.contentType === "string" && attachment.contentType.length > 0) {
							inferredContentType = attachment.contentType;
						} else if (
							typeof attachment.mediaType === "string" &&
							attachment.mediaType.length > 0
						) {
							inferredContentType = attachment.mediaType;
						} else {
							inferredContentType = "application/octet-stream";
						}

						return {
							id: attachment.id,
							url: attachment.url ?? "",
							storagePath: attachment.storagePath,
							size: attachment.size,
							contentType: inferredContentType,
							filename: attachment.filename ?? undefined,
							metadata: (attachment.metadata as Record<string, JSONValue> | null) ?? null,
						};
					});

					if (!webSearchEnabled && billingContext.features.webSearch.enabled) {
						setWebSearchEnabled(true);
					}
				}

				if (isNewSession && messages.length === 0) {
					const seedText = hasText
						? trimmedText
						: uploadedAttachments
							.map((attachment) => attachment.filename ?? attachment.contentType)
							.join(", ");
					handleSessionCreation(seedText);
				}

				const userMessageId = crypto.randomUUID();
				const userMessageParts: LightfastAppChatUIMessage["parts"] = [];

				if (hasText) {
					userMessageParts.push({ type: "text", text: trimmedText });
				}

				for (const uploaded of uploadedAttachments) {
					userMessageParts.push({
						type: "file",
						url: uploaded.url,
						mediaType: uploaded.contentType,
						filename: uploaded.filename ?? undefined,
						providerMetadata: {
							storage: {
								provider: "vercel-blob",
								id: uploaded.id,
								pathname: uploaded.storagePath,
								size: uploaded.size,
								metadata: uploaded.metadata,
							},
						},
					});
				}

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

				await vercelSendMessage(userMessage, {
					body: requestBody,
				});

				addBreadcrumb({
					category: "chat-ui",
					message: "send_message_success",
					data: {
						agentId,
						sessionId,
						modelId: selectedModelId,
						attachmentCount: attachments.length,
					},
				});

				if (!isAuthenticated) {
					incrementCount();
				}
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
				return;
			}
	};

	// Handle prompt input submission - converts PromptInput format to our handleSendMessage
	const handlePromptSubmit = async (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();

		const text = message.text ?? "";
		const hasText = text.trim().length > 0;
		const hasAttachments = Boolean(message.attachments?.length);

		if (isPromptSubmissionDisabled || (!hasText && !hasAttachments)) {
			return;
		}

		// Clear the form immediately after preventing default
		event.currentTarget.reset();

		await handleSendMessage(message);
	};

	const uploadAttachments = useCallback(
		async (
			input: {
				attachments: PromptInputAttachmentPayload[];
				modelId: ModelId;
			},
		): Promise<UploadedAttachment[]> => {
			if (input.attachments.length === 0) {
				return [];
			}

			const formData = new FormData();
			formData.append("modelId", input.modelId);

				const metadataPayload = input.attachments.map((attachment, index) => {
					if (!attachment.file) {
						throw new Error("Attachment file missing for upload.");
					}
					const providedFilename =
						typeof attachment.filename === "string" && attachment.filename.length > 0
							? attachment.filename
							: undefined;
					const fallbackName =
						attachment.file.name && attachment.file.name.length > 0
							? attachment.file.name
							: `attachment-${index + 1}`;

					return {
						id: attachment.id,
						mediaType: attachment.mediaType,
						filename: providedFilename ?? fallbackName,
						size: attachment.size ?? attachment.file.size,
					};
				});

			formData.append("metadata", JSON.stringify(metadataPayload));

				input.attachments.forEach((attachment, index) => {
					if (!attachment.file) {
						throw new Error("Attachment file missing for upload.");
					}
					const metadataEntry = metadataPayload[index];
					const fallbackName =
						attachment.file.name && attachment.file.name.length > 0
							? attachment.file.name
							: `attachment-${index + 1}`;
				const inferredName =
					metadataEntry?.filename && metadataEntry.filename.length > 0
						? metadataEntry.filename
						: fallbackName;

				formData.append("files", attachment.file, inferredName);
			});

			const response = await fetch(
				`/api/v/${agentId}/${sessionId}/attachments`,
				{
					method: "POST",
					body: formData,
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(
					errorText || "Unable to upload attachments. Please try again.",
				);
			}

			const data = (await response.json()) as {
				attachments: UploadedAttachment[];
			};

		return data.attachments;
		},
		[agentId, sessionId],
	);

	const handleAttachmentUpload = useCallback(
		async (file: File): Promise<PromptInputAttachmentItem | null> => {
			attachmentUploadCounterRef.current += 1;
			setIsUploadingAttachments(true);

			try {
				const attachmentId = nanoid();
				const uploads = await uploadAttachments({
					attachments: [
						{
							id: attachmentId,
							file,
							mediaType: file.type,
							filename: file.name,
							size: file.size,
						},
					],
					modelId: selectedModelId,
				});

				const uploaded = uploads[0];
				if (!uploaded) {
					throw new Error("Attachment upload failed.");
				}

				if (!webSearchEnabled && billingContext.features.webSearch.enabled) {
					setWebSearchEnabled(true);
				}

				return {
					type: "file",
					id: uploaded.id,
					url: uploaded.url,
					mediaType: uploaded.contentType,
					filename: uploaded.filename ?? file.name,
					size: uploaded.size,
					storagePath: uploaded.storagePath,
					contentType: uploaded.contentType,
					metadata: uploaded.metadata ?? null,
				};
			} catch (error) {
				const safeError = error instanceof Error ? error : new Error(String(error));
				addInlineError({
					type: ChatErrorType.INVALID_REQUEST,
					message: safeError.message || "Unable to upload attachment.",
					retryable: false,
					metadata: {
						filename: file.name,
						size: file.size,
					},
				});
				captureException(safeError, {
					contexts: {
						attachment: {
							filename: file.name,
							size: file.size,
							modelId: selectedModelId,
						},
					},
				});
				throw safeError;
			} finally {
				attachmentUploadCounterRef.current = Math.max(
					0,
					attachmentUploadCounterRef.current - 1,
				);
				if (attachmentUploadCounterRef.current === 0) {
					setIsUploadingAttachments(false);
				}
			}
		},
		[
			uploadAttachments,
			selectedModelId,
			webSearchEnabled,
			billingContext.features.webSearch.enabled,
			setWebSearchEnabled,
			addInlineError,
			captureException,
		],
	);

	const AttachmentPickerButton = ({
		disabled,
		reason,
	}: {
		disabled: boolean;
		reason?: string;
	}) => {
		const attachments = usePromptInputAttachments();
		const count = attachments.files.length;
		const isActive = count > 0;
		return (
			<PromptInputButton
				variant="outline"
				onClick={() => {
					if (disabled) {
						return;
					}
					attachments.openFileDialog();
				}}
				disabled={disabled}
				title={disabled ? reason : undefined}
				className={cn(
					"flex h-8 items-center gap-1 px-3 transition-colors",
					isActive &&
						"bg-secondary text-secondary-foreground hover:bg-secondary/80",
					disabled && "opacity-60 cursor-not-allowed",
				)}
			>
				<PaperclipIcon className="w-4 h-4" />
				{count > 0 ? (
					<span className="text-xs font-medium">{count}</span>
				) : null}
			</PromptInputButton>
		);
	};

	// Handle prompt input errors (both file upload errors and React form events)
	const handlePromptError = (
		errorOrEvent:
			| {
					code:
						| "max_files"
						| "max_file_size"
						| "accept"
						| "upload_failed";
					message: string;
				}
			| FormEvent<HTMLFormElement>,
		) => {
			// Check if it's a file upload error (has 'code' property)
			if ("code" in errorOrEvent) {
				console.error("Prompt input error:", errorOrEvent);
				let userMessage = errorOrEvent.message;
					switch (errorOrEvent.code) {
						case "max_files":
							userMessage = `You can attach up to ${MAX_ATTACHMENT_COUNT} files per message.`;
							break;
						case "max_file_size":
							userMessage = `Each attachment must be smaller than ${Math.floor(
								MAX_ATTACHMENT_BYTES / (1024 * 1024),
							)}MB.`;
							break;
						case "accept":
							if (supportsImageAttachments && supportsPdfAttachments) {
								userMessage = "Only images and PDFs are supported for this model.";
							} else if (supportsImageAttachments) {
								userMessage = "Only image attachments are supported for this model.";
							} else if (supportsPdfAttachments) {
								userMessage = "Only PDF attachments are supported for this model.";
							} else {
								userMessage = "This model does not support file attachments.";
							}
							break;
						case "upload_failed":
							userMessage = errorOrEvent.message || "Unable to upload attachment.";
							break;
						default:
							break;
					}

				addInlineError({
					type: ChatErrorType.INVALID_REQUEST,
				message: userMessage,
				retryable: false,
				details: undefined,
				metadata: {
					reason: errorOrEvent.code,
					modelId: selectedModelId,
				},
			});
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

	const PromptAttachments = () => {
		const attachments = usePromptInputAttachments();
		const attachmentCount = attachments.files.length;
		const hasAttachments = attachmentCount > 0;
		const isSingleAttachment = attachmentCount === 1;

		return (
			<PromptInputAttachments
				className={cn(
					hasAttachments ? "border-t border-border/60 px-3 py-2" : "border-none px-3 py-0",
					isSingleAttachment && "[&>div]:items-center",
				)}
			>
				{(attachment) => (
					<PromptInputAttachment
						data={attachment}
						aria-label={attachment.filename ?? "Attachment"}
						className="bg-background"
					/>
				)}
			</PromptInputAttachments>
		);
	};

	const PromptFooterToolbar = () => {
		const attachments = usePromptInputAttachments();
		const hasAttachments = attachments.files.length > 0;

		return (
			<PromptInputToolbar
				className={cn(
					"flex items-center justify-between gap-2 bg-transparent p-2 transition-[color,box-shadow]",
					hasAttachments ? "border-t border-border/60" : "",
				)}
			>
			<div className="flex items-center gap-2">
				<AttachmentPickerButton
					disabled={attachmentButtonDisabled}
					reason={attachmentDisabledReason}
				/>
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
								className="ml-1 h-3 w-3 cursor-pointer hover:opacity-70"
								onClick={(e) => {
									e.stopPropagation();
									setWebSearchEnabled(false);
								}}
							/>
						)}
				</PromptInputButton>
			</div>
			<PromptInputTools className="flex items-center gap-2">
				{modelSelector}
				<PromptInputSubmit
					status={status}
					disabled={isPromptSubmissionDisabled}
					title={
						!canUseCurrentModel.allowed && isAuthenticated
							? "reason" in canUseCurrentModel
								? (canUseCurrentModel.reason ?? undefined)
								: undefined
							: undefined
					}
					size="icon"
					variant="outline"
					className="h-8 w-8 rounded-full dark:border-border/50 dark:shadow-sm"
				>
					<ArrowUp className="w-4 h-4" />
				</PromptInputSubmit>
				</PromptInputTools>
		</PromptInputToolbar>
		);
	};

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
							onAttachmentUpload={handleAttachmentUpload}
							accept={attachmentAccept || undefined}
							multiple
							maxFiles={MAX_ATTACHMENT_COUNT}
							maxFileSize={MAX_ATTACHMENT_BYTES}
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
							<PromptAttachments />
						</PromptInputBody>
						<PromptFooterToolbar />
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
									onAttachmentUpload={handleAttachmentUpload}
									accept={attachmentAccept || undefined}
									multiple
									maxFiles={MAX_ATTACHMENT_COUNT}
									maxFileSize={MAX_ATTACHMENT_BYTES}
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
								<PromptAttachments />
							</PromptInputBody>
							<PromptFooterToolbar />
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
