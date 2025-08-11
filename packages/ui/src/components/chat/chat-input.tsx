"use client";

import { ArrowUp } from "lucide-react";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  withGradient?: boolean;
  withDescription?: string;
  modelSelector?: React.ReactNode;
}

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
    ref,
  ) => {
    const [internalMessage, setInternalMessage] = useState("");

    // Use controlled value if provided, otherwise use internal state
    const message = value !== undefined ? value : internalMessage;
    const setMessage = value !== undefined ? onChange || (() => {}) : setInternalMessage;
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Adjust textarea height based on content
    const adjustTextareaHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

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
    useImperativeHandle(ref, () => textareaRef.current!, []);

    const handleSendMessage = useCallback(async () => {
      if (!message.trim() || disabled || isSending) return;

      setIsSending(true);
      const currentMessage = message;
      setMessage("");

      try {
        await onSendMessage(currentMessage);
      } catch (_error) {
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
          handleSendMessage();
        }
      },
      [handleSendMessage],
    );

    const handleMessageChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
      },
      [setMessage],
    );

    const canSend = message.trim() && !disabled && !isSending;

    return (
      <div className={`flex-shrink-0 ${className}`}>
        {/* Gradient overlay */}
        {withGradient && (
          <div className="absolute -top-24 left-0 right-0 h-24 pointer-events-none">
            <div className="chat-container relative h-full !px-0">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>
          </div>
        )}
        
        <div className="chat-container relative">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              {/* Main input container */}
              <div className="w-full border border-border/30 rounded-xl overflow-hidden flex flex-col transition-all bg-transparent dark:bg-input/10">
                {/* Textarea area - grows with content up to max height */}
                <div className="flex-1 max-h-[180px] overflow-y-auto chat-input-scroll">
                  <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleMessageChange}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    className="w-full resize-none border-0 focus-visible:ring-0 whitespace-pre-wrap break-words p-3 bg-transparent dark:bg-input/10 focus:bg-transparent dark:focus:bg-input/10 hover:bg-transparent dark:hover:bg-input/10 disabled:bg-transparent dark:disabled:bg-input/10 outline-none min-h-0"
                    maxLength={maxLength}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="true"
                    style={{
                      lineHeight: "24px",
                      minHeight: "72px",
                    }}
                  />
                </div>

                {/* Controls area - always at bottom */}
                <div className="flex items-center justify-end p-2 bg-transparent dark:bg-input/10 transition-[color,box-shadow]">
                  <div className="flex items-center gap-2">
                    {/* Model selector */}
                    {modelSelector}
                    
                    {/* Send button */}
                    <Button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!canSend}
                      size="icon"
                      className="h-8 w-8 rounded-full"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Description text */}
        {withDescription && (
          <div className="chat-container">
            <p className="text-xs text-muted-foreground text-center mt-2">
              {withDescription}
            </p>
          </div>
        )}
      </div>
    );
  },
);

// Add display name for debugging
ChatInputComponent.displayName = "ChatInput";

// Memoize the entire component to prevent unnecessary re-renders
export const ChatInput = memo(ChatInputComponent);