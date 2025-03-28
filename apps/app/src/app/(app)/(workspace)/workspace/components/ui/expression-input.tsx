"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group";
import { cn } from "@repo/ui/lib/utils";

interface ExpressionInputProps {
  value: number | string;
  onChange: (value: number | string) => void;
  defaultMode?: "number" | "expression";
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
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
}: ExpressionInputProps) {
  // Determine if the current value is a number or an expression
  const isExpressionValue = typeof value === "string";

  // Set initial mode based on value type or default
  const [mode, setMode] = useState<"number" | "expression">(
    isExpressionValue ? "expression" : defaultMode,
  );

  // Handle mode change
  const handleModeChange = (newMode: "number" | "expression") => {
    setMode(newMode);

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
        <RadioGroup
          value={mode}
          onValueChange={handleModeChange as any}
          className="mr-2 flex items-center gap-1 divide-border"
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

        <Input
          type={mode === "number" ? "number" : "text"}
          value={displayValue}
          onChange={handleValueChange}
          className={cn("flex-1", className)}
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
