"use client";

import type { FormEvent } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp, Globe, PaperclipIcon, X } from "lucide-react";
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
} from "@repo/ui/components/ai-elements/prompt-input";
import {
	MAX_ATTACHMENT_COUNT,
	MAX_ATTACHMENT_BYTES,
} from "@repo/chat-ai-types";

interface AttachmentPickerButtonProps {
	disabled: boolean;
	reason?: string;
}

function AttachmentPickerButton({ disabled, reason }: AttachmentPickerButtonProps) {
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
}

function PromptAttachments() {
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
	onError: (err: {
		code: "max_files" | "max_file_size" | "accept" | "upload_failed";
		message: string;
	}) => void;
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
export function ChatPromptInput({
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
}: ChatPromptInputProps) {
	return (
		<PromptInput
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
				<div className="flex-1 max-h-[180px] overflow-y-auto scrollbar-thin">
					<PromptInputTextarea
						placeholder={placeholder}
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
