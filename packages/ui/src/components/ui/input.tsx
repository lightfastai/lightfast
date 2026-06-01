import * as React from "react";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@repo/ui/lib/utils";

const inputVariants = cva(
  "file:text-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 bg-transparent outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: [
          "placeholder:text-muted-foreground dark:bg-background border-input rounded-md border text-sm shadow-xs",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0",
          "aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        ],
        underline: [
          "text-foreground placeholder:text-foreground/50 border-0 border-b border-foreground/20 px-0 rounded-none dark:bg-transparent",
          "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-foreground",
        ],
        lf: [
          "block placeholder:text-muted-foreground bg-card border-input rounded-[9px] border text-sm leading-4 shadow-none transition-[color,box-shadow,background-color]",
          "focus-visible:bg-background focus-visible:border-input focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] focus-visible:ring-0",
          "aria-invalid:border-destructive aria-invalid:shadow-[inset_0_0_0_1px_var(--destructive)]",
        ],
      },
      size: {
        default: "h-8 px-3 py-1",
        lg: "h-10 px-4 py-2",
        lf: "h-7 px-3",
        "lf-sm": "h-6 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

function Input({ className, type, variant, size, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Input };
