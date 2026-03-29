"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Sheet,
  SheetPrimitive,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Menu, X } from "lucide-react";
import * as React from "react";
import { NavLink } from "~/components/nav-link";
import { PITCH_DECK_NAV } from "~/config/nav";

const linkClass =
  "block py-3 font-medium text-2xl text-foreground transition-colors hover:text-muted-foreground";

export function PitchDeckMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button
          aria-label="Open menu"
          className="md:hidden"
          size="icon"
          variant="ghost"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <SheetPrimitive.Content className="data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex h-full w-screen flex-col bg-background/95 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500">
          <SheetPrimitive.Title className="sr-only">
            Navigation Menu
          </SheetPrimitive.Title>

          {/* Header with close button */}
          <div className="flex items-center justify-between p-6 pb-4">
            <SheetPrimitive.Close className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-70">
              <X className="h-5 w-5" />
              <span className="font-medium text-lg">Menu</span>
            </SheetPrimitive.Close>
          </div>

          {/* Navigation links */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="px-6">
              <nav className="space-y-1">
                {PITCH_DECK_NAV.map((item) => (
                  <NavLink
                    {...item}
                    className={linkClass}
                    key={item.href}
                    onClick={() => setOpen(false)}
                  >
                    {item.title}
                  </NavLink>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
