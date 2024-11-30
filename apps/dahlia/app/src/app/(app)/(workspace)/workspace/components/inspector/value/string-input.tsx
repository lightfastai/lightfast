import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";

import type { Value } from "@repo/webgl";
import { Textarea } from "@repo/ui/components/ui/textarea";

interface StringInputProps<T extends FieldValues> {
  field: ControllerRenderProps<T, Path<T>>;
  onValueChange: (value: Value) => void;
}

export const StringInput = <T extends FieldValues>({
  field,
  onValueChange,
}: StringInputProps<T>) => {
  return (
    <Textarea
      {...field}
      value={field.value}
      onChange={(e) => {
        field.onChange(e.target.value);
        onValueChange(e.target.value);
      }}
      className="h-24 resize-none font-mono text-xs"
    />
  );
};
