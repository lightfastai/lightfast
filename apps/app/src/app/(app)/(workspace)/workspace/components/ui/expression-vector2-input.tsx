"use client";

import { ExpressionInput } from "./expression-input";

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
 * Allows toggling between number and expression mode for each component.
 */
export function ExpressionVector2Input({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  disabled = false,
  labels = { x: "X", y: "Y" },
}: ExpressionVector2InputProps) {
  const handleXChange = (newX: number | string) => {
    onChange({ ...value, x: newX });
  };

  const handleYChange = (newY: number | string) => {
    onChange({ ...value, y: newY });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="mb-1 text-sm font-medium">{labels.x}</div>
        <ExpressionInput
          value={value.x}
          onChange={handleXChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
      </div>
      <div>
        <div className="mb-1 text-sm font-medium">{labels.y}</div>
        <ExpressionInput
          value={value.y}
          onChange={handleYChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
