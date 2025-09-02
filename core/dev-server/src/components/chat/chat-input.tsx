"use client";

import { ArrowUp, Paperclip, Mic } from "lucide-react";
import { useState, useCallback, useRef, useEffect, forwardRef, memo, useImperativeHandle } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const ChatInputComponent = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSendMessage,
      placeholder = "Type a message...",
      disabled = false,
      maxLength = 4000,
      className = "",
      value,
      onChange,
    },
    ref
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
      
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }, []);

    useEffect(() => {
      adjustTextareaHeight();
    }, [message, adjustTextareaHeight]);

    // Auto-focus on mount
    useEffect(() => {
      textareaRef.current?.focus();
    }, []);

    // Expose ref
    useImperativeHandle(ref, () => textareaRef.current!, []);

    const handleSendMessage = useCallback(async () => {
      if (!message.trim() || disabled || isSending) return;

      setIsSending(true);
      const currentMessage = message;
      setMessage("");

      try {
        await onSendMessage(currentMessage);
      } catch (error) {
        // Restore message on error
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
      <div className={cn("relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm transition-shadow focus-within:shadow-md", className)}>
        {/* Attachment button (decorative) */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled
          title="Attachments (coming soon)"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleMessageChange}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || isSending}
          rows={1}
          maxLength={maxLength}
          className={cn(
            "min-h-[36px] max-h-[200px] resize-none border-0 bg-transparent px-0 py-2",
            "placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          )}
        />
        
        {/* Voice input button (decorative) */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          disabled
          title="Voice input (coming soon)"
        >
          <Mic className="h-4 w-4" />
        </Button>
        
        {/* Send button */}
        <Button
          type="button"
          onClick={handleSendMessage}
          size="icon"
          disabled={!canSend}
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg transition-all",
            canSend ? "opacity-100" : "opacity-50"
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);

ChatInputComponent.displayName = "ChatInput";

export const ChatInput = memo(ChatInputComponent);