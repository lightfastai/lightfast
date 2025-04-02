import { ControllerRenderProps, FieldValues, Path } from "react-hook-form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";

interface EnumSelectorProps<T extends FieldValues, K extends Path<T>> {
  field: ControllerRenderProps<T, K>;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}

export function EnumSelector<T extends FieldValues, K extends Path<T>>({
  field,
  options,
  onValueChange,
}: EnumSelectorProps<T, K>) {
  return (
    <div className="flex flex-col gap-2">
      <Select
        value={field.value}
        onValueChange={(value) => {
          field.onChange(value);
          onValueChange(value);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
