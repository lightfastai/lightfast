"use client";

import { useState } from "react";

import type { ExpressionMode } from "./expression-mode-toggle";
import { ExpressionInput } from "./expression-input";
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

  const handleXChange = (newX: number | string) => {
    onChange({ ...value, x: newX });
  };

  const handleYChange = (newY: number | string) => {
    onChange({ ...value, y: newY });
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

  return (
    <div className="flex flex-row items-center gap-2">
      <div className="mb-1">
        <ExpressionModeToggle
          mode={mode}
          onModeChange={handleModeChange}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <div>
          <ExpressionInput
            value={value.x}
            onChange={handleXChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            showModeToggle={false}
            mode={mode}
          />
        </div>
        <div>
          <ExpressionInput
            value={value.y}
            onChange={handleYChange}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            showModeToggle={false}
            mode={mode}
          />
        </div>
      </div>
    </div>
  );
}
