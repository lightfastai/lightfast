"use client";

import type { FormEvent } from "react";
import type { ChatStatus } from "ai";
import type {
	PromptInputMessage,
	PromptInputAttachmentItem,
} from "@repo/ui/components/ai-elements/prompt-input";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import type { ChatInlineError } from "@repo/chat-ai-types/errors";
import type { FeedbackData } from "@repo/chat-ai-types/feedback";
import type { PromptError } from "@repo/chat-ai-types/validation";
import { ChatMessages } from "./chat-messages";
import { ChatPromptInput } from "./chat-prompt-input";

interface ChatExistingSessionViewProps {
	messages: LightfastAppChatUIMessage[];
	status: ChatStatus;
	feedback?: FeedbackData;
	onFeedbackSubmit?: (messageId: string, feedbackType: "upvote" | "downvote") => void;
	onFeedbackRemove?: (messageId: string) => void;
	isAuthenticated: boolean;
	isExistingSessionWithNoMessages: boolean;
	hasActiveStream: boolean;
	onStreamAnimationChange: (isAnimating: boolean) => void;
	onArtifactClick?: (artifactId: string) => Promise<void>;
	inlineErrors: ChatInlineError[];
	onInlineErrorDismiss: (errorId: string) => void;
	onPromptSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => Promise<void>;
	onPromptError: (err: PromptError) => void;
	onAttachmentUpload: (file: File) => Promise<PromptInputAttachmentItem | null>;
	attachmentAccept?: string;
	attachmentButtonDisabled: boolean;
	attachmentDisabledReason?: string;
	webSearchEnabled: boolean;
	webSearchAllowed: boolean;
	webSearchDisabledReason?: string;
	onWebSearchToggle: () => void;
	modelSelector: React.ReactNode;
	isSubmitDisabled: boolean;
	submitDisabledReason?: string;
	rateLimitIndicator?: React.ReactNode;
}

/**
 * Existing session view with messages and input at the bottom.
 * Shown when there are messages in the conversation or when viewing a thread.
 */
export function ChatExistingSessionView({
	messages,
	status,
	feedback,
	onFeedbackSubmit,
	onFeedbackRemove,
	isAuthenticated,
	isExistingSessionWithNoMessages,
	hasActiveStream,
	onStreamAnimationChange,
	onArtifactClick,
	inlineErrors,
	onInlineErrorDismiss,
	onPromptSubmit,
	onPromptError,
	onAttachmentUpload,
	attachmentAccept,
	attachmentButtonDisabled,
	attachmentDisabledReason,
	webSearchEnabled,
	webSearchAllowed,
	webSearchDisabledReason,
	onWebSearchToggle,
	modelSelector,
	isSubmitDisabled,
	submitDisabledReason,
	rateLimitIndicator,
}: ChatExistingSessionViewProps) {
	return (
		<div className="flex flex-col h-full bg-background">
			<ChatMessages
				messages={messages}
				status={status}
				feedback={feedback}
				onFeedbackSubmit={onFeedbackSubmit}
				onFeedbackRemove={onFeedbackRemove}
				_isAuthenticated={isAuthenticated}
				isExistingSessionWithNoMessages={isExistingSessionWithNoMessages}
				hasActiveStream={hasActiveStream}
				onStreamAnimationChange={onStreamAnimationChange}
				onArtifactClick={onArtifactClick}
				inlineErrors={inlineErrors}
				onInlineErrorDismiss={onInlineErrorDismiss}
			/>
			<div className="relative">
				<div className="max-w-3xl mx-auto px-1.5 md:px-3 lg:px-6 xl:px-10">
					{/* Rate limit indicator for anonymous users */}
					{rateLimitIndicator}

					<div className="flex-shrink-0">
						<div className="chat-container relative px-1.5 md:px-3 lg:px-5 xl:px-8">
							{/* Gradient overlay */}
							{isAuthenticated && (
								<div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none z-10">
									<div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
								</div>
							)}

							<ChatPromptInput
								placeholder={
									messages.length === 0
										? "Ask anything..."
										: "Continue the conversation..."
								}
								onSubmit={onPromptSubmit}
								onError={onPromptError}
								onAttachmentUpload={onAttachmentUpload}
								accept={attachmentAccept}
								attachmentButtonDisabled={attachmentButtonDisabled}
								attachmentDisabledReason={attachmentDisabledReason}
								webSearchEnabled={webSearchEnabled}
								webSearchAllowed={webSearchAllowed}
								webSearchDisabledReason={webSearchDisabledReason}
								onWebSearchToggle={onWebSearchToggle}
								modelSelector={modelSelector}
								status={status}
								isSubmitDisabled={isSubmitDisabled}
								submitDisabledReason={submitDisabledReason}
							/>
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
}
