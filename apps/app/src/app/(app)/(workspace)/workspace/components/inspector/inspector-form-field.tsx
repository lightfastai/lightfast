import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import type { z } from "zod";
import { memo, useCallback, useMemo } from "react";

import type { Value } from "@repo/webgl";
import { FormField, FormItem, FormLabel } from "@repo/ui/components/ui/form";
import {
  extractUniformName,
  getNumericValueMode,
  getValueFieldMetadata,
  getVec2FieldMetadata,
  getVec2Mode,
  getVec3FieldMetadata,
  getVec3Mode,
  isBoolean,
  isColor,
  isNumericValue,
  isString,
  isVec2,
  isVec3,
  VectorMode,
} from "@repo/webgl";

import { ColorPickerField } from "./value/color-picker-field";
import { BooleanInput } from "./value/primitive/boolean-input";
import { StringInput } from "./value/primitive/string-input";
import { NumericValueExpressionInput } from "./value/vector/numeric-value/numeric-value-expression-input";
import { NumericValueNumberInput } from "./value/vector/numeric-value/numeric-value-number-input";
import { Vec2ExpressionInput } from "./value/vector/vec2/vec2-expression-input";
import { Vec2NumberInput } from "./value/vector/vec2/vec2-number-input";
import { Vec3ExpressionInput } from "./value/vector/vec3/vec3-expression-input";
import { Vec3NumberInput } from "./value/vector/vec3/vec3-number-input";

interface InspectorFormFieldProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  control: Control<T>;
  onValueChange: (value: Value) => void;
  parentSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
}

export const InspectorFormField = memo(
  <T extends FieldValues>({
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

    const numberMetadata = useMemo(() => getValueFieldMetadata(name), [name]);

    const vec2Metadata = useMemo(() => getVec2FieldMetadata(name), [name]);

    const vec3Metadata = useMemo(() => getVec3FieldMetadata(name), [name]);

    const uniformName = useMemo(() => extractUniformName(label), [label]);

    const renderField = useCallback(
      (field: ControllerRenderProps<T, Path<T>>) => {
        // Handle Vec1 values
        if (isNumericValue(field.value)) {
          const mode = getNumericValueMode(field.value);
          return mode === VectorMode.Number ? (
            <NumericValueNumberInput
              field={field as ControllerRenderProps<FieldValues, string>}
              metadata={numberMetadata}
              onValueChange={onValueChange}
            />
          ) : (
            <NumericValueExpressionInput
              field={field as ControllerRenderProps<FieldValues, string>}
              metadata={numberMetadata}
              onValueChange={onValueChange}
            />
          );
        }

        // Handle Vec2 values
        if (isVec2(field.value)) {
          const mode = getVec2Mode(field.value);
          return mode === VectorMode.Number ? (
            <Vec2NumberInput
              field={field as ControllerRenderProps<FieldValues, string>}
              metadata={vec2Metadata}
              onValueChange={onValueChange}
            />
          ) : (
            <Vec2ExpressionInput
              field={field as ControllerRenderProps<FieldValues, string>}
              metadata={vec2Metadata}
              onValueChange={onValueChange}
            />
          );
        }

        // Handle Vec3 values
        if (isVec3(field.value)) {
          const mode = getVec3Mode(field.value);
          return mode === VectorMode.Number ? (
            <Vec3NumberInput
              field={field as ControllerRenderProps<FieldValues, string>}
              metadata={vec3Metadata}
              onValueChange={onValueChange}
            />
          ) : (
            <Vec3ExpressionInput
              field={field as ControllerRenderProps<FieldValues, string>}
              metadata={vec3Metadata}
              onValueChange={onValueChange}
            />
          );
        }

        // Handle Boolean values
        if (isBoolean(field.value)) {
          return (
            <BooleanInput
              field={field as ControllerRenderProps<FieldValues, string>}
              onValueChange={onValueChange}
            />
          );
        }

        // Handle Color values
        if (isColor(field.value)) {
          return (
            <ColorPickerField field={field} onValueChange={onValueChange} />
          );
        }

        if (isString(field.value)) {
          return <StringInput field={field} onValueChange={onValueChange} />;
        }

        return null;
      },
      [numberMetadata, onValueChange, vec2Metadata, vec3Metadata],
    );

    return (
      <FormField
        name={name}
        control={control}
        render={({ field }) => (
          <FormItem className="grid grid-cols-8 items-center gap-x-4 space-y-0">
            <FormLabel className="col-span-3 flex items-start justify-end text-xs">
              {uniformName.charAt(0).toUpperCase() + uniformName.slice(1)}
            </FormLabel>
            <div className="col-span-5 w-full">{renderField(field)}</div>
          </FormItem>
        )}
      />
    );
  },
);

InspectorFormField.displayName = "InspectorFormField";
