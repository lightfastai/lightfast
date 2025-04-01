import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { memo } from "react";

import type { NumericValue } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface NumericValueExpressionInputProps<T extends FieldValues> {
  field: ControllerRenderProps<T, keyof T & string>;
  metadata: {
    x: { min: number; max: number; step: number };
  };
  onValueChange: (value: NumericValue) => void;
}

export const NumericValueExpressionInput = memo(
  <T extends FieldValues>({
    field,
    metadata,
    onValueChange,
  }: NumericValueExpressionInputProps<T>) => {
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
