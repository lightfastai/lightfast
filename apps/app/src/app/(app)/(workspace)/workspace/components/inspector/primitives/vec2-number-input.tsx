import type { ChangeEvent } from "react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec2, Vec2FieldMetadata } from "@repo/webgl";

import { BaseInputNumber } from "./base-input";

interface Vec2NumberInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: Vec2FieldMetadata;
  onValueChange: (value: Vec2) => void;
}

export const Vec2NumberInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: Vec2NumberInputProps<T, K>) => {
    // Ensure field.value exists with default values
    const currentValue = field.value || { x: 0, y: 0 };

    return (
      <div className="grid w-full grid-cols-2 gap-1.5">
        {(["x", "y"] as const).map((axis) => (
          <BaseInputNumber
            key={axis}
            min={metadata[axis].min}
            max={metadata[axis].max}
            step={metadata[axis].step}
            className="w-full"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const newValue = Number(e.target.value);
              const updatedValue = {
                ...currentValue,
                [axis]: newValue,
              };
              field.onChange(updatedValue);
              onValueChange(updatedValue);
            }}
            value={currentValue[axis]}
          />
        ))}
      </div>
    );
  },
);

Vec2NumberInput.displayName = "Vec2NumberInput";
