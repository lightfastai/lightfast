import type { Control, ControllerRenderProps } from "react-hook-form";

import type { NumericValue } from "@repo/webgl";
import { FormField, FormItem, FormLabel } from "@repo/ui/components/ui/form";

import type { TextureUniforms } from "~/db/schema/types";
import { BooleanInput } from "../value/primitive/boolean-input";
import { NumericValueExpressionInput } from "../value/vector/numeric-value/numeric-value-expression-input";

interface AddInspectorProps {
  name: keyof TextureUniforms;
  label: string;
  control: Control<TextureUniforms>;
  onValueChange: (value: NumericValue | boolean) => void;
}

export const AddInspector = ({
  name,
  label,
  control,
  onValueChange,
}: AddInspectorProps) => {
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem className="grid grid-cols-8 items-center gap-x-4 space-y-0">
          <FormLabel className="col-span-3 flex items-start justify-end text-xs">
            {label.charAt(0).toUpperCase() + label.slice(1)}
          </FormLabel>
          <div className="col-span-5 w-full">
            {name === "u_enableMirror" ? (
              <BooleanInput
                field={field as unknown as ControllerRenderProps<any, string>}
                onValueChange={onValueChange as (value: boolean) => void}
              />
            ) : (
              <NumericValueExpressionInput
                field={field as unknown as ControllerRenderProps<any, string>}
                metadata={{ x: { min: 0, max: 100, step: 0.1 } }}
                onValueChange={onValueChange as (value: NumericValue) => void}
              />
            )}
          </div>
        </FormItem>
      )}
    />
  );
};
