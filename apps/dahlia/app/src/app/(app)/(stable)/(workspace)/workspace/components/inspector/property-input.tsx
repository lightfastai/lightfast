import React from "react";

import type { InputProps } from "@repo/ui/components/ui/input";
import { Input } from "@repo/ui/components/ui/input";
import { cn } from "@repo/ui/lib/utils";

interface PropertyInputProps extends InputProps {
  value: number;
  min: number;
  max: number;
  step: number;
  className?: string;
}

export const PropertyInputNumber = React.forwardRef<
  HTMLInputElement,
  PropertyInputProps
>(({ value, min, max, step, className, ...props }, ref) => {
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
        "h-auto w-full px-2 py-1 font-mono text-xs tracking-widest",
        className,
      )}
    />
  );
});

PropertyInputNumber.displayName = "PropertyInputNumber";
