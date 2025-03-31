"use client";

import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";

export type ExpressionMode = "number" | "expression";

interface ExpressionModeToggleProps {
  mode: ExpressionMode;
  onModeChange: (mode: ExpressionMode) => void;
  disabled?: boolean;
}

/**
 * A reusable toggle component for switching between number and expression input modes.
 * Used by vector input components to maintain a singular toggle group.
 */
export function ExpressionModeToggle({
  mode,
  onModeChange,
  disabled = false,
}: ExpressionModeToggleProps) {
  return (
    <RadioGroup
      value={mode}
      onValueChange={onModeChange as any}
      className="flex items-center gap-1 divide-border"
    >
      <RadioGroupItem
        value="number"
        id="number-mode"
        disabled={disabled}
        className="rounded-none bg-sky-500 dark:bg-sky-500"
      />
      <RadioGroupItem
        value="expression"
        id="expression-mode"
        disabled={disabled}
        className="rounded-none bg-orange-500 dark:bg-orange-500"
      />
    </RadioGroup>
  );
}
