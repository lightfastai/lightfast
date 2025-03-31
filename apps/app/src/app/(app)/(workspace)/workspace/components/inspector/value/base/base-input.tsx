import type { ComponentProps } from "react";
import { forwardRef } from "react";

import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";

interface BaseInputProps extends ComponentProps<typeof Input> {
  value: number;
  min: number;
  max: number;
  step: number;
  className?: string;
}

export const BaseInputNumber = forwardRef<HTMLInputElement, BaseInputProps>(
  ({ value, min, max, step, className, ...props }, ref) => {
    return (
      <Input
        {...props}
        type="number"
        ref={ref}
        value={value}
        min={min}
        max={max}
        step={step}
        className={cn(
          "h-7 w-full px-1.5 py-0.5 text-xs tracking-widest",
          className,
        )}
      />
    );
  },
);

BaseInputNumber.displayName = "BaseInputNumber";
