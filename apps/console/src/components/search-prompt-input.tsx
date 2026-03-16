"use client";

import type {
  PromptInputMessage,
  PromptInputRef,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputClear,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui/components/ui/toggle-group";
import { cn } from "@repo/ui/lib/utils";
import type { ChatStatus } from "ai";
import { ArrowUp } from "lucide-react";
import type { FormEvent } from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
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
>(function AnimatedModeToggle({ value, onValueChange }, _ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgStyle, setBgStyle] = useState<{
    width: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const updateBgPosition = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const selectedButton =
        container.querySelector<HTMLElement>(`[data-state="on"]`);

      if (selectedButton) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = selectedButton.getBoundingClientRect();

        setBgStyle({
          width: buttonRect.width,
          left: buttonRect.left - containerRect.left,
        });
      }
    };

    // Initial position - defer until after DOM paint to avoid flash
    requestAnimationFrame(() => {
      updateBgPosition();
    });

    // Update on resize
    const resizeObserver = new ResizeObserver(updateBgPosition);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const selectedButton =
      containerRef.current.querySelector<HTMLElement>(`[data-state="on"]`);

    if (selectedButton) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = selectedButton.getBoundingClientRect();

      setBgStyle({
        width: buttonRect.width,
        left: buttonRect.left - containerRect.left,
      });
    }
  }, []);

  return (
    <div className="relative inline-flex">
      <div
        className="relative flex items-center gap-1 bg-transparent p-0.5"
        ref={containerRef}
        style={{ perspective: "1000px" }}
      >
        {/* Animated sliding background */}
        <div
          className={cn(
            "absolute inset-y-0 rounded-sm transition-all duration-300 ease-out",
            "border bg-accent dark:bg-accent",
            "pointer-events-none"
          )}
          style={{
            width: bgStyle?.width ? `${bgStyle.width}px` : "0px",
            left: bgStyle?.left ? `${bgStyle.left}px` : "0px",
          }}
        />

        {/* Toggle items */}
        <ToggleGroup
          className="relative z-10 flex items-center gap-1"
          onValueChange={(v) => v && onValueChange(v)}
          type="single"
          value={value}
        >
          {MODE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              className={cn(
                "h-6 rounded-sm px-4 text-xs dark:border-border",
                "relative transition-colors duration-200",
                "data-[state=on]:bg-transparent data-[state=on]:text-foreground",
                "data-[state=off]:bg-transparent data-[state=off]:text-muted-foreground"
              )}
              key={opt.value}
              title={opt.description}
              value={opt.value}
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
  className?: string;
  clearDisabledReason?: string;
  isClearDisabled?: boolean;
  isSubmitDisabled: boolean;
  mode?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  onModeChange?: (mode: string) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>;
  placeholder: string;
  status: ChatStatus;
  submitDisabledReason?: string;
  value?: string;
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
  ref
) {
  return (
    <PromptInput
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border/50 bg-card/40 shadow-sm backdrop-blur-md transition-all",
        "!divide-y-0",
        className
      )}
      onSubmit={onSubmit}
      ref={ref}
    >
      <PromptInputBody className="flex flex-col">
        <PromptInputTextarea
          className={cn(
            "w-full resize-none whitespace-pre-wrap break-words rounded-none border-0 p-3 focus-visible:ring-0",
            "!bg-transparent focus:!bg-transparent hover:!bg-transparent disabled:!bg-transparent dark:!bg-transparent",
            "h-[56px] min-h-0 outline-none"
          )}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{ lineHeight: "24px" }}
          value={value}
        />
      </PromptInputBody>
      <PromptInputToolbar
        className={cn(
          "flex items-center justify-between gap-2 bg-transparent p-2 transition-[color,box-shadow]"
        )}
      >
        {mode !== undefined && onModeChange && (
          <AnimatedModeToggle onValueChange={onModeChange} value={mode} />
        )}
        <PromptInputTools className="flex items-center gap-2">
          {onClear && (
            <PromptInputClear
              className="h-8 px-3 dark:shadow-sm"
              disabled={isClearDisabled}
              onClick={onClear}
              title={clearDisabledReason ?? "Clear filters"}
            />
          )}
          <PromptInputSubmit
            className="!rounded-full h-8 w-8 dark:border-border/50 dark:shadow-sm"
            disabled={isSubmitDisabled}
            size="icon"
            status={status}
            title={submitDisabledReason}
            variant="outline"
          >
            <ArrowUp className="h-4 w-4" />
          </PromptInputSubmit>
        </PromptInputTools>
      </PromptInputToolbar>
    </PromptInput>
  );
});

SearchPromptInput.displayName = "SearchPromptInput";
