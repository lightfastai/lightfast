import {
  ArrowUpIcon as ArrowUp,
  Brain01Icon as Brain,
  ChevronDownIcon as ChevronDown,
  EyeIcon as Eye,
  FlashIcon as Flash,
  LockIcon as Lock,
  PencilEdit02Icon as PencilLine,
  Add01Icon as Plus,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  ChatCapabilityMode,
  ChatModelProfile,
} from "@repo/ai/workspace-assistant";
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
import { Button } from "@repo/ui-v2/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui-v2/components/ui/dropdown-menu";
import type { ChatStatus } from "@vendor/ai";
import type { ReactNode } from "react";
import { memo, useEffect, useState } from "react";

export const ChatComposer = memo(function ChatComposer({
  capabilityMode,
  error,
  modelProfile,
  onCapabilityModeChange,
  onModelProfileChange,
  onSubmit,
  onTextChange,
  settingsLocked,
  status,
  stop,
  text,
}: {
  capabilityMode: ChatCapabilityMode;
  error: Error | undefined;
  modelProfile: ChatModelProfile;
  onCapabilityModeChange: (mode: ChatCapabilityMode) => void;
  onModelProfileChange: (profile: ChatModelProfile) => void;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onTextChange: (text: string) => void;
  settingsLocked: boolean;
  status: ChatStatus;
  stop: () => void;
  text: string;
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
      {effectiveStatus === "ready" ? (
        <HugeiconsIcon className="size-4" icon={ArrowUp} />
      ) : undefined}
    </PromptInputSubmit>
  );
  const settingsControls = (
    <div className="flex items-center gap-1">
      <ModelProfileMenu
        disabled={isBusy || settingsLocked}
        modelProfile={modelProfile}
        onModelProfileChange={onModelProfileChange}
        settingsLocked={settingsLocked}
      />
      <CapabilityModeMenu
        capabilityMode={capabilityMode}
        disabled={isBusy || settingsLocked}
        onCapabilityModeChange={onCapabilityModeChange}
        settingsLocked={settingsLocked}
      />
    </div>
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
          settingsControls={settingsControls}
          submit={submit}
          text={text}
        />
      </PromptInput>
    </div>
  );
});

function ChatComposerLayout({
  addContextButton,
  onTextChange,
  settingsControls,
  submit,
  text,
}: {
  addContextButton: ReactNode;
  onTextChange: (text: string) => void;
  settingsControls: ReactNode;
  submit: ReactNode;
  text: string;
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
        <PromptInputTools>{settingsControls}</PromptInputTools>
        {submit}
      </PromptInputFooter>
    </>
  );
}

function ModelProfileMenu({
  disabled,
  modelProfile,
  onModelProfileChange,
  settingsLocked,
}: {
  disabled: boolean;
  modelProfile: ChatModelProfile;
  onModelProfileChange: (profile: ChatModelProfile) => void;
  settingsLocked: boolean;
}) {
  const Icon = modelProfile === "thinking" ? Brain : Flash;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Model profile"
            className="h-7 gap-1.5 rounded-full px-2.5 text-muted-foreground hover:text-foreground"
            disabled={disabled}
            size="sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <HugeiconsIcon icon={Icon} aria-hidden="true" className="size-3.5" />
        <span>{modelProfileLabel(modelProfile)}</span>
        <HugeiconsIcon
          icon={settingsLocked ? Lock : ChevronDown}
          aria-hidden="true"
          className="size-3.5 text-muted-foreground"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => onModelProfileChange("fast")}
        >
          <HugeiconsIcon icon={Flash} aria-hidden="true" className="size-4" />
          <span>Fast</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => onModelProfileChange("thinking")}
        >
          <HugeiconsIcon icon={Brain} aria-hidden="true" className="size-4" />
          <span>Thinking</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CapabilityModeMenu({
  capabilityMode,
  disabled,
  onCapabilityModeChange,
  settingsLocked,
}: {
  capabilityMode: ChatCapabilityMode;
  disabled: boolean;
  onCapabilityModeChange: (mode: ChatCapabilityMode) => void;
  settingsLocked: boolean;
}) {
  const Icon = capabilityMode === "write" ? PencilLine : Eye;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={capabilityModeLabel(capabilityMode)}
                className="rounded-full text-muted-foreground hover:text-foreground"
                disabled={disabled}
                size="icon-sm"
                type="button"
                variant="ghost"
              />
            }
          >
            <HugeiconsIcon icon={Icon} aria-hidden="true" className="size-3.5" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {settingsLocked
            ? "Mode is locked for this conversation"
            : capabilityModeLabel(capabilityMode)}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => onCapabilityModeChange("read")}
        >
          <HugeiconsIcon icon={Eye} aria-hidden="true" className="size-4" />
          <span>Read</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled}
          onClick={() => onCapabilityModeChange("write")}
        >
          <HugeiconsIcon
            icon={PencilLine}
            aria-hidden="true"
            className="size-4"
          />
          <span>Write</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      <HugeiconsIcon className="size-4" icon={Plus} />
    </PromptInputButton>
  );
}

function modelProfileLabel(profile: ChatModelProfile) {
  return profile === "thinking" ? "Thinking" : "Fast";
}

function capabilityModeLabel(mode: ChatCapabilityMode) {
  return mode === "write" ? "Write mode" : "Read mode";
}
