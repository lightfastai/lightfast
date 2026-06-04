"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@repo/ui/components/ai-elements/prompt-input";
import { cn } from "@repo/ui/lib/utils";
import type { ChatStatus } from "@vendor/ai";
import { ArrowUp } from "lucide-react";
import { memo } from "react";

export const ChatComposer = memo(function ChatComposer({
  compact,
  error,
  onSubmit,
  onTextChange,
  status,
  stop,
  text,
}: {
  compact: boolean;
  error: Error | undefined;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onTextChange: (text: string) => void;
  status: ChatStatus;
  stop: () => void;
  text: string;
}) {
  const isGenerating = status === "submitted" || status === "streaming";
  const submitDisabled =
    status === "submitted" || (!isGenerating && text.trim().length === 0);

  // Keep the textarea editable while a response streams so the next message
  // can be drafted. The button acts as Stop during generation, and Enter is
  // ignored until the stream finishes to avoid sending mid-response.
  const handleSubmit = (message: PromptInputMessage) => {
    if (isGenerating) {
      return;
    }

    const submittedText = message.text.trim() ? message.text : text;
    return onSubmit({ ...message, text: submittedText });
  };

  const submit = (
    <PromptInputSubmit
      aria-label={isGenerating ? "Stop generating" : "Send message"}
      className={cn("size-8 rounded-full", compact && "mr-2 mb-2 shrink-0")}
      disabled={submitDisabled}
      onStop={stop}
      status={status}
    >
      {status === "ready" ? <ArrowUp className="size-4" /> : undefined}
    </PromptInputSubmit>
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      {error && (
        <p className="mb-2 px-3 text-destructive text-sm">{error.message}</p>
      )}
      <PromptInput
        className={cn(
          "rounded-[1.75rem] border border-border/50 bg-secondary shadow-lg [&_[data-slot=input-group]]:rounded-[1.75rem] [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none dark:[&_[data-slot=input-group]]:bg-transparent",
          compact && "[&_[data-slot=input-group]]:items-end"
        )}
        onSubmit={handleSubmit}
      >
        <PromptInputBody>
          <PromptInputTextarea
            className={cn(
              "max-h-48 text-base",
              compact ? "min-h-0 py-3 pr-2 pl-5" : "min-h-9 px-5 py-3"
            )}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Ask Lightfield"
            rows={compact ? 1 : undefined}
            value={text}
          />
        </PromptInputBody>
        {compact ? (
          submit
        ) : (
          <PromptInputFooter className="px-2.5 pb-2.5">
            <PromptInputTools />
            {submit}
          </PromptInputFooter>
        )}
      </PromptInput>
    </div>
  );
});
