import { memo } from "react";

import type { Value } from "@repo/webgl";

import { ExpressionVector3Input } from "../../ui/expression-vector3-input";

interface Vec3Metadata {
  x: { min: number; max: number; step: number };
  y: { min: number; max: number; step: number };
  z: { min: number; max: number; step: number };
}

interface Vec3InputProps {
  field: any;
  metadata: Vec3Metadata;
  onValueChange: (value: Value) => void;
}

export const Vec3Input = memo(
  ({ field, metadata, onValueChange }: Vec3InputProps) => {
    // Get min, max, and step values - use most restrictive for shared fields
    const min = Math.max(metadata.x.min, metadata.y.min, metadata.z.min);

    const max = Math.min(metadata.x.max, metadata.y.max, metadata.z.max);

    const step = Math.min(metadata.x.step, metadata.y.step, metadata.z.step);

    return (
      <ExpressionVector3Input
        value={field.value}
        onChange={(newValue) => {
          field.onChange(newValue);

          // Convert any string expressions to numbers for the Value type
          const processedValue = {
            x:
              typeof newValue.x === "string"
                ? parseFloat(newValue.x) || 0
                : newValue.x,
            y:
              typeof newValue.y === "string"
                ? parseFloat(newValue.y) || 0
                : newValue.y,
            z:
              typeof newValue.z === "string"
                ? parseFloat(newValue.z) || 0
                : newValue.z,
          };

          onValueChange(processedValue);
        }}
        min={min}
        max={max}
        step={step}
      />
    );
  },
);

Vec3Input.displayName = "Vec3Input";
