"use client";

import type {
  PromptInputMessage,
  PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/ui/components/ai-elements/prompt-input";
import { cn } from "@repo/ui/lib/utils";
import type { ChatStatus } from "ai";
import { ArrowUp } from "lucide-react";
import type { FormEvent } from "react";
import { forwardRef } from "react";

interface AnswerPromptInputProps {
  className?: string;
  isSubmitDisabled: boolean;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>;
  placeholder: string;
  status: ChatStatus;
  submitDisabledReason?: string;
}

/**
 * Workspace-specific answer prompt input component.
 * Simplified version of ChatPromptInput without attachments, web search, or model selection.
 * Consolidates the shared input configuration for the answer interface.
 */
export const AnswerPromptInput = forwardRef<
  PromptInputRef,
  AnswerPromptInputProps
>(function AnswerPromptInput(
  {
    placeholder,
    onSubmit,
    status,
    isSubmitDisabled,
    submitDisabledReason,
    className,
  },
  ref
) {
  return (
    <PromptInput
      className={cn(
        "w-full overflow-hidden rounded-sm border border-border/50 bg-input-bg transition-all dark:bg-input-bg dark:shadow-md",
        "!divide-y-0 !shadow-sm",
        className
      )}
      onSubmit={onSubmit}
      ref={ref}
    >
      <PromptInputBody className="flex flex-col">
        <PromptInputTextarea
          className={cn(
            "w-full resize-none whitespace-pre-wrap break-words rounded-none border-0 p-3 focus-visible:ring-0",
            "!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
            "min-h-0 min-h-[72px] outline-none"
          )}
          placeholder={placeholder}
          style={{ lineHeight: "24px" }}
        />
      </PromptInputBody>
      <PromptInputToolbar
        className={cn(
          "flex items-center justify-end gap-2 bg-transparent p-2 transition-[color,box-shadow]"
        )}
      >
        <PromptInputTools className="flex items-center gap-2">
          <PromptInputSubmit
            className="h-8 w-8 rounded-full dark:border-border/50 dark:shadow-sm"
            disabled={isSubmitDisabled}
            size="icon"
            status={status}
            title={submitDisabledReason}
            variant="outline"
          >
            <ArrowUp className="h-4 w-4" />
          </PromptInputSubmit>
        </PromptInputTools>
      </PromptInputToolbar>
    </PromptInput>
  );
});

AnswerPromptInput.displayName = "AnswerPromptInput";
