import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@repo/ui-v2/lib/utils"
import { Button } from "@repo/ui-v2/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

type SheetMotion = "subtle" | "slide"
type SheetSize = "default" | "wide"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  motion = "subtle",
  size = "default",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  motion?: SheetMotion
  size?: SheetSize
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          motion === "slide"
            ? "fixed z-50 flex flex-col bg-background bg-clip-padding text-sm text-foreground shadow-xl transition-transform ease-[cubic-bezier(0.22,1,0.36,1)] data-open:duration-[1250ms] data-closed:duration-[650ms]"
            : "fixed z-50 flex flex-col bg-background bg-clip-padding text-sm text-foreground shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          side === "right" &&
            (motion === "slide"
              ? "inset-y-0 right-0 h-full translate-x-full border-l data-closed:translate-x-full data-ending-style:translate-x-full data-open:translate-x-0 data-starting-style:translate-x-full"
              : "inset-y-0 right-0 h-full w-3/4 border-l data-ending-style:translate-x-[2.5rem] data-starting-style:translate-x-[2.5rem] sm:max-w-sm"),
          side === "left" &&
            (motion === "slide"
              ? "inset-y-0 left-0 h-full -translate-x-full border-r data-closed:-translate-x-full data-ending-style:-translate-x-full data-open:translate-x-0 data-starting-style:-translate-x-full"
              : "inset-y-0 left-0 h-full w-3/4 border-r data-ending-style:translate-x-[-2.5rem] data-starting-style:translate-x-[-2.5rem] sm:max-w-sm"),
          side === "top" &&
            (motion === "slide"
              ? "inset-x-0 top-0 -translate-y-full border-b data-closed:-translate-y-full data-ending-style:-translate-y-full data-open:translate-y-0 data-starting-style:-translate-y-full"
              : "inset-x-0 top-0 h-auto border-b data-ending-style:translate-y-[-2.5rem] data-starting-style:translate-y-[-2.5rem]"),
          side === "bottom" &&
            (motion === "slide"
              ? "inset-x-0 bottom-0 translate-y-full border-t data-closed:translate-y-full data-ending-style:translate-y-full data-open:translate-y-0 data-starting-style:translate-y-full"
              : "inset-x-0 bottom-0 h-auto border-t data-ending-style:translate-y-[2.5rem] data-starting-style:translate-y-[2.5rem]"),
          side === "right" || side === "left"
            ? size === "wide"
              ? "w-full sm:max-w-xl"
              : "w-3/4 sm:max-w-sm"
            : size === "wide"
              ? "h-auto max-h-[720px]"
              : "h-auto",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 right-4 bg-secondary"
                size="icon-sm"
              />
            }
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-6", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
