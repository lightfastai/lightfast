import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec1 } from "@repo/webgl";
import { Slider } from "@repo/ui/components/ui/slider";

import { BaseInputNumber } from "../../base/base-input";

interface Vec1NumberInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    x: { min: number; max: number; step: number };
  };
  onValueChange: (value: Vec1) => void;
}

export const Vec1NumberInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: Vec1NumberInputProps<T, K>) => {
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
          onChange={(e) => {
            const newValue = Number(e.target.value);
            const updatedValue = { x: newValue };
            field.onChange(updatedValue);
            onValueChange(updatedValue);
          }}
          value={field.value.x}
        />
      </div>
    );
  },
);

Vec1NumberInput.displayName = "Vec1NumberInput";
