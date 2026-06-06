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
import { Toggle } from "@repo/ui/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type { ChatStatus } from "@vendor/ai";
import { ArrowUp, PencilLine } from "lucide-react";
import { memo, useEffect, useState } from "react";

export const ChatComposer = memo(function ChatComposer({
  compact,
  error,
  onSubmit,
  onTextChange,
  onWriteModeChange,
  status,
  stop,
  text,
  writeModeEnabled,
}: {
  compact: boolean;
  error: Error | undefined;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onTextChange: (text: string) => void;
  onWriteModeChange: (enabled: boolean) => void;
  status: ChatStatus;
  stop: () => void;
  text: string;
  writeModeEnabled: boolean;
}) {
  const [isSubmitPending, setIsSubmitPending] = useState(false);

  useEffect(() => {
    if (status !== "ready") {
      setIsSubmitPending(false);
    }
  }, [status]);

  const effectiveStatus: ChatStatus =
    status === "ready" && isSubmitPending ? "submitted" : status;
  const isBusy =
    effectiveStatus === "submitted" || effectiveStatus === "streaming";
  const isStreaming = effectiveStatus === "streaming";
  const submitDisabled =
    effectiveStatus === "submitted" || (!isBusy && text.trim().length === 0);

  // Keep the textarea editable while a response streams so the next message
  // can be drafted. The button acts as Stop during generation, and Enter is
  // ignored until the stream finishes to avoid sending mid-response.
  const handleSubmit = (message: PromptInputMessage) => {
    if (isBusy) {
      return;
    }

    const submittedText = message.text.trim() ? message.text : text;
    if (!submittedText.trim()) {
      return;
    }

    onTextChange("");
    setIsSubmitPending(true);

    try {
      return onSubmit({ ...message, text: submittedText }).finally(() => {
        setIsSubmitPending(false);
      });
    } catch (error) {
      setIsSubmitPending(false);
      throw error;
    }
  };

  const submit = (
    <PromptInputSubmit
      aria-label={isStreaming ? "Stop generating" : "Send message"}
      className="size-8 shrink-0 rounded-full"
      disabled={submitDisabled}
      onStop={stop}
      status={effectiveStatus}
    >
      {effectiveStatus === "ready" ? <ArrowUp className="size-4" /> : undefined}
    </PromptInputSubmit>
  );
  const writeModeToggle = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          aria-label="Write mode"
          className="h-8 gap-1.5 rounded-full px-2 text-muted-foreground text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          disabled={isBusy}
          onPressedChange={onWriteModeChange}
          pressed={writeModeEnabled}
          size="sm"
          type="button"
        >
          <PencilLine className="size-3.5" />
          <span>Write mode</span>
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>Allow Linear writes for this turn</TooltipContent>
    </Tooltip>
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
            onInput={(event) => onTextChange(event.currentTarget.value)}
            placeholder="Ask Lightfield"
            rows={compact ? 1 : undefined}
            value={text}
          />
        </PromptInputBody>
        <PromptInputFooter className={cn("px-2.5 pb-2.5", compact && "pt-1")}>
          <PromptInputTools>{writeModeToggle}</PromptInputTools>
          {submit}
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
});
