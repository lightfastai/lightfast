import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Vec1 } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface Vec1ExpressionInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    x: { min: number; max: number; step: number };
  };
  onValueChange: (value: Vec1) => void;
}

export const Vec1ExpressionInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: Vec1ExpressionInputProps<T, K>) => {
    return (
      <Input
        value={extractExpression(field.value.x)}
        onChange={(e) => {
          const newValue = { x: createExpressionString(e.target.value) };
          field.onChange(newValue);
          onValueChange(newValue);
        }}
        placeholder="Enter x expression..."
        className="font-mono text-xs"
      />
    );
  },
);

Vec1ExpressionInput.displayName = "Vec1ExpressionInput";
