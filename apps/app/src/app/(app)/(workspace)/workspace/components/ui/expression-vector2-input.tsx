"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";

import type { ExpressionMode } from "./expression-mode-toggle";
import { ExpressionModeToggle } from "./expression-mode-toggle";

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

  // Format display values based on mode
  const displayX =
    mode === "number" && typeof value.x === "number"
      ? value.x
      : mode === "expression" && typeof value.x === "string"
        ? value.x
        : "";

  const displayY =
    mode === "number" && typeof value.y === "number"
      ? value.y
      : mode === "expression" && typeof value.y === "string"
        ? value.y
        : "";

  return (
    <div className="flex w-full gap-1">
      <div className="mb-1">
        <ExpressionModeToggle
          mode={mode}
          onModeChange={handleModeChange}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Input
          type={mode === "number" ? "number" : "text"}
          value={displayX}
          onChange={handleXChange}
          className="h-7 text-xs"
          placeholder={mode === "expression" ? "e.g., sin(time)" : ""}
          min={mode === "number" ? min : undefined}
          max={mode === "number" ? max : undefined}
          step={mode === "number" ? step : undefined}
          disabled={disabled}
        />
        <Input
          type={mode === "number" ? "number" : "text"}
          value={displayY}
          onChange={handleYChange}
          className="h-7 text-xs"
          placeholder={mode === "expression" ? "e.g., cos(time)" : ""}
          min={mode === "number" ? min : undefined}
          max={mode === "number" ? max : undefined}
          step={mode === "number" ? step : undefined}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
