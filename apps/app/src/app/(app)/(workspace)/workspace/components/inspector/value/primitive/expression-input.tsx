import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Expression } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface ExpressionInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  metadata: {
    min: number;
    max: number;
    step: number;
  };
  onValueChange: (value: Expression) => void;
}

export const ExpressionInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    metadata,
    onValueChange,
  }: ExpressionInputProps<T, K>) => {
    return (
      <Input
        value={extractExpression(field.value)}
        onChange={(e) => {
          const newValue = createExpressionString(e.target.value);
          field.onChange(newValue);
          onValueChange(newValue);
        }}
        placeholder="Enter expression..."
        className="font-mono text-xs"
      />
    );
  },
);

ExpressionInput.displayName = "ExpressionInput";
