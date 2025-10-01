"use client";

import type { FormEvent } from "react";
import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp, Globe, PaperclipIcon, X } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import type { ChatStatus } from "ai";
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
	PromptInputAttachmentItem,
	PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
	MAX_ATTACHMENT_COUNT,
	MAX_ATTACHMENT_BYTES,
	MAX_PROMPT_LENGTH,
} from "@repo/chat-ai-types";
import type { PromptError } from "@repo/chat-ai-types/validation";

interface AttachmentPickerButtonProps {
	disabled: boolean;
	reason?: string;
}

function AttachmentPickerButton({ disabled, reason }: AttachmentPickerButtonProps) {
	const attachments = usePromptInputAttachments();
	const count = attachments.files.length;
	const isActive = count > 0;

	const button = (
		<PromptInputButton
			variant="outline"
			onClick={() => {
				if (disabled) {
					return;
				}
				attachments.openFileDialog();
			}}
			disabled={disabled}
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

	// Wrap in tooltip if disabled with a reason
	if (disabled && reason) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex">{button}</span>
				</TooltipTrigger>
				<TooltipContent>
					<p className="max-w-xs">{reason}</p>
				</TooltipContent>
			</Tooltip>
		);
	}

	return button;
}

function PromptAttachments() {
	const attachments = usePromptInputAttachments();
	const attachmentCount = attachments.files.length;
	const hasAttachments = attachmentCount > 0;

	return (
		<PromptInputAttachments
			className={cn(
				hasAttachments ? "border-b border-border/60" : "",
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
}

interface PromptFooterToolbarProps {
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

function PromptFooterToolbar({
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
}: PromptFooterToolbarProps) {
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
					onClick={onWebSearchToggle}
					disabled={!webSearchAllowed}
					title={webSearchDisabledReason ?? undefined}
					className={cn(
						webSearchEnabled &&
							"bg-secondary text-secondary-foreground hover:bg-secondary/80",
						!webSearchAllowed &&
							"opacity-60 cursor-not-allowed",
					)}
				>
					<Globe className="w-4 h-4" />
					Search
					{webSearchEnabled && webSearchAllowed && (
						<X
							className="ml-1 h-3 w-3 cursor-pointer hover:opacity-70"
							onClick={(e) => {
								e.stopPropagation();
								onWebSearchToggle();
							}}
						/>
					)}
				</PromptInputButton>
			</div>
			<PromptInputTools className="flex items-center gap-2">
				{modelSelector}
				<PromptInputSubmit
					status={status}
					disabled={isSubmitDisabled}
					title={submitDisabledReason}
					size="icon"
					variant="outline"
					className="h-8 w-8 rounded-full dark:border-border/50 dark:shadow-sm"
				>
					<ArrowUp className="w-4 h-4" />
				</PromptInputSubmit>
			</PromptInputTools>
		</PromptInputToolbar>
	);
}

interface ChatPromptInputProps {
	placeholder: string;
	onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => Promise<void>;
	onError: (err: PromptError) => void;
	onAttachmentUpload: (file: File) => Promise<PromptInputAttachmentItem | null>;
	accept?: string;
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
	className?: string;
}

/**
 * Reusable chat prompt input component with attachments, web search toggle, and model selector.
 * Consolidates the shared configuration between new session and existing session inputs.
 */
export const ChatPromptInput = forwardRef<PromptInputRef, ChatPromptInputProps>(
	function ChatPromptInput({
		placeholder,
		onSubmit,
		onError,
		onAttachmentUpload,
		accept,
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
		className,
	}, ref) {
		return (
			<PromptInput
				ref={ref}
				onSubmit={onSubmit}
				onError={onError}
				onAttachmentUpload={onAttachmentUpload}
				accept={accept}
				multiple
				maxFiles={MAX_ATTACHMENT_COUNT}
				maxFileSize={MAX_ATTACHMENT_BYTES}
				className={cn(
					"w-full border dark:shadow-md border-border/50 rounded-2xl overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
					"!divide-y-0 !shadow-sm",
					className,
				)}
			>
				<PromptInputBody className="flex flex-col">
					<PromptAttachments />
					<PromptInputTextarea
						placeholder={placeholder}
						className={cn(
							"w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
							"!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
							"outline-none min-h-0 min-h-[72px]",
						)}
						style={{ lineHeight: "24px" }}
						maxLength={MAX_PROMPT_LENGTH}
					/>
				</PromptInputBody>
				<PromptFooterToolbar
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
			</PromptInput>
		);
	}
);
