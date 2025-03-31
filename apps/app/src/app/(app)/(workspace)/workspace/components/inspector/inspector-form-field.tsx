import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import type { z } from "zod";
import { memo, useCallback, useMemo } from "react";

import type { Value } from "@repo/webgl";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@repo/ui/components/ui/form";
import {
  isBoolean,
  isColor,
  isNumber,
  isString,
  isVec2,
  isVec3,
} from "@repo/webgl";

import { ExpressionInput } from "../ui/expression-input";
import { ExpressionVector2Input } from "../ui/expression-vector2-input";
import {
  extractUniformName,
  extractValueFieldMetadata,
  extractVec2FieldMetadata,
  extractVec3FieldMetadata,
} from "./utils";
import { BooleanInput } from "./value/boolean-input";
import { ColorPickerField } from "./value/color-picker-field";
import { StringInput } from "./value/string-input";
import { Vec3Input } from "./value/vec3-input";

interface InspectorFormFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  control: Control<T>;
  onValueChange: (value: Value) => void;
  parentSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
}

const InspectorFormFieldComponent = <T extends FieldValues>({
  name,
  label,
  control,
  onValueChange,
  parentSchema,
}: InspectorFormFieldProps<T>) => {
  const fieldSchema = parentSchema.shape[name];

  if (!fieldSchema) {
    console.warn(`Field schema for ${name} is undefined.`);
    return null;
  }

  const numberMetadata = useMemo(
    () => extractValueFieldMetadata(fieldSchema),
    [fieldSchema],
  );

  const vec2Metadata = useMemo(
    () => extractVec2FieldMetadata(fieldSchema),
    [fieldSchema],
  );

  const vec3Metadata = useMemo(
    () => extractVec3FieldMetadata(fieldSchema),
    [fieldSchema],
  );

  const renderField = useCallback(
    (field: ControllerRenderProps<T, Path<T>>) => {
      // Handle numeric values - now supports both numbers and string expressions
      if (isNumber(field.value) || typeof field.value === "string") {
        return (
          <ExpressionInput
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              onValueChange(value);
            }}
            min={numberMetadata.min}
            max={numberMetadata.max}
            step={numberMetadata.step || 0.01}
          />
        );
      }

      console.log("field.value", field.value);

      // Handle Vec2 values - now supports expressions in each component
      if (isVec2(field.value)) {
        // Calculate a common step value (use smallest step)
        const stepValue =
          Math.min(vec2Metadata.x.step, vec2Metadata.y.step) || 0.01;

        return (
          <ExpressionVector2Input
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              // Always make sure we convert string expressions to numbers for the Value type
              // before passing to onValueChange
              const processedValue = {
                x:
                  typeof value.x === "string"
                    ? parseFloat(value.x) || 0
                    : value.x,
                y:
                  typeof value.y === "string"
                    ? parseFloat(value.y) || 0
                    : value.y,
              };
              onValueChange(processedValue);
            }}
            step={stepValue}
          />
        );
      }

      if (isVec3(field.value)) {
        return (
          <Vec3Input
            field={field}
            metadata={vec3Metadata}
            onValueChange={onValueChange}
          />
        );
      }

      if (isColor(field.value)) {
        return <ColorPickerField field={field} onValueChange={onValueChange} />;
      }

      if (isString(field.value)) {
        return <StringInput field={field} onValueChange={onValueChange} />;
      }

      if (isBoolean(field.value)) {
        return <BooleanInput field={field} onValueChange={onValueChange} />;
      }
    },
    [numberMetadata, vec2Metadata, vec3Metadata, onValueChange],
  );

  const uniformName = useMemo(() => extractUniformName(label), [label]);

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem className="grid grid-cols-8 items-center gap-x-4 space-y-0">
          <FormLabel className="col-span-3 flex items-start justify-end text-xs">
            {uniformName.charAt(0).toUpperCase() + uniformName.slice(1)}
          </FormLabel>
          <FormControl>
            <div className="col-span-5">{renderField(field)}</div>
          </FormControl>
        </FormItem>
      )}
    />
  );
};

export const InspectorFormField = memo(
  InspectorFormFieldComponent,
) as typeof InspectorFormFieldComponent;
