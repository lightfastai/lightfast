import {
  Button as ButtonPrimitive,
  type ButtonProps as ButtonPrimitiveProps,
} from "@react-email/components";
import { cn } from "@repo/ui-v2/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "box-border inline-block max-w-full rounded-2xl border border-transparent bg-clip-padding text-center font-medium text-sm leading-5 no-underline",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        link: "bg-transparent text-primary underline underline-offset-4",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-3 py-1",
        lg: "h-9 px-4 py-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitiveProps & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
