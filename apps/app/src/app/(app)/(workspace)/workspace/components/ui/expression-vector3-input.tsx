"use client";

import { useState } from "react";

import type { ExpressionMode } from "./expression-mode-toggle";
import { ExpressionInput } from "./expression-input";
import { ExpressionModeToggle } from "./expression-mode-toggle";

interface ExpressionVector3Value {
  x: number | string;
  y: number | string;
  z: number | string;
}

interface ExpressionVector3InputProps {
  value: ExpressionVector3Value;
  onChange: (value: ExpressionVector3Value) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  labels?: {
    x?: string;
    y?: string;
    z?: string;
  };
}

/**
 * A component for inputting Vector3 values with expression support.
 * Uses a single mode toggle that controls X, Y, and Z inputs.
 */
export function ExpressionVector3Input({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
}: ExpressionVector3InputProps) {
  // Determine if we're in expression mode based on the type of values
  const isExpressionMode =
    typeof value.x === "string" ||
    typeof value.y === "string" ||
    typeof value.z === "string";

  const [mode, setMode] = useState<ExpressionMode>(
    isExpressionMode ? "expression" : "number",
  );

  const handleValueChange = (
    axis: keyof ExpressionVector3Value,
    newValue: number | string,
  ) => {
    onChange({ ...value, [axis]: newValue });
  };

  const handleModeChange = (newMode: ExpressionMode) => {
    setMode(newMode);

    // Convert all values to the new mode
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

    const newZ =
      newMode === "number" && typeof value.z === "string"
        ? parseFloat(value.z) || 0
        : newMode === "expression" && typeof value.z === "number"
          ? value.z.toString()
          : value.z;

    onChange({ x: newX, y: newY, z: newZ });
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="mb-1">
        <ExpressionModeToggle
          mode={mode}
          onModeChange={handleModeChange}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis}>
            <ExpressionInput
              value={value[axis]}
              onChange={(newValue) => handleValueChange(axis, newValue)}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              showModeToggle={false}
              mode={mode}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
