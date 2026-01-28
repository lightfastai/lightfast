"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetPrimitive,
} from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

const MENU_ITEMS = [
  { title: "Home", href: "/" },
  { title: "Pricing", href: "/pricing" },
  { title: "Blog", href: "/blog" },
  { title: "Changelog", href: "/changelog" },
  { title: "Docs", href: "/docs/get-started/overview" },
  { title: "Contact", href: "mailto:jp@lightfast.ai" },
];

export function PitchDeckMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-screen flex-col bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
          <SheetPrimitive.Title className="sr-only">
            Navigation Menu
          </SheetPrimitive.Title>

          {/* Header with close button */}
          <div className="flex items-center justify-between p-6 pb-4">
            <SheetPrimitive.Close className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
              <X className="h-5 w-5" />
              <span className="text-lg font-medium">Menu</span>
            </SheetPrimitive.Close>
          </div>

          {/* Navigation links */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="px-6">
              <nav className="space-y-1">
                {MENU_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block text-2xl font-medium py-3 text-foreground hover:text-muted-foreground transition-colors"
                  >
                    {item.title}
                  </Link>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
