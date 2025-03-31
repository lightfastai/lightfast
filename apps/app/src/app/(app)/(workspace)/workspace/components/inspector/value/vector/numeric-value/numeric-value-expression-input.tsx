import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { NumericValue } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface NumericValueExpressionInputProps<
  T extends FieldValues,
  K extends Path<T>,
> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    x: { min: number; max: number; step: number };
  };
  onValueChange: (value: NumericValue) => void;
}

export const NumericValueExpressionInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: NumericValueExpressionInputProps<T, K>) => {
    return (
      <Input
        value={extractExpression(field.value.x)}
        onChange={(e) => {
          const newValue = createExpressionString(e.target.value);
          field.onChange(newValue);
          onValueChange(newValue);
        }}
        placeholder="Enter x expression..."
        className="font-mono text-xs"
      />
    );
  },
);

NumericValueExpressionInput.displayName = "NumericValueExpressionInput";
