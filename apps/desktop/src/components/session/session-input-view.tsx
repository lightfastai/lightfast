import React, { memo, useCallback, useRef } from "react";
import { UseChatHelpers } from "@ai-sdk/react";
import { Infinity as InfinityIcon, Info, Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

import { SessionMode } from "../../types/internal";

interface SessionInputProps {
  sessionId?: string;
  input: string;
  setInput: (input: string) => void;
  status?: UseChatHelpers["status"];
  stop?: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  setMessages?: (messages: any) => void;
}

const MODE_LABELS: Record<SessionMode, string> = {
  agent: "Agent",
  manual: "Manual",
};

function ModeSelector({
  mode,
  setMode,
}: {
  mode: SessionMode;
  setMode?: (mode: SessionMode) => void;
}) {
  return (
    <div className="absolute bottom-0 left-0 z-10 flex w-fit flex-row items-end p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            className="justify-start"
            aria-label="Select mode"
          >
            {mode === "agent" ? (
              <span className="flex items-center gap-1">
                <InfinityIcon className="text-primary size-3" aria-hidden />
                {MODE_LABELS.agent}
              </span>
            ) : (
              MODE_LABELS[mode]
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[96px] p-0.5">
          <DropdownMenuRadioGroup
            value={mode}
            onValueChange={(v) => setMode?.(v as SessionMode)}
          >
            <DropdownMenuRadioItem value="agent" showIndicator={false}>
              <span className="flex items-center gap-1 text-xs">
                <InfinityIcon className="text-primary size-3" aria-hidden />
                {MODE_LABELS.agent}
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              value="manual"
              disabled
              showIndicator={false}
            >
              <span className="flex items-center gap-1 text-xs">
                {MODE_LABELS.manual}
                <Info className="text-muted-foreground/70 size-3" />
                <span className="sr-only">Manual mode coming soon</span>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const PureSessionInput = ({
  sessionId,
  input,
  setInput,
  status = "ready",
  stop,
  handleSubmit,
  className,
  setMessages,
}: SessionInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = React.useState<SessionMode>("agent");

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);

    // Auto-resize the textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const submitForm = useCallback(() => {
    if (sessionId) {
      window.history.replaceState({}, "", `/session/${sessionId}`);
    }

    handleSubmit(
      new Event("submit", { cancelable: true, bubbles: true }) as any,
    );

    // Reset the textarea height after submission
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    textareaRef.current?.focus();
  }, [handleSubmit, sessionId]);

  return (
    <div className={cn("relative flex w-full flex-col", className)}>
      <ModeSelector mode={mode} setMode={setMode} />
      <Textarea
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cn(
          "min-h-24 w-full resize-none overflow-hidden rounded-md !text-xs",
        )}
        rows={3}
        autoFocus
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();

            if (status !== "ready") {
              toast.error("Please wait for the model to finish its response!");
            } else {
              submitForm();
            }
          }
        }}
      />

      <div className="absolute right-0 bottom-0 flex w-fit flex-row justify-end p-2">
        {status === "submitted" || status === "streaming" ? (
          <StopButton stop={stop} setMessages={setMessages} />
        ) : (
          <SendButton input={input} submitForm={submitForm} />
        )}
      </div>
    </div>
  );
};

export const SessionInput = memo(PureSessionInput);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop?: () => void;
  setMessages?: (messages: any) => void;
}) {
  return (
    <Button
      data-testid="stop-button"
      size="xs"
      className="border-border hover:bg-accent bg-muted-foreground/10 absolute right-2 bottom-2 flex items-center justify-center rounded-full border"
      onClick={(event) => {
        event.preventDefault();
        if (stop) {
          stop();
        }
        if (setMessages) {
          setMessages((messages: any) => messages);
        }
      }}
    >
      <StopCircle className="text-muted-foreground/70 size-3" />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
}: {
  submitForm: () => void;
  input: string;
}) {
  return (
    <Button
      data-testid="send-button"
      variant="default"
      size="xs"
      className="border-border hover:bg-accent bg-muted-foreground/10 absolute right-2 bottom-2 flex items-center justify-center rounded-full border"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0}
    >
      <Send className="text-muted-foreground/70 size-3" />
    </Button>
  );
}

const SendButton = memo(PureSendButton);
