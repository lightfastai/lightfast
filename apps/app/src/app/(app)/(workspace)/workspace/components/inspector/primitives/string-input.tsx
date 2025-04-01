import type { ControllerRenderProps, FieldValues, Path } from "react-hook-form";

import type { Value } from "@repo/webgl";
import { Textarea } from "@repo/ui/components/ui/textarea";

interface StringInputProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  onValueChange: (value: Value) => void;
}

export const StringInput = <T extends FieldValues, K extends Path<T>>({
  field,
  onValueChange,
}: StringInputProps<T, K>) => {
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
