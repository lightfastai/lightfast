"use client";

import { useState } from "react";

import { Input } from "@repo/ui/components/ui/input";

import type { ExpressionMode } from "../inspector/value/vec-mode-toggle";
import { VecModeToggle } from "../inspector/value/vec-mode-toggle";

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
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputValue = e.target.value;

    if (mode === "number") {
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue)) {
        let constrainedValue = numValue;
        if (min !== undefined)
          constrainedValue = Math.max(min, constrainedValue);
        if (max !== undefined)
          constrainedValue = Math.min(max, constrainedValue);
        onChange({ ...value, [axis]: constrainedValue });
      }
    } else {
      onChange({ ...value, [axis]: inputValue });
    }
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

  // Format display values based on mode
  const getDisplayValue = (axisValue: number | string) => {
    if (mode === "number" && typeof axisValue === "number") return axisValue;
    if (mode === "expression" && typeof axisValue === "string")
      return axisValue;
    return "";
  };

  return (
    <div className="w-full">
      <div className="mb-1">
        <VecModeToggle
          mode={mode}
          onModeChange={handleModeChange}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["x", "y", "z"] as const).map((axis) => (
          <Input
            key={axis}
            type={mode === "number" ? "number" : "text"}
            value={getDisplayValue(value[axis])}
            onChange={(e) => handleValueChange(axis, e)}
            className="h-7 text-xs"
            placeholder={mode === "expression" ? `e.g., ${axis}` : ""}
            min={mode === "number" ? min : undefined}
            max={mode === "number" ? max : undefined}
            step={mode === "number" ? step : undefined}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
