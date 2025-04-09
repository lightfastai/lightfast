import type { ChangeEvent } from "react";
import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec2, Vec2FieldMetadata } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface Vec2ExpressionInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: Vec2FieldMetadata;
  onValueChange: (value: Vec2) => void;
}

export const Vec2ExpressionInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: Vec2ExpressionInputProps<T, K>) => {
    return (
      <div className="grid w-full grid-cols-2 gap-1.5">
        {(["x", "y"] as const).map((axis) => (
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
            className="font-mono text-xs"
          />
        ))}
      </div>
    );
  },
);

Vec2ExpressionInput.displayName = "Vec2ExpressionInput";
