"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";

import type { ExpressionMode } from "./expression-mode-toggle";
import { ExpressionModeToggle } from "./expression-mode-toggle";

interface ExpressionInputProps {
  value: number | string;
  onChange: (value: number | string) => void;
  defaultMode?: ExpressionMode;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showModeToggle?: boolean;
  mode?: ExpressionMode;
  onModeChange?: (mode: ExpressionMode) => void;
}

/**
 * A component that allows toggling between numeric input and expression input modes.
 * In number mode, it renders a regular numeric input field.
 * In expression mode, it allows inputting JavaScript expressions like "me.time.now * 5".
 */
export function ExpressionInput({
  value,
  onChange,
  defaultMode = "number",
  className,
  placeholder,
  min,
  max,
  step = 0.01,
  disabled = false,
  showModeToggle = true,
  mode: externalMode,
  onModeChange: externalModeChange,
}: ExpressionInputProps) {
  // Determine if the current value is a number or an expression
  const isExpressionValue = typeof value === "string";

  // Use internal state for mode if not controlled externally
  const [internalMode, setInternalMode] = useState<ExpressionMode>(
    isExpressionValue ? "expression" : defaultMode,
  );

  // Use either external or internal mode
  const mode = externalMode !== undefined ? externalMode : internalMode;

  // Handle mode change
  const handleModeChange = (newMode: ExpressionMode) => {
    // Update internal state if not controlled
    if (externalMode === undefined) {
      setInternalMode(newMode);
    }

    // Call external handler if provided
    if (externalModeChange) {
      externalModeChange(newMode);
    }

    // Convert the value when switching modes
    if (newMode === "number" && typeof value === "string") {
      // Try to parse the expression to a number (for preview purposes)
      try {
        // Simple evaluation for preview - just uses basic arithmetic
        // The actual expression evaluation happens in the shader
        const numValue = new Function("return " + value)();
        if (!isNaN(numValue)) {
          onChange(Number(numValue));
        } else {
          onChange(0); // Default to 0 if parsing fails
        }
      } catch (e) {
        onChange(0); // Default to 0 if evaluation fails
      }
    } else if (newMode === "expression" && typeof value === "number") {
      // Convert number to a string representation
      onChange(value.toString());
    }
  };

  // Handle value change
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (mode === "number") {
      // Parse and constrain the numeric value
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        let constrainedValue = numValue;
        if (min !== undefined)
          constrainedValue = Math.max(min, constrainedValue);
        if (max !== undefined)
          constrainedValue = Math.min(max, constrainedValue);
        onChange(constrainedValue);
      }
    } else {
      // Pass the expression as-is
      onChange(inputValue);
    }
  };

  // Format display value based on mode
  const displayValue =
    mode === "number" && typeof value === "number"
      ? value
      : mode === "expression" && typeof value === "string"
        ? value
        : "";

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        {showModeToggle && (
          <ExpressionModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            disabled={disabled}
          />
        )}

        <Input
          type={mode === "number" ? "number" : "text"}
          value={displayValue}
          onChange={handleValueChange}
          className={cn("h-7 flex-1 text-xs", className)}
          placeholder={
            placeholder ??
            (mode === "expression" ? "e.g., me.time.now * 5" : "")
          }
          min={mode === "number" ? min : undefined}
          max={mode === "number" ? max : undefined}
          step={mode === "number" ? step : undefined}
          disabled={disabled}
        />
      </div>

      {/* {mode === "expression" && (
        <div className="pl-1 text-xs text-muted-foreground">
          Available: me.time.now, me.time.delta, Math functions
        </div>
      )} */}
    </div>
  );
}
