import type { ChangeEvent } from "react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec3, Vec3FieldMetadata } from "@repo/webgl";

import { BaseInputNumber } from "../../base/base-input";

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
    return (
      <div className="grid w-full grid-cols-3 gap-1.5">
        {["x", "y", "z"].map((axis) => (
          <BaseInputNumber
            key={axis}
            min={metadata[axis as keyof typeof metadata].min}
            max={metadata[axis as keyof typeof metadata].max}
            step={metadata[axis as keyof typeof metadata].step}
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
            value={field.value[axis]}
          />
        ))}
      </div>
    );
  },
);

Vec3NumberInput.displayName = "Vec3NumberInput";
