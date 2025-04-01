import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import type { z } from "zod";
import { memo, useCallback } from "react";

import type { UniformFieldValue, Value } from "@repo/webgl";
import { FormField, FormItem, FormLabel } from "@repo/ui/components/ui/form";
import { getFieldMetadata, ValueType } from "@repo/webgl";

import { ColorPickerField } from "./value/color-picker-field";
import { BooleanInput } from "./value/primitive/boolean-input";
import { StringInput } from "./value/primitive/string-input";
import { NumericValueNumberInput } from "./value/vector/numeric-value/numeric-value-number-input";
import { Vec2NumberInput } from "./value/vector/vec2/vec2-number-input";
import { Vec3NumberInput } from "./value/vector/vec3/vec3-number-input";

interface InspectorFormFieldProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  onValueChange: (value: Value) => void;
  parentSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
  constraints: Record<string, UniformFieldValue>;
}

export const InspectorFormField = memo(
  <T extends FieldValues>({
    name,
    control,
    onValueChange,
    constraints,
  }: InspectorFormFieldProps<T>) => {
    const fieldMetadata = getFieldMetadata(name as string, constraints);

    const renderField = useCallback(
      (field: ControllerRenderProps<T, Path<T>>) => {
        if (!fieldMetadata) {
          return null;
        }

        const { type, constraint } = fieldMetadata;

        switch (type) {
          case ValueType.Numeric:
            return (
              <NumericValueNumberInput
                field={field as ControllerRenderProps<FieldValues, string>}
                metadata={constraint}
                onValueChange={onValueChange}
              />
            );

          case ValueType.Vec2:
            return (
              <Vec2NumberInput
                field={field as ControllerRenderProps<FieldValues, string>}
                metadata={constraint}
                onValueChange={onValueChange}
              />
            );

          case ValueType.Vec3:
            return (
              <Vec3NumberInput
                field={field as ControllerRenderProps<FieldValues, string>}
                metadata={constraint}
                onValueChange={onValueChange}
              />
            );

          case ValueType.Boolean:
            return (
              <BooleanInput
                field={field as ControllerRenderProps<FieldValues, string>}
                onValueChange={onValueChange}
              />
            );

          case ValueType.Color:
            return (
              <ColorPickerField
                field={field as ControllerRenderProps<FieldValues, string>}
                onValueChange={onValueChange}
              />
            );

          case ValueType.String:
            return (
              <StringInput
                field={field as ControllerRenderProps<FieldValues, string>}
                onValueChange={onValueChange}
              />
            );
          default:
            return null;
        }
      },
      [fieldMetadata, onValueChange],
    );

    return (
      <FormField
        name={name}
        control={control}
        render={({ field }) => (
          <FormItem className="grid grid-cols-8 items-center gap-x-4 space-y-0">
            <FormLabel className="col-span-3 flex items-start justify-end text-xs">
              {fieldMetadata?.label}
            </FormLabel>
            <div className="col-span-5 w-full">{renderField(field)}</div>
          </FormItem>
        )}
      />
    );
  },
);

InspectorFormField.displayName = "InspectorFormField";
