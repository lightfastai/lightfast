"use client";

import { ArrowUp } from "lucide-react";
import { useState, KeyboardEvent, FormEvent } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
  className,
}: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        const form = e.currentTarget.form;
        if (form) {
          form.requestSubmit();
        }
      }
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Textarea
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[60px] pr-12 resize-none"
        rows={1}
      />
      <Button
        type="submit"
        size="sm"
        disabled={disabled || !value.trim()}
        className="absolute bottom-2 right-2 h-8 w-8 p-0"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}