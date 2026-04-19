"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { ArrowUp } from "lucide-react";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

interface ChatInputProps {
  className?: string;
  disabled?: boolean;
  maxLength?: number;
  modelSelector?: React.ReactNode;
  onChange?: (value: string) => void;
  onSendMessage: (message: string) => Promise<void> | void;
  placeholder?: string;
  value?: string;
  withDescription?: string;
  withGradient?: boolean;
}

const noop = () => {
  /* no-op */
};

const ChatInputComponent = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSendMessage,
      placeholder = "How can I help you today?",
      disabled = false,
      maxLength = 4000,
      className = "",
      value,
      onChange,
      withGradient = false,
      withDescription,
      modelSelector,
    },
    ref
  ) => {
    const [internalMessage, setInternalMessage] = useState("");

    // Use controlled value if provided, otherwise use internal state
    const message = value ?? internalMessage;
    const setMessage =
      value === undefined ? setInternalMessage : (onChange ?? noop);
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Adjust textarea height based on content
    const adjustTextareaHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      // Reset height to get accurate scrollHeight
      textarea.style.height = "auto";
      // Let textarea grow naturally, container will handle overflow
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    // biome-ignore lint/correctness/useExhaustiveDependencies: message dependency is intentional for textarea height adjustment
    useEffect(() => {
      adjustTextareaHeight();
    }, [message, adjustTextareaHeight]);

    // Auto-focus the textarea when component mounts
    useEffect(() => {
      textareaRef.current?.focus();
    }, []);

    // Expose the textarea ref for parent components
    useImperativeHandle(ref, () => {
      // Return the textarea element if available; during mounting it may be null.
      // Callers should handle a potentially unattached ref gracefully.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return textareaRef.current!;
    }, []);

    const handleSendMessage = useCallback(async () => {
      if (!message.trim() || disabled || isSending) {
        return;
      }

      setIsSending(true);
      const currentMessage = message;
      setMessage("");

      try {
        await onSendMessage(currentMessage);
      } catch {
        // Restore the message on error
        setMessage(currentMessage);
      } finally {
        setIsSending(false);
      }
    }, [message, disabled, isSending, onSendMessage, setMessage]);

    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void handleSendMessage();
        }
      },
      [handleSendMessage]
    );

    const handleMessageChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
      },
      [setMessage]
    );

    const canSend = message.trim() && !disabled && !isSending;

    return (
      <div className={`flex-shrink-0 ${className}`}>
        <div className="chat-container relative px-4 md:px-6 lg:px-8">
          {/* Gradient overlay */}
          {withGradient && (
            <div className="pointer-events-none absolute -top-24 right-0 left-0 h-24">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>
          )}

          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              {/* Main input container */}
              <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-input-bg p-2 transition-all dark:bg-input-bg dark:shadow-md">
                {/* Textarea area - grows with content up to max height */}
                <div className="scrollbar-thin max-h-[180px] flex-1 overflow-y-auto">
                  <Textarea
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect="off"
                    className="!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg min-h-0 w-full resize-none whitespace-pre-wrap break-words rounded-none border-0 p-3 outline-none focus-visible:ring-0"
                    maxLength={maxLength}
                    onChange={handleMessageChange}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    ref={textareaRef}
                    spellCheck="true"
                    style={{
                      lineHeight: "24px",
                      minHeight: "72px",
                    }}
                    value={message}
                  />
                </div>

                {/* Controls area - always at bottom */}
                <div className="flex items-center justify-end bg-input-bg p-2 transition-[color,box-shadow] dark:bg-input-bg">
                  <div className="flex items-center gap-2">
                    {/* Model selector */}
                    {modelSelector}

                    {/* Send button */}
                    <Button
                      className="h-8 w-8 rounded-full dark:border-border/50 dark:shadow-sm"
                      disabled={!canSend}
                      onClick={handleSendMessage}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Description text */}
        {withDescription && (
          <div className="chat-container px-4 md:px-6 lg:px-8">
            <p className="mt-2 text-center text-muted-foreground text-xs">
              {withDescription}
            </p>
          </div>
        )}
      </div>
    );
  }
);

// Add display name for debugging
ChatInputComponent.displayName = "ChatInput";

// Memoize the entire component to prevent unnecessary re-renders
export const ChatInput = memo(ChatInputComponent);
