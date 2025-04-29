import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { useCallback } from "react";

import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";

interface BooleanInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  onValueChange: (value: boolean) => void;
}

export const BooleanInput = <T extends FieldValues, K extends Path<T>>({
  field,
  onValueChange,
}: BooleanInputProps<T, K>) => {
  const handleValueChange = useCallback(
    (checked: boolean) => {
      field.onChange(checked);
      onValueChange(checked);
    },
    [field, onValueChange],
  );

  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={field.name}
        checked={field.value}
        onCheckedChange={handleValueChange}
      />
      <Label
        htmlFor={field.name}
        className="text-foreground/80 cursor-pointer text-xs"
      >
        Enable
      </Label>
    </div>
  );
};
