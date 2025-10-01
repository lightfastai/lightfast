"use client";

import type { FormEvent } from "react";
import type { ChatStatus } from "ai";
import type {
	PromptInputMessage,
	PromptInputAttachmentItem,
} from "@repo/ui/components/ai-elements/prompt-input";
import type { PromptError } from "@repo/chat-ai-types/validation";
import { ChatEmptyState } from "./chat-empty-state";
import { PromptSuggestions } from "./prompt-suggestions";
import { ChatPromptInput } from "./chat-prompt-input";

interface ChatNewSessionViewProps {
	userEmail?: string;
	onSendMessage: (input: string | PromptInputMessage) => Promise<void>;
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
	status: ChatStatus;
	isSubmitDisabled: boolean;
	submitDisabledReason?: string;
}

/**
 * New session view with centered empty state, prompt input, and suggestions.
 * Shown when starting a brand new chat with no messages.
 */
export function ChatNewSessionView({
	userEmail,
	onSendMessage,
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
	status,
	isSubmitDisabled,
	submitDisabledReason,
}: ChatNewSessionViewProps) {
	return (
		<div className="h-full flex flex-col items-center justify-center bg-background">
			<div className="w-full max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
				<div className="mb-8">
					<ChatEmptyState
						prompt={
							userEmail
								? `Welcome back, ${userEmail}`
								: "What can I do for you?"
						}
					/>
				</div>
				<ChatPromptInput
					placeholder="Ask anything..."
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
				{/* Prompt suggestions - only visible on iPad and above (md breakpoint) */}
				<div className="hidden md:block relative mt-4 h-12">
					<div className="absolute top-0 left-0 right-0">
						<PromptSuggestions onSelectPrompt={onSendMessage} />
					</div>
				</div>
			</div>
		</div>
	);
}
