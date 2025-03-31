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
  getVec1Mode,
  getVec2Mode,
  getVec3Mode,
  isBoolean,
  isColor,
  isString,
  isVec1,
  isVec2,
  isVec3,
  VectorMode,
} from "@repo/webgl";

import {
  extractUniformName,
  extractValueFieldMetadata,
  extractVec2FieldMetadata,
  extractVec3FieldMetadata,
} from "./utils";
import { ColorPickerField } from "./value/color-picker-field";
import { BooleanInput } from "./value/primitive/boolean-input";
import { StringInput } from "./value/primitive/string-input";
import { Vec1ExpressionInput } from "./value/vector/vec1/vec1-expression-input";
import { Vec1NumberInput } from "./value/vector/vec1/vec1-number-input";
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
        // Handle Vec1 values
        if (isVec1(field.value)) {
          const mode = getVec1Mode(field.value);
          return mode === VectorMode.Number ? (
            <Vec1NumberInput
              field={field}
              metadata={numberMetadata}
              onValueChange={onValueChange}
            />
          ) : (
            <Vec1ExpressionInput
              field={field}
              metadata={numberMetadata}
              onValueChange={onValueChange}
            />
          );
        }

        // Handle Vec2 values
        if (isVec2(field.value)) {
          const mode = getVec2Mode(field.value);
          console.log("mode", mode);
          return mode === VectorMode.Number ? (
            <Vec2NumberInput
              field={field}
              metadata={vec2Metadata}
              onValueChange={onValueChange}
            />
          ) : (
            <Vec2ExpressionInput
              field={field}
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
              field={field}
              metadata={vec3Metadata}
              onValueChange={onValueChange}
            />
          ) : (
            <Vec3ExpressionInput
              field={field}
              metadata={vec3Metadata}
              onValueChange={onValueChange}
            />
          );
        }

        // Handle Boolean values
        if (isBoolean(field.value)) {
          return <BooleanInput field={field} onValueChange={onValueChange} />;
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
      [name, parentSchema, onValueChange],
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
            <FormControl className="col-span-5">
              {renderField(field)}
            </FormControl>
          </FormItem>
        )}
      />
    );
  },
);

InspectorFormField.displayName = "InspectorFormField";
