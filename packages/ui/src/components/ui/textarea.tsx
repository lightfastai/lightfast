import * as React from "react"
import { cva } from "class-variance-authority"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@repo/ui/lib/utils"

const textareaVariants = cva(
  "flex field-sizing-content w-full bg-transparent transition-[color,box-shadow] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-16 rounded-md border px-3 py-2 text-base shadow-xs focus-visible:ring-[3px] md:text-sm",
        lf: "bg-card border-input min-h-[92px] rounded-[9px] border px-3 py-2 text-sm leading-relaxed shadow-none focus-visible:bg-background focus-visible:border-input focus-visible:shadow-[inset_0_0_0_1px_var(--ring)] aria-invalid:border-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface TextareaProps
  extends React.ComponentProps<"textarea">,
    VariantProps<typeof textareaVariants> {}

function Textarea({ className, variant, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Textarea }
