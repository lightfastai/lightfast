"use client";

import { Label } from "@repo/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";
import { VectorMode } from "@repo/webgl";

interface VecModeToggleProps {
  mode: VectorMode;
  onModeChange: (mode: VectorMode) => void;
  disabled?: boolean;
  className?: string;
  id: string;
}

/**
 * A reusable toggle component for switching between number and expression input modes.
 * Used by vector input components to maintain a singular toggle group.
 */
export function VecModeToggle({
  mode,
  onModeChange,
  disabled = false,
  className,
  id,
}: VecModeToggleProps) {
  return (
    <div className={cn("inline-block", className)}>
      <RadioGroup
        key={id}
        value={mode}
        onValueChange={(value) => onModeChange(value as VectorMode)}
        className="flex h-7 items-center gap-1 rounded-md border border-secondary bg-secondary/10 p-1"
      >
        <div className="flex gap-1">
          <Label
            htmlFor={`${id}-number-mode`}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-sm px-2 py-0.5 text-xs font-medium",
              mode === VectorMode.Number
                ? "bg-sky-500 text-white"
                : "text-muted-foreground",
            )}
          >
            <RadioGroupItem
              value={VectorMode.Number}
              id={`${id}-number-mode`}
              disabled={disabled}
              className="sr-only"
            />
            <span>123</span>
          </Label>
          <Label
            htmlFor={`${id}-expression-mode`}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-sm px-2 py-0.5 text-xs font-medium",
              mode === VectorMode.Expression
                ? "bg-orange-500 text-white"
                : "text-muted-foreground",
            )}
          >
            <RadioGroupItem
              value={VectorMode.Expression}
              id={`${id}-expression-mode`}
              disabled={disabled}
              className="sr-only"
            />
            <span>f(x)</span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
