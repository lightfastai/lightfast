import { FormEvent, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
}

export function ChatInput({
  input,
  isLoading,
  handleInputChange,
  handleSubmit,
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "0";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = scrollHeight + "px";
    }
  }, [input]);

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isLoading) {
      e.preventDefault();
      if (input.trim()) {
        const form = e.currentTarget.form;
        if (form)
          form.dispatchEvent(
            new Event("submit", { cancelable: true, bubbles: true }),
          );
      }
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col space-y-2"
      >
        <div className="bg-background focus-within:ring-ring relative flex w-full grow items-center overflow-hidden rounded-lg border focus-within:ring-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message Lightfast..."
            disabled={isLoading}
            rows={1}
            className="placeholder:text-muted-foreground min-h-10 w-full resize-none border-0 bg-transparent px-3 py-2 pr-10 focus-visible:ring-0"
          />
          <div className="absolute top-1 right-1">
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              size="icon"
              variant="ghost"
              className="bg-primary text-primary-foreground h-8 w-8 rounded-full opacity-90 hover:opacity-100 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
        <div className="text-muted-foreground text-center text-xs">
          <span>Lightfast may produce inaccurate information. </span>
          <kbd className="bg-muted rounded px-1 text-xs uppercase">⌘ Enter</kbd>
          <span> to send</span>
        </div>
      </form>
    </div>
  );
}
