"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@repo/ui/lib/utils";

function Avatar({
  className,
  shape = "square",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  shape?: "circle" | "square";
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-shape={shape}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-md data-[shape=circle]:rounded-full",
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-md group-data-[shape=circle]/avatar:rounded-full",
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-md bg-muted group-data-[shape=circle]/avatar:rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
