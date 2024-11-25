import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import { HexColorPicker } from "react-colorful";
import { z } from "zod";

import type { Value } from "@repo/webgl";
import { Button } from "@repo/ui/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { Slider } from "@repo/ui/components/ui/slider";
import { isColor, isNumber, isVec2, isVec3 } from "@repo/webgl";

import { PropertyInputNumber } from "./property-input";
import { extractMinMax, extractUniformName } from "./utils";

interface FormFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  control: Control<T>;
  onValueChange: (value: Value) => void;
  parentSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
}

export const PropertyFormField = <T extends FieldValues>({
  name,
  label,
  control,
  onValueChange,
  parentSchema,
}: FormFieldProps<T>) => {
  const fieldSchema = parentSchema.shape[name];

  if (!fieldSchema) {
    console.warn(`Field schema for ${name} is undefined.`);
    // Handle the undefined case appropriately
    // For example, you might return null or provide default values
    // @todo log-error
    return null; // or throw an error if this should never happen
  }

  const renderField = (field: ControllerRenderProps<T, Path<T>>) => {
    if (isNumber(field.value)) {
      const { min, max } = extractMinMax(fieldSchema);
      return (
        <div className="flex items-center gap-2">
          <Slider
            className="flex-1"
            min={min}
            max={max}
            step={0.1}
            value={[field.value]}
            onValueChange={(values) => {
              const newValue = values[0];
              field.onChange(newValue);
              onValueChange(newValue);
            }}
          />
          <PropertyInputNumber
            {...field}
            min={min}
            max={max}
            step={0.1}
            className="w-20"
            onChange={(e) => {
              const newValue = Number(e.target.value);
              field.onChange(newValue);
              onValueChange(newValue);
            }}
            value={field.value as number}
          />
        </div>
      );
    }

    if (isVec3(field.value)) {
      return (
        <div className="flex gap-2">
          {["x", "y", "z"].map((axis) => (
            <PropertyInputNumber
              key={axis}
              min={0}
              max={0}
              step={0}
              {...field}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                field.onChange(newValue);
                onValueChange({ ...field.value, [axis]: newValue });
              }}
              value={field.value[axis] as number}
            />
          ))}
        </div>
      );
    }

    if (isVec2(field.value)) {
      return (
        <div className="flex w-full gap-2">
          {["x", "y"].map((axis) => (
            <PropertyInputNumber
              key={axis}
              min={0}
              max={0}
              step={0}
              {...field}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                field.onChange(newValue);
                onValueChange({ ...field.value, [axis]: newValue });
              }}
              value={field.value[axis] as number}
            />
          ))}
        </div>
      );
    }

    if (isColor(field.value)) {
      return (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                aria-label="Pick a color"
                style={{
                  backgroundColor: field.value,
                }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" sideOffset={5}>
              <HexColorPicker
                className="m-auto w-full border-none p-0"
                color={field.value}
                onChange={(color) => {
                  field.onChange(color);
                  onValueChange(color);
                }}
              />
            </PopoverContent>
          </Popover>
          <Input
            {...field}
            className="font-mono text-xs uppercase tracking-widest"
            onChange={(e) => {
              field.onChange(e.target.value);
              onValueChange(e.target.value);
            }}
            value={field.value as string}
          />
        </div>
      );
    }
  };

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem className="grid grid-cols-8 gap-4 px-4">
          <FormLabel className="col-span-3 flex items-center justify-end font-mono text-xs uppercase">
            {extractUniformName(label)}
          </FormLabel>
          <FormControl className="col-span-5">{renderField(field)}</FormControl>
        </FormItem>
      )}
    />
  );
};
