import type { ChangeEvent } from "react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec3, Vec3FieldMetadata } from "@repo/webgl";

import { BaseInputNumber } from "./base-input";

interface Vec3NumberInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: Vec3FieldMetadata;
  onValueChange: (value: Vec3) => void;
}

export const Vec3NumberInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: Vec3NumberInputProps<T, K>) => {
    const currentValue = field.value || { x: 0, y: 0, z: 0 };

    return (
      <div className="grid w-full grid-cols-3 gap-1.5">
        {(["x", "y", "z"] as const).map((axis) => (
          <BaseInputNumber
            key={axis}
            min={metadata[axis].min}
            max={metadata[axis].max}
            step={metadata[axis].step}
            className="w-full"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const newValue = Number(e.target.value);
              const updatedValue = {
                ...field.value,
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

Vec3NumberInput.displayName = "Vec3NumberInput";
