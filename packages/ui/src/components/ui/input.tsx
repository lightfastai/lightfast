import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@repo/ui/lib/utils"

const inputVariants = cva(
  "file:text-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 bg-transparent outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: [
          "placeholder:text-muted-foreground dark:bg-input/30 border-input h-9 rounded-md border px-3 py-1 text-base shadow-xs md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        ],
        underline: [
          "text-foreground placeholder:text-foreground/50 border-0 border-b border-foreground/20 px-0 rounded-none dark:bg-transparent",
          "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-foreground",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {}

function Input({ className, type, variant, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Input }
