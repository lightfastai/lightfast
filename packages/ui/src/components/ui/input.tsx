import { cn } from "@repo/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import type * as React from "react";

const inputVariants = cva(
  "flex w-full min-w-0 bg-transparent outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: [
          "rounded-md border border-input text-base shadow-xs placeholder:text-muted-foreground md:text-sm dark:bg-background",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0",
          "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        ],
        underline: [
          "rounded-none border-0 border-foreground/20 border-b px-0 text-foreground placeholder:text-foreground/50 dark:bg-transparent",
          "focus-visible:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0",
        ],
      },
      size: {
        default: "h-8 px-3 py-1",
        lg: "h-10 px-4 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {}

function Input({ className, type, variant, size, ...props }: InputProps) {
  return (
    <input
      className={cn(inputVariants({ variant, size }), className)}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
