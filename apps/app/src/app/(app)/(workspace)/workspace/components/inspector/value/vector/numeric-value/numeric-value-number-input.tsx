import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { NumericValue } from "@repo/webgl";
import { Slider } from "@repo/ui/components/ui/slider";
import { createExpressionString } from "@repo/webgl";

import { BaseInputNumber } from "../../base/base-input";

interface NumericValueNumberInputProps<
  T extends FieldValues,
  K extends Path<T>,
> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    x: { min: number; max: number; step: number };
  };
  onValueChange: (value: NumericValue) => void;
}

export const NumericValueNumberInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: NumericValueNumberInputProps<T, K>) => {
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
            const updatedValue = createExpressionString(newValue.toString());
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
            const updatedValue = createExpressionString(newValue.toString());
            field.onChange(updatedValue);
            onValueChange(updatedValue);
          }}
          value={field.value.x}
        />
      </div>
    );
  },
);

NumericValueNumberInput.displayName = "NumericValueNumberInput";
