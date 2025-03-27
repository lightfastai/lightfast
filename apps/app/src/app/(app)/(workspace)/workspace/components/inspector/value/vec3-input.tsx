import { memo } from "react";

import type { Value } from "@repo/webgl";

import { BaseInputNumber } from "./base-input";

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
    return (
      <div className="grid w-full grid-cols-3 gap-2">
        {["x", "y", "z"].map((axis) => (
          <BaseInputNumber
            key={axis}
            className="flex-1"
            min={metadata[axis as keyof Vec3Metadata].min}
            max={metadata[axis as keyof Vec3Metadata].max}
            step={metadata[axis as keyof Vec3Metadata].step}
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

Vec3Input.displayName = "Vec3Input";
