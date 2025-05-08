import { memo, useCallback, useRef } from "react";
import { Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { cn } from "@repo/ui/lib/utils";

interface SessionInputProps {
  sessionId?: string;
  input: string;
  setInput: (input: string) => void;
  status?: "idle" | "ready" | "submitted" | "error" | "streaming";
  stop?: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  setMessages?: (messages: any) => void;
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
      <Textarea
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cn("w-full resize-none overflow-hidden rounded-md !text-xs")}
        rows={1}
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
      className="border-border hover:bg-accent bg-muted-foreground/10 absolute right-2 bottom-2 flex h-6 items-center justify-center rounded-full border p-1 text-xs"
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
      size="icon"
      className="border-border hover:bg-accent bg-muted-foreground/10 absolute right-2 bottom-2 flex h-6 items-center justify-center rounded-full border p-1 text-xs"
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
