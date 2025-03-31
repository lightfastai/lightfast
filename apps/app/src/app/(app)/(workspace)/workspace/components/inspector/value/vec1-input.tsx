import { memo } from "react";

import type { Value } from "@repo/webgl";
import { Slider } from "@repo/ui/components/ui/slider";

import { BaseInputNumber } from "./base/base-input";

interface Vec1Metadata {
  x: { min: number; max: number; step: number };
}

interface Vec1InputProps {
  field: any;
  metadata: Vec1Metadata;
  onValueChange: (value: Value) => void;
}

export const Vec1Input = memo(
  ({ field, metadata, onValueChange }: Vec1InputProps) => {
    const { min, max, step } = metadata.x;

    return (
      <div className="flex items-center gap-2">
        <Slider
          className="flex-1"
          min={min}
          max={max}
          step={step}
          value={[field.value.x]}
          onValueChange={(values) => {
            const newValue = values[0];
            if (newValue === undefined) return;
            const updatedValue = { x: newValue };
            field.onChange(updatedValue);
            onValueChange(updatedValue);
          }}
        />
        <BaseInputNumber
          min={min}
          max={max}
          step={step}
          className="w-20"
          onValueChange={(value: number) => {
            const updatedValue = { x: value };
            field.onChange(updatedValue);
            onValueChange(updatedValue);
          }}
          value={field.value.x}
        />
      </div>
    );
  },
);
