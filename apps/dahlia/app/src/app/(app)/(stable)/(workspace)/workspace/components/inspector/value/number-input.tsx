import { memo } from "react";

import { Slider } from "@repo/ui/components/ui/slider";

import { BaseInputNumber } from "./base-input";

interface NumberInputProps {
  field: any;
  metadata: { min: number; max: number; step: number };
  onValueChange: (value: number) => void;
}

export const NumberInput = memo(
  ({ field, metadata, onValueChange }: NumberInputProps) => {
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
          value={field.value as number}
        />
      </div>
    );
  },
);

NumberInput.displayName = "NumberInput";
