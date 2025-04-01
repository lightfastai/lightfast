import type { Control, ControllerRenderProps } from "react-hook-form";

import type { NumericValue } from "@repo/webgl";
import { FormField, FormItem, FormLabel } from "@repo/ui/components/ui/form";

import type { TextureUniforms } from "~/db/schema/types";
import { NumericValueExpressionInput } from "../value/vector/numeric-value/numeric-value-expression-input";

interface LimitInspectorProps {
  name: keyof TextureUniforms;
  label: string;
  control: Control<TextureUniforms>;
  onValueChange: (value: NumericValue) => void;
}

export const LimitInspector = ({
  name,
  label,
  control,
  onValueChange,
}: LimitInspectorProps) => {
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
            <NumericValueExpressionInput
              field={field as unknown as ControllerRenderProps<any, string>}
              metadata={{ x: { min: 0, max: 100, step: 0.1 } }}
              onValueChange={onValueChange}
            />
          </div>
        </FormItem>
      )}
    />
  );
};
