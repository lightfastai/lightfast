"use client";

import * as React from "react";

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
