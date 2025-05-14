import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";

const containerVariants = cva("container mx-auto px-4 md:px-6", {
  variants: {
    fluid: {
      true: "max-w-none",
      false: "",
    },
    centered: {
      true: "flex items-center justify-center",
      false: "",
    },
  },
  defaultVariants: {
    fluid: false,
    centered: false,
  },
});

export interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {
  asChild?: boolean;
}

function Container({
  className,
  fluid,
  centered,
  asChild = false,
  ...props
}: ContainerProps) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn(containerVariants({ fluid, centered, className }))}
      {...props}
    />
  );
}

export { Container, containerVariants };
