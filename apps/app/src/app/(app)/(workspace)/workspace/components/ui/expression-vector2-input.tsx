"use client";

import { useEffect, useState } from "react";

import { Input } from "@repo/ui/components/ui/input";

import type { ExpressionMode } from "../inspector/value/vec-mode-toggle";
import { evaluateExpression } from "../../hooks/use-expression-evaluator";
import { VecModeToggle } from "../inspector/value/vec-mode-toggle";

interface ExpressionVector2Value {
  x: number | string;
  y: number | string;
}

interface ExpressionVector2InputProps {
  value: ExpressionVector2Value;
  onChange: (value: ExpressionVector2Value) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  labels?: {
    x?: string;
    y?: string;
  };
}

/**
 * A component for inputting Vector2 values with expression support.
 * Uses a single mode toggle that controls both X and Y inputs.
 */
export function ExpressionVector2Input({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
}: ExpressionVector2InputProps) {
  // Determine if we're in expression mode based on the type of values
  const isExpressionMode =
    typeof value.x === "string" || typeof value.y === "string";
  const [mode, setMode] = useState<ExpressionMode>(
    isExpressionMode ? "expression" : "number",
  );

  // Track focus state for each input
  const [focusedInput, setFocusedInput] = useState<"x" | "y" | null>(null);

  // Store calculated values for display in expression mode
  const [calculatedValues, setCalculatedValues] = useState({
    x: typeof value.x === "number" ? value.x : 0,
    y: typeof value.y === "number" ? value.y : 0,
  });

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

  // Evaluate expressions when time context changes or expressions change
  useEffect(() => {
    if (mode !== "expression") return;

    // Evaluate both x and y expressions
    const newX =
      typeof value.x === "string"
        ? evaluateExpression(value.x, timeContext)
        : value.x;

    const newY =
      typeof value.y === "string"
        ? evaluateExpression(value.y, timeContext)
        : value.y;

    setCalculatedValues({ x: newX, y: newY });
  }, [timeContext, value.x, value.y, mode]);

  const handleXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (mode === "number") {
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        let constrainedValue = numValue;
        if (min !== undefined)
          constrainedValue = Math.max(min, constrainedValue);
        if (max !== undefined)
          constrainedValue = Math.min(max, constrainedValue);
        onChange({ ...value, x: constrainedValue });
      }
    } else {
      onChange({ ...value, x: inputValue });
    }
  };

  const handleYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (mode === "number") {
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        let constrainedValue = numValue;
        if (min !== undefined)
          constrainedValue = Math.max(min, constrainedValue);
        if (max !== undefined)
          constrainedValue = Math.min(max, constrainedValue);
        onChange({ ...value, y: constrainedValue });
      }
    } else {
      onChange({ ...value, y: inputValue });
    }
  };

  const handleModeChange = (newMode: ExpressionMode) => {
    setMode(newMode);

    // Convert both values to the new mode
    const newX =
      newMode === "number" && typeof value.x === "string"
        ? parseFloat(value.x) || 0
        : newMode === "expression" && typeof value.x === "number"
          ? value.x.toString()
          : value.x;

    const newY =
      newMode === "number" && typeof value.y === "string"
        ? parseFloat(value.y) || 0
        : newMode === "expression" && typeof value.y === "number"
          ? value.y.toString()
          : value.y;

    onChange({ x: newX, y: newY });
  };

  // Format display values based on mode and focus state
  const displayX =
    mode === "number"
      ? typeof value.x === "number"
        ? value.x
        : 0
      : mode === "expression" && typeof value.x === "string"
        ? focusedInput === "x"
          ? value.x // Show the expression when focused
          : calculatedValues.x !== undefined && calculatedValues.x !== null
            ? calculatedValues.x.toFixed(4) // Show calculated value when not focused
            : "0.0000"
        : "";

  const displayY =
    mode === "number"
      ? typeof value.y === "number"
        ? value.y
        : 0
      : mode === "expression" && typeof value.y === "string"
        ? focusedInput === "y"
          ? value.y // Show the expression when focused
          : calculatedValues.y !== undefined && calculatedValues.y !== null
            ? calculatedValues.y.toFixed(4) // Show calculated value when not focused
            : "0.0000"
        : "";

  return (
    <div className="flex w-full gap-1">
      <div className="mb-1">
        <VecModeToggle
          mode={mode}
          onModeChange={handleModeChange}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div className="relative">
          <Input
            type={
              mode === "number" ||
              (mode === "expression" && focusedInput !== "x")
                ? "number"
                : "text"
            }
            value={displayX}
            onChange={handleXChange}
            onFocus={() => setFocusedInput("x")}
            onBlur={() => setFocusedInput(null)}
            className={`h-7 text-xs ${mode === "expression" && focusedInput !== "x" ? "opacity-70" : ""}`}
            placeholder={mode === "expression" ? "e.g., sin(time)" : ""}
            min={mode === "number" ? min : undefined}
            max={mode === "number" ? max : undefined}
            step={mode === "number" ? step : undefined}
            disabled={disabled}
          />
          {mode === "expression" &&
            focusedInput !== "x" &&
            typeof value.x === "string" && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                fx
              </div>
            )}
        </div>
        <div className="relative">
          <Input
            type={
              mode === "number" ||
              (mode === "expression" && focusedInput !== "y")
                ? "number"
                : "text"
            }
            value={displayY}
            onChange={handleYChange}
            onFocus={() => setFocusedInput("y")}
            onBlur={() => setFocusedInput(null)}
            className={`h-7 text-xs ${mode === "expression" && focusedInput !== "y" ? "opacity-70" : ""}`}
            placeholder={mode === "expression" ? "e.g., cos(time)" : ""}
            min={mode === "number" ? min : undefined}
            max={mode === "number" ? max : undefined}
            step={mode === "number" ? step : undefined}
            disabled={disabled}
          />
          {mode === "expression" &&
            focusedInput !== "y" &&
            typeof value.y === "string" && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                fx
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
