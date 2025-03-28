import { memo } from "react";

import type { Value } from "@repo/webgl";

import { BaseInputNumber } from "./base-input";

interface Vec2Metadata {
  x: { min: number; max: number; step: number };
  y: { min: number; max: number; step: number };
}

interface Vec2InputProps {
  field: any;
  metadata: Vec2Metadata;
  onValueChange: (value: Value) => void;
}

export const Vec2Input = memo(
  ({ field, metadata, onValueChange }: Vec2InputProps) => {
    return (
      <div className="grid w-full grid-cols-2 gap-1.5">
        {["x", "y"].map((axis) => (
          <BaseInputNumber
            key={axis}
            min={metadata[axis as keyof Vec2Metadata].min}
            max={metadata[axis as keyof Vec2Metadata].max}
            step={metadata[axis as keyof Vec2Metadata].step}
            {...field}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              field.onChange(newValue);
              onValueChange({ ...field.value, [axis]: newValue });
            }}
            value={field.value[axis] as number}
          />
        ))}
      </div>
    );
  },
);

Vec2Input.displayName = "Vec2Input";
