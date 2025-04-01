"use client";

import { useEffect, useState } from "react";

import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";

import type { ExpressionMode } from "../inspector/value/vec-mode-toggle";
import { evaluateExpression } from "../../hooks/use-expression-evaluator";
import { VecModeToggle } from "../inspector/value/vec-mode-toggle";

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

  // Store calculated value for display in expression mode
  const [calculatedValue, setCalculatedValue] = useState(
    typeof value === "number" ? value : 0,
  );

  // Track if the input is focused
  const [isFocused, setIsFocused] = useState(false);

  // Basic time context for expression evaluation
  const [timeContext, setTimeContext] = useState(() => ({
    time: 0,
    delta: 0,
    me: {
      time: {
        now: 0,
        delta: 0,
        elapsed: 0,
        frame: 0,
        fps: 60,
        seconds: 0,
        minutes: 0,
        hours: 0,
      },
    },
  }));

  // Update time context periodically for evaluations
  useEffect(() => {
    if (mode !== "expression") return;

    // Update time context every frame when in expression mode
    const updateInterval = setInterval(() => {
      const now = new Date();
      const currentTime = performance.now() / 1000;

      setTimeContext((prev) => {
        const delta = currentTime - prev.time;
        return {
          time: currentTime,
          delta,
          me: {
            time: {
              now: currentTime,
              delta,
              elapsed: currentTime,
              frame: prev.me.time.frame + 1,
              fps: 60,
              seconds: now.getSeconds() + now.getMilliseconds() / 1000,
              minutes: now.getMinutes(),
              hours: now.getHours(),
            },
          },
        };
      });
    }, 16); // ~60fps

    return () => clearInterval(updateInterval);
  }, [mode]);

  // Evaluate expression when time context changes or expression changes
  useEffect(() => {
    if (mode !== "expression" || typeof value !== "string") return;

    // Evaluate the expression
    const evaluated = evaluateExpression(value, timeContext);
    setCalculatedValue(evaluated);
  }, [timeContext, value, mode]);

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

  // Format display value based on mode and focus state
  const displayValue =
    mode === "number"
      ? typeof value === "number"
        ? value
        : 0
      : mode === "expression" && typeof value === "string"
        ? isFocused
          ? value // Show the expression when focused
          : calculatedValue !== undefined && calculatedValue !== null
            ? calculatedValue.toFixed(4) // Show the calculated value when not focused
            : "0.0000"
        : "";

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2">
        {showModeToggle && (
          <VecModeToggle
            mode={mode}
            onModeChange={handleModeChange}
            disabled={disabled}
          />
        )}

        <div className="relative flex-1">
          <Input
            type={
              mode === "number" || (mode === "expression" && !isFocused)
                ? "number"
                : "text"
            }
            value={displayValue}
            onChange={handleValueChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "h-7 w-full text-xs",
              mode === "expression" && !isFocused ? "opacity-70" : "",
              className,
            )}
            placeholder={
              placeholder ??
              (mode === "expression" ? "e.g., me.time.now * 5" : "")
            }
            min={mode === "number" ? min : undefined}
            max={mode === "number" ? max : undefined}
            step={mode === "number" ? step : undefined}
            disabled={disabled}
          />
          {mode === "expression" && !isFocused && typeof value === "string" && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              fx
            </div>
          )}
        </div>
      </div>

      {/* {mode === "expression" && (
        <div className="pl-1 text-xs text-muted-foreground">
          Available: me.time.now, me.time.delta, Math functions
        </div>
      )} */}
    </div>
  );
}
