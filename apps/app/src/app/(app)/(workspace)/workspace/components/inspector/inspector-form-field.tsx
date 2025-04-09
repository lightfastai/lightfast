import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  Path,
} from "react-hook-form";
import type { z } from "zod";
import { memo, useCallback } from "react";

import type {
  NumericValueMetadata,
  UniformFieldValue,
  Value,
  Vec2FieldMetadata,
  Vec3FieldMetadata,
} from "@repo/webgl";
import { FormField, FormItem, FormLabel } from "@repo/ui/components/ui/form";
import {
  $ValueType,
  $VectorMode,
  createExpressionString,
  expressionToNumericValue,
  getFieldMetadata,
  isExpression,
} from "@repo/webgl";

import { BooleanInput } from "./primitives/boolean-input";
import { ColorPickerField } from "./primitives/color-picker-field";
import { NumericValueExpressionInput } from "./primitives/numeric-value-expression-input";
import { NumericValueNumberInput } from "./primitives/numeric-value-number-input";
import { StringInput } from "./primitives/string-input";
import { VecModeToggle } from "./primitives/vec-mode-toggle";
import { Vec2NumberInput } from "./primitives/vec2-number-input";
import { Vec3NumberInput } from "./primitives/vec3-number-input";

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
          case $ValueType.enum.Numeric:
            return (
              <div className="flex flex-row gap-2">
                <VecModeToggle
                  key={name}
                  id={name}
                  mode={
                    isExpression(field.value)
                      ? $VectorMode.enum.Expression
                      : $VectorMode.enum.Number
                  }
                  onModeChange={(mode) => {
                    if (mode === $VectorMode.enum.Expression) {
                      onValueChange(createExpressionString(field.value));
                    }
                    if (mode === $VectorMode.enum.Number) {
                      const numericValue = expressionToNumericValue(
                        field.value,
                      );
                      onValueChange(numericValue);
                    }
                  }}
                />
                <div className="flex w-full flex-col gap-2">
                  {isExpression(field.value) ? (
                    <NumericValueExpressionInput
                      field={
                        field as ControllerRenderProps<FieldValues, string>
                      }
                      metadata={constraint as Vec3FieldMetadata}
                      onValueChange={onValueChange}
                    />
                  ) : (
                    <NumericValueNumberInput
                      field={
                        field as ControllerRenderProps<FieldValues, string>
                      }
                      metadata={constraint as NumericValueMetadata}
                      onValueChange={onValueChange}
                    />
                  )}
                </div>
              </div>
            );

          case $ValueType.enum.Vec2:
            return (
              <Vec2NumberInput
                field={field as ControllerRenderProps<FieldValues, string>}
                metadata={constraint as Vec2FieldMetadata}
                onValueChange={onValueChange}
              />
            );

          case $ValueType.enum.Vec3:
            return (
              <Vec3NumberInput
                field={field as ControllerRenderProps<FieldValues, string>}
                metadata={constraint as Vec3FieldMetadata}
                onValueChange={onValueChange}
              />
            );

          case $ValueType.enum.Boolean:
            return (
              <BooleanInput
                field={field as ControllerRenderProps<FieldValues, string>}
                onValueChange={onValueChange}
              />
            );

          case $ValueType.enum.Color:
            return (
              <ColorPickerField
                field={field as ControllerRenderProps<FieldValues, string>}
                onValueChange={onValueChange}
              />
            );

          case $ValueType.enum.String:
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
      [fieldMetadata, name, onValueChange],
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
