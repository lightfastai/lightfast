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
import { isColor, isNumber, isString, isVec2, isVec3 } from "@repo/webgl";

import {
  extractUniformName,
  extractValueFieldMetadata,
  extractVec2FieldMetadata,
  extractVec3FieldMetadata,
} from "./utils";
import { ColorPickerField } from "./value/color-picker-field";
import { NumberInput } from "./value/number-input";
import { StringInput } from "./value/string-input";
import { Vec2Input } from "./value/vec2-input";
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
      if (isNumber(field.value)) {
        return (
          <NumberInput
            field={field}
            metadata={numberMetadata}
            onValueChange={onValueChange}
          />
        );
      }

      if (isVec2(field.value)) {
        return (
          <Vec2Input
            field={field}
            metadata={vec2Metadata}
            onValueChange={onValueChange}
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
