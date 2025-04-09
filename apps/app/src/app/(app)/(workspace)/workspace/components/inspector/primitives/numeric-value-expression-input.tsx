import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo, useState } from "react";

import type { NumericValue, Vec3FieldMetadata } from "@repo/webgl";
import { Input } from "@repo/ui/components/ui/input";
import { createExpressionString, extractExpression } from "@repo/webgl";

interface NumericValueExpressionInputProps<T extends FieldValues> {
  field: ControllerRenderProps<T, Path<T>>;
  metadata: Vec3FieldMetadata;
  onValueChange: (value: NumericValue) => void;
}

export const NumericValueExpressionInput = memo(
  <T extends FieldValues>({
    field,
    metadata,
    onValueChange,
  }: NumericValueExpressionInputProps<T>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(
      extractExpression(field.value),
    );

    const handleBlur = () => {
      setIsEditing(false);
      const newValue = createExpressionString(localValue);
      field.onChange(newValue);
      onValueChange(newValue);
    };

    return (
      <Input
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          setIsEditing(true);
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder="Enter x expression..."
        className={`h-7 font-mono text-xs ${isEditing ? "ring-2 ring-blue-500" : ""}`}
      />
    );
  },
);

NumericValueExpressionInput.displayName = "NumericValueExpressionInput";
