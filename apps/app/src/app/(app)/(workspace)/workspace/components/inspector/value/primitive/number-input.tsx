import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Number } from "@repo/webgl";
import { Slider } from "@repo/ui/components/ui/slider";

import { BaseInputNumber } from "../base/base-input";

interface NumberInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    min: number;
    max: number;
    step: number;
  };
  onValueChange: (value: Number) => void;
}

export const NumberInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: NumberInputProps<T, K>) => {
    const { min, max, step } = metadata;

    return (
      <div className="flex items-center gap-2">
        <Slider
          className="flex-1"
          min={min}
          max={max}
          step={step}
          value={[field.value]}
          onValueChange={(values) => {
            const newValue = values[0];
            if (newValue === undefined) return;
            field.onChange(newValue);
            onValueChange(newValue);
          }}
        />
        <BaseInputNumber
          {...field}
          min={min}
          max={max}
          step={step}
          className="w-20"
          onChange={(e) => {
            const newValue = Number(e.target.value);
            field.onChange(newValue);
            onValueChange(newValue);
          }}
          value={field.value}
        />
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";
