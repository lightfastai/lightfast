"use client";

import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";

export type ExpressionMode = "number" | "expression";

interface ExpressionModeToggleProps {
  mode: ExpressionMode;
  onModeChange: (mode: ExpressionMode) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A reusable toggle component for switching between number and expression input modes.
 * Used by vector input components to maintain a singular toggle group.
 */
export function ExpressionModeToggle({
  mode,
  onModeChange,
  disabled = false,
  className,
}: ExpressionModeToggleProps) {
  return (
    <div className={cn("inline-block", className)}>
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as ExpressionMode)}
        className="flex h-7 items-center gap-1 rounded-md border border-secondary bg-secondary/10 p-1"
      >
        <div className="flex gap-1">
          <label
            htmlFor="number-mode"
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-sm px-2 py-0.5 text-xs font-medium",
              mode === "number"
                ? "bg-sky-500 text-white"
                : "text-muted-foreground",
            )}
          >
            <RadioGroupItem
              value="number"
              id="number-mode"
              disabled={disabled}
              className="sr-only"
            />
            <span>123</span>
          </label>
          <label
            htmlFor="expression-mode"
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-sm px-2 py-0.5 text-xs font-medium",
              mode === "expression"
                ? "bg-orange-500 text-white"
                : "text-muted-foreground",
            )}
          >
            <RadioGroupItem
              value="expression"
              id="expression-mode"
              disabled={disabled}
              className="sr-only"
            />
            <span>f(x)</span>
          </label>
        </div>
      </RadioGroup>
    </div>
  );
}
