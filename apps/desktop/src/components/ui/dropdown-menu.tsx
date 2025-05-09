"use client";

import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { buttonVariants } from "@repo/ui/components/ui/button";
import {
  DropdownMenu as BaseDropdownMenu,
  DropdownMenuContent as BaseDropdownMenuContent,
  DropdownMenuItem as BaseDropdownMenuItem,
  DropdownMenuSeparator as BaseDropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";

// Re-export all components except the ones we want to customize
export {
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

// Customize DropdownMenuContent with our own styling
export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof BaseDropdownMenuContent>,
  React.ComponentPropsWithoutRef<typeof BaseDropdownMenuContent>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <BaseDropdownMenuContent
    ref={ref}
    sideOffset={sideOffset}
    className={cn("rounded-none p-0", className)}
    {...props}
  />
));
DropdownMenuContent.displayName = "DropdownMenuContent";

// Customize DropdownMenuItem with our own styling
export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof BaseDropdownMenuItem>,
  React.ComponentPropsWithoutRef<typeof BaseDropdownMenuItem> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>(({ className, inset, variant = "default", ...props }, ref) => (
  <BaseDropdownMenuItem
    ref={ref}
    className={cn("text-xs", className)}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof BaseDropdownMenuSeparator>,
  React.ComponentPropsWithoutRef<typeof BaseDropdownMenuSeparator>
>(({ className, ...props }, ref) => (
  <BaseDropdownMenuSeparator
    ref={ref}
    className={cn(className, "m-0 p-0")}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

// Re-export the base DropdownMenu
export const DropdownMenu = BaseDropdownMenu;

export const DropdownMenuTriggerButton = (
  {
    asChild = false,
    variant = "default",
    size = "default",
    children,
    ...props
  }: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    },
  ref: React.ForwardedRef<HTMLButtonElement>,
) => {
  const Comp = asChild ? Slot : "button";

  const button = (
    <Comp
      ref={ref}
      data-slot="dropdown-menu-trigger"
      className={cn(
        buttonVariants({ variant, size }),
        "h-7 px-2 py-1 has-[>svg]:px-2",
        props.className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );

  return button;
};

// Forward ref using React.forwardRef after function definition
const ForwardedDropdownMenuTriggerButton = React.forwardRef(
  DropdownMenuTriggerButton,
);
ForwardedDropdownMenuTriggerButton.displayName = "DropdownMenuTriggerButton";
//Export
export { ForwardedDropdownMenuTriggerButton };
