import type { ChangeEvent } from "react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec3 } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface Vec3ExpressionInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    x: { min: number; max: number; step: number };
    y: { min: number; max: number; step: number };
    z: { min: number; max: number; step: number };
  };
  onValueChange: (value: Vec3) => void;
}

export const Vec3ExpressionInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: Vec3ExpressionInputProps<T, K>) => {
    return (
      <div className="grid w-full grid-cols-3 gap-1.5">
        {["x", "y", "z"].map((axis) => (
          <Input
            key={axis}
            value={extractExpression(field.value[axis])}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const newValue = createExpressionString(e.target.value);
              const updatedValue = {
                ...field.value,
                [axis]: newValue,
              };
              field.onChange(updatedValue);
              onValueChange(updatedValue);
            }}
            placeholder={`Enter ${axis} expression...`}
            className="h-7 w-full px-1.5 py-0.5 text-xs tracking-widest"
          />
        ))}
      </div>
    );
  },
);

Vec3ExpressionInput.displayName = "Vec3ExpressionInput";
