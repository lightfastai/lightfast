import { Toggle } from "@repo/ui/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { cn } from "@repo/ui/lib/utils";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputStart,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@repo/ui-v2/components/ai-elements/prompt-input";
import type { ChatStatus } from "@vendor/ai";
import {
  ArrowUpIcon as ArrowUp,
  PencilEdit02Icon as PencilLine,
  Add01Icon as Plus,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { memo, useEffect, useState } from "react";

export const ChatComposer = memo(function ChatComposer({
  error,
  onSubmit,
  onTextChange,
  onWriteModeChange,
  status,
  stop,
  text,
  writeModeEnabled,
}: {
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
      className="shrink-0 rounded-full"
      disabled={submitDisabled}
      onStop={stop}
      status={effectiveStatus}
    >
      {effectiveStatus === "ready" ? <HugeiconsIcon icon={ArrowUp} className="size-4" /> : undefined}
    </PromptInputSubmit>
  );
  const writeModeToggle = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          aria-label="Write mode"
          className="rounded-full text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          disabled={isBusy}
          onPressedChange={onWriteModeChange}
          pressed={writeModeEnabled}
          size="sm"
          type="button"
        >
          <HugeiconsIcon icon={PencilLine} className="size-3.5" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>Allow Linear writes for this turn</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      {error ? (
        <p className="mb-2 px-3 text-destructive text-sm">{error.message}</p>
      ) : null}
      <PromptInput
        className={cn(
          "border border-border/50 bg-secondary [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none dark:[&_[data-slot=input-group]]:bg-transparent"
        )}
        onSubmit={handleSubmit}
      >
        <ChatComposerLayout
          addContextButton={<AddContextButton />}
          onTextChange={onTextChange}
          submit={submit}
          text={text}
          writeModeToggle={writeModeToggle}
        />
      </PromptInput>
    </div>
  );
});

function ChatComposerLayout({
  addContextButton,
  onTextChange,
  submit,
  text,
  writeModeToggle,
}: {
  addContextButton: ReactNode;
  onTextChange: (text: string) => void;
  submit: ReactNode;
  text: string;
  writeModeToggle: ReactNode;
}) {
  return (
    <>
      <PromptInputStart className="py-1.5">{addContextButton}</PromptInputStart>
      <PromptInputBody key="body">
        <PromptInputTextarea
          className="max-h-48 text-base leading-6"
          onChange={(event) => onTextChange(event.target.value)}
          onInput={(event) => onTextChange(event.currentTarget.value)}
          placeholder="Ask Lightfield"
          rows={1}
          value={text}
        />
      </PromptInputBody>
      <PromptInputFooter className="py-1.5">
        <PromptInputTools>{writeModeToggle}</PromptInputTools>
        {submit}
      </PromptInputFooter>
    </>
  );
}

function AddContextButton() {
  return (
    <PromptInputButton
      aria-label="Add context"
      className="rounded-full text-muted-foreground disabled:opacity-100"
      disabled
      title="Add context"
    >
      <HugeiconsIcon icon={Plus} className="size-4" />
    </PromptInputButton>
  );
}
