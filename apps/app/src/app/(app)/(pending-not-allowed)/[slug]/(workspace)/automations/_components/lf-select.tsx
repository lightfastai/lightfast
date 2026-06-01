"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronDown } from "lucide-react";

export interface LfSelectOption {
  label: string;
  value: string;
}

/**
 * Single-select styled after the signals "All Signals" view switcher:
 * a ghost button trigger (label + chevron) over a DropdownMenu whose active
 * row carries a Check. Sized to the lf language (28px height, 9px trigger
 * radius); resting fill + border match the lf Input, hover uses accent (so the
 * trigger matches the menu rows it opens); the menu inherits the shared 13/5/8
 * concentric geometry.
 */
export function LfSelect({
  value,
  options,
  onValueChange,
  placeholder = "Select",
  align = "start",
  className,
  contentClassName,
}: {
  value: string;
  options: readonly LfSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  align?: "start" | "end";
  className?: string;
  contentClassName?: string;
}) {
  const active = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(
            "h-7 justify-between gap-1.5 rounded-[9px] border border-input bg-card px-2.5 font-normal text-foreground text-sm hover:bg-accent",
            className
          )}
          size="sm"
          type="button"
          variant="ghost"
        >
          <span className="truncate">{active?.label ?? placeholder}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "min-w-[var(--radix-dropdown-menu-trigger-width)]",
          contentClassName
        )}
      >
        {options.map((option) => (
          <DropdownMenuItem
            className="gap-2"
            key={option.value}
            onSelect={() => onValueChange(option.value)}
          >
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            {option.value === value ? (
              <Check
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
