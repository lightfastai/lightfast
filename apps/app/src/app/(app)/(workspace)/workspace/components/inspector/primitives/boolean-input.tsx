import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";
import { memo } from "react";

import type { Boolean } from "@repo/webgl";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Label } from "@repo/ui/components/ui/label";

interface BooleanInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  onValueChange: (value: Boolean) => void;
}

export const BooleanInput = memo(
  <T extends FieldValues, K extends Path<T>>({
    field,
    onValueChange,
  }: BooleanInputProps<T, K>) => {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={field.name}
          checked={field.value}
          onCheckedChange={(checked: boolean) => {
            field.onChange(checked);
            onValueChange(checked);
          }}
        />
        <Label
          htmlFor={field.name}
          className="cursor-pointer text-xs text-foreground/80"
        >
          Enable
        </Label>
      </div>
    );
  },
);

BooleanInput.displayName = "BooleanInput";
