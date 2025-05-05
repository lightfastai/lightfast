import { memo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Send, StopCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";

interface ChatInputProps {
  chatId?: string;
  input: string;
  setInput: (input: string) => void;
  status?: "idle" | "ready" | "submitted" | "error" | "streaming";
  stop?: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  setMessages?: (messages: any) => void;
}

const PureChatInput = ({
  chatId,
  input,
  setInput,
  status = "ready",
  stop,
  handleSubmit,
  className,
  setMessages,
}: ChatInputProps) => {
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
    if (chatId) {
      window.history.replaceState({}, "", `/chat/${chatId}`);
    }

    handleSubmit(
      new Event("submit", { cancelable: true, bubbles: true }) as any,
    );

    // Reset the textarea height after submission
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    textareaRef.current?.focus();
  }, [handleSubmit, chatId]);

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      <Textarea
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cn(
          "bg-muted dark:border-border max-h-[calc(75vh)] min-h-[24px] resize-none overflow-hidden rounded-md pb-10 !text-xs",
        )}
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

export const ChatInput = memo(PureChatInput);

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
      className="h-fit rounded-md border p-1.5 dark:border-zinc-600"
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
      <StopCircle className="h-3 w-3" />
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
      className="h-fit rounded-md p-1.5"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={input.length === 0}
    >
      <Send className="h-3 w-3" />
    </Button>
  );
}

const SendButton = memo(PureSendButton);
