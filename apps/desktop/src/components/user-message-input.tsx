import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { Infinity as InfinityIcon, Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  ForwardedDropdownMenuTriggerButton,
} from "../components/ui/dropdown-menu";
import { useSessionStore } from "../stores/session-store";
import { InputStatus, MODE_LABELS, SessionMode } from "../types/internal";

// Props for user message input component
export interface SessionInputProps {
  sessionId?: string;
  input: string;
  setInput: (input: string) => void;
  stop?: () => void;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    sessionMode: SessionMode,
  ) => void;
  className?: string;
  setMessages?: (messages: any) => void;
  status?: InputStatus;
}

function ModeSelector({
  mode,
  setMode,
}: {
  mode: SessionMode;
  setMode?: (mode: SessionMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ForwardedDropdownMenuTriggerButton variant="outline">
          <span className="flex items-center gap-1 text-xs">
            {mode === "agent" ? (
              <>
                <InfinityIcon className="text-primary size-3" aria-hidden />
                {MODE_LABELS.agent}
              </>
            ) : (
              MODE_LABELS[mode]
            )}
          </span>
        </ForwardedDropdownMenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[96px] p-0.5">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(v) => setMode?.(v as SessionMode)}
        >
          <DropdownMenuRadioItem
            value="agent"
            showIndicator={false}
            className="px-2 py-1"
          >
            <span className="flex items-center gap-1 text-xs">
              <InfinityIcon className="text-primary size-3" aria-hidden />
              {MODE_LABELS.agent}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="manual"
            showIndicator={false}
            className="px-2 py-1"
          >
            <span className="flex w-full items-center justify-between gap-1 text-xs">
              {MODE_LABELS.manual}
              <span className="sr-only">Manual mode coming soon</span>
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const UserMessageInput = ({
  sessionId,
  input,
  setInput,
  stop,
  handleSubmit,
  className,
  setMessages,
  status,
}: SessionInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Use session store to get and set the current mode
  const setSessionMode = useSessionStore((state) => state.setSessionMode);
  const sessionMode = useSessionStore((state) => state.sessionMode);
  const [mode, setMode] = React.useState<SessionMode>(sessionMode);
  const router = useRouter();

  // Update session store when mode changes
  useEffect(() => {
    setSessionMode(mode);
  }, [mode, setSessionMode]);

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
      router.history.replace(`/session/${sessionId}`);
    }

    // Pass the current mode to the handleSubmit function
    handleSubmit(
      new Event("submit", { cancelable: true, bubbles: true }) as any,
      mode,
    );

    // Reset the textarea height after submission
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    textareaRef.current?.focus();
  }, [handleSubmit, sessionId, router.history, mode]);

  return (
    <div className={cn("relative flex w-full flex-col", className)}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          disabled={status === "thinking" || status === "done"}
          placeholder="Send a message..."
          value={input}
          onChange={handleInput}
          className={cn(
            "min-h-24 w-full resize-none overflow-hidden rounded-md pb-10 !text-xs",
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
                toast.error(
                  "Please wait for the model to finish its response!",
                );
              } else {
                submitForm();
              }
            }
          }}
        />

        <div className="absolute bottom-0 left-0 z-10 flex items-end p-2">
          {status === "ready" && <ModeSelector mode={mode} setMode={setMode} />}
          {status === "thinking" && (
            <span className="text-muted-foreground text-xs italic">
              Thinking...
            </span>
          )}
        </div>

        <div className="absolute right-0 bottom-0 z-10 p-2">
          {status === "thinking" && (
            <StopButton stop={stop} setMessages={setMessages} />
          )}
          {status === "ready" && (
            <SendButton input={input} submitForm={submitForm} />
          )}
        </div>
      </div>
    </div>
  );
};

function StopButton({
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
      className="border-border hover:bg-accent bg-muted-foreground/10 flex items-center justify-center rounded-full border"
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

function SendButton({
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
      className="border-border hover:bg-accent bg-muted-foreground/10 flex items-center justify-center rounded-full border"
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
