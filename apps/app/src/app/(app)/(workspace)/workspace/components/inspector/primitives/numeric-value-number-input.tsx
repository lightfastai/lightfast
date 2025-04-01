import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { NumericValue, NumericValueMetadata } from "@repo/webgl";
import { Slider } from "@repo/ui/components/ui/slider";

import { BaseInputNumber } from "./base-input";

interface NumericValueNumberInputProps<
  T extends FieldValues,
  K extends Path<T>,
> {
  field: ControllerRenderProps<T, K>;
  metadata: NumericValueMetadata;
  onValueChange: (value: NumericValue) => void;
}

export const NumericValueNumberInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: NumericValueNumberInputProps<T, K>) => {
    const { value } = metadata;
    const { min, max, step } = value;
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

NumericValueNumberInput.displayName = "NumericValueNumberInput";
