"use client";

import type { FormEvent } from "react";
import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp } from "lucide-react";
import type { ChatStatus } from "ai";
import {
	PromptInput,
	PromptInputBody,
	PromptInputTextarea,
	PromptInputToolbar,
	PromptInputTools,
	PromptInputSubmit,
} from "@repo/ui/components/ai-elements/prompt-input";
import type {
	PromptInputMessage,
	PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";

interface AnswerPromptInputProps {
	placeholder: string;
	onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => Promise<void>;
	status: ChatStatus;
	isSubmitDisabled: boolean;
	submitDisabledReason?: string;
	className?: string;
}

/**
 * Workspace-specific answer prompt input component.
 * Simplified version of ChatPromptInput without attachments, web search, or model selection.
 * Consolidates the shared input configuration for the answer interface.
 */
export const AnswerPromptInput = forwardRef<PromptInputRef, AnswerPromptInputProps>(
	function AnswerPromptInput(
		{
			placeholder,
			onSubmit,
			status,
			isSubmitDisabled,
			submitDisabledReason,
			className,
		},
		ref,
	) {
		return (
			<PromptInput
				ref={ref}
				onSubmit={onSubmit}
				className={cn(
					"w-full border dark:shadow-md border-border/50 rounded-2xl overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
					"!divide-y-0 !shadow-sm",
					className,
				)}
			>
				<PromptInputBody className="flex flex-col">
					<PromptInputTextarea
						placeholder={placeholder}
						className={cn(
							"w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
							"!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
							"outline-none min-h-0 min-h-[72px]",
						)}
						style={{ lineHeight: "24px" }}
					/>
				</PromptInputBody>
				<PromptInputToolbar
					className={cn(
						"flex items-center justify-end gap-2 bg-transparent p-2 transition-[color,box-shadow]",
					)}
				>
					<PromptInputTools className="flex items-center gap-2">
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
			</PromptInput>
		);
	}
);

AnswerPromptInput.displayName = "AnswerPromptInput";
