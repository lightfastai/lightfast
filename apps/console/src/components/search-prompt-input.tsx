"use client";

import type { FormEvent } from "react";
import { forwardRef, useRef, useEffect, useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { ArrowUp } from "lucide-react";
import type { ChatStatus } from "ai";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputClear,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import type {
  PromptInputMessage,
  PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";
import { MODE_OPTIONS } from "./search-constants";

/**
 * Animated toggle group with sliding background indicator
 */
const AnimatedModeToggle = forwardRef<
  HTMLDivElement,
  {
    value: string;
    onValueChange: (value: string) => void;
  }
>(function AnimatedModeToggle({ value, onValueChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgStyle, setBgStyle] = useState<{
    width: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateBgPosition = () => {
      const container = containerRef.current;
      const selectedButton = container?.querySelector(
        `[data-state="on"]`,
      ) as HTMLElement;

      if (selectedButton && container) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = selectedButton.getBoundingClientRect();

        setBgStyle({
          width: buttonRect.width,
          left: buttonRect.left - containerRect.left,
        });
      }
    };

    // Initial position
    updateBgPosition();

    // Update on resize
    const resizeObserver = new ResizeObserver(updateBgPosition);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const selectedButton = containerRef.current.querySelector(
      `[data-state="on"]`,
    ) as HTMLElement;

    if (selectedButton && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();

      setBgStyle({
        width: buttonRect.width,
        left: buttonRect.left - containerRect.left,
      });
    }
  }, [value]);

  return (
    <div className="relative inline-flex">
      <div
        ref={containerRef}
        className="relative flex items-center gap-1 p-0.5 bg-transparent"
        style={{ perspective: "1000px" }}
      >
        {/* Animated sliding background */}
        <div
          className={cn(
            "absolute inset-y-0 rounded-sm transition-all duration-300 ease-out",
            "bg-accent dark:bg-accent border",
            "pointer-events-none",
          )}
          style={{
            width: bgStyle?.width ? `${bgStyle.width}px` : "0px",
            left: bgStyle?.left ? `${bgStyle.left}px` : "0px",
          }}
        />

        {/* Toggle items */}
        <ToggleGroup
          type="single"
          value={value}
          onValueChange={(v) => v && onValueChange(v)}
          className="flex items-center gap-1 relative z-10"
        >
          {MODE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className={cn(
                "h-6 px-4 rounded-sm dark:border-border text-xs",
                "relative transition-colors duration-200",
                "data-[state=on]:bg-transparent data-[state=on]:text-foreground",
                "data-[state=off]:text-muted-foreground data-[state=off]:bg-transparent",
              )}
              title={opt.description}
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
});

interface SearchPromptInputProps {
  placeholder: string;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => Promise<void>;
  status: ChatStatus;
  isSubmitDisabled: boolean;
  submitDisabledReason?: string;
  onClear?: () => void;
  isClearDisabled?: boolean;
  clearDisabledReason?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  mode?: string;
  onModeChange?: (mode: string) => void;
}

/**
 * Search-specific prompt input component with integrated mode selector.
 * Features custom CSS transforms on mode selection.
 */
export const SearchPromptInput = forwardRef<
  PromptInputRef,
  SearchPromptInputProps
>(function SearchPromptInput(
  {
    placeholder,
    onSubmit,
    status,
    isSubmitDisabled,
    submitDisabledReason,
    onClear,
    isClearDisabled,
    clearDisabledReason,
    value,
    onChange,
    className,
    mode,
    onModeChange,
  },
  ref,
) {
  return (
    <PromptInput
      ref={ref}
      onSubmit={onSubmit}
      className={cn(
        "w-full border dark:shadow-md border-border/50 rounded-sm overflow-hidden transition-all bg-input-bg dark:bg-input-bg",
        "!divide-y-0 !shadow-sm",
        className,
      )}
    >
      <PromptInputBody className="flex flex-col">
        <PromptInputTextarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "w-full resize-none border-0 rounded-none focus-visible:ring-0 whitespace-pre-wrap break-words p-3",
            "!bg-input-bg focus:!bg-input-bg hover:!bg-input-bg disabled:!bg-input-bg dark:!bg-input-bg",
            "outline-none min-h-0 h-[56px]",
          )}
          style={{ lineHeight: "24px" }}
        />
      </PromptInputBody>
      <PromptInputToolbar
        className={cn(
          "flex items-center justify-between gap-2 bg-transparent p-2 transition-[color,box-shadow]",
        )}
      >
        {mode !== undefined && onModeChange && (
          <AnimatedModeToggle value={mode} onValueChange={onModeChange} />
        )}
        <PromptInputTools className="flex items-center gap-2">
          {onClear && (
            <PromptInputClear
              onClick={onClear}
              disabled={isClearDisabled}
              title={clearDisabledReason || "Clear filters"}
              className="px-3 h-8 dark:shadow-sm"
            />
          )}
          <PromptInputSubmit
            status={status}
            disabled={isSubmitDisabled}
            title={submitDisabledReason}
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full dark:border-border/50 dark:shadow-sm"
          >
            <ArrowUp className="w-4 h-4" />
          </PromptInputSubmit>
        </PromptInputTools>
      </PromptInputToolbar>
    </PromptInput>
  );
});

SearchPromptInput.displayName = "SearchPromptInput";
