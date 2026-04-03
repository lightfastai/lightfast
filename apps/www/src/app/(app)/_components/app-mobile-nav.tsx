"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import {
  Sheet,
  SheetPrimitive,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Menu, X } from "lucide-react";
import * as React from "react";
import { NavLink } from "~/components/nav-link";
import { INTERNAL_NAV, RESOURCES_NAV, SOCIAL_NAV } from "~/config/nav";

export function AppMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <button
          aria-label="Toggle Menu"
          className="p-2 text-foreground/60 transition-colors hover:text-foreground md:hidden"
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <SheetPrimitive.Content className="data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 h-full w-screen bg-background data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500">
          {/* Visually hidden title for accessibility */}
          <SheetPrimitive.Title className="sr-only">
            Navigation Menu
          </SheetPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <SheetPrimitive.Close className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-70">
              <X className="h-5 w-5" />
              <span className="font-medium text-lg">Menu</span>
            </SheetPrimitive.Close>
          </div>

          {/* Content */}
          <div className="flex h-[calc(100vh-5rem)] flex-col">
            <ScrollArea className="flex-1 overflow-hidden">
              <div className="space-y-6 px-6">
                {/* Resources section */}
                <div className="space-y-3">
                  <div className="text-muted-foreground text-sm uppercase tracking-wide">
                    Resources
                  </div>
                  <div className="space-y-1">
                    {RESOURCES_NAV.map((item) => (
                      <NavLink
                        {...item}
                        className="block py-1 font-medium text-foreground text-lg transition-colors hover:text-muted-foreground"
                        key={item.href}
                        onClick={() => setOpen(false)}
                        prefetch
                      >
                        {item.title}
                      </NavLink>
                    ))}
                  </div>
                </div>

                {/* Top-level nav items */}
                <div className="space-y-3">
                  <div className="text-muted-foreground text-sm uppercase tracking-wide">
                    More
                  </div>
                  <div className="space-y-1">
                    {INTERNAL_NAV.map((item) => (
                      <NavLink
                        {...item}
                        className="block py-1 font-medium text-foreground text-lg transition-colors hover:text-muted-foreground"
                        key={item.href}
                        onClick={() => setOpen(false)}
                        prefetch
                      >
                        {item.title}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* CTA buttons */}
            <div className="space-y-3 border-t p-6">
              <Button asChild className="w-full" size="lg">
                <MicrofrontendLink
                  href="/early-access"
                  onClick={() => setOpen(false)}
                  prefetch={true}
                >
                  Join Early Access
                </MicrofrontendLink>
              </Button>
              <Button asChild className="w-full" size="lg" variant="outline">
                <MicrofrontendLink
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  prefetch={true}
                >
                  Sign in
                </MicrofrontendLink>
              </Button>
            </div>

            {/* Footer with social links */}
            <div className="flex items-center justify-center gap-6 border-t p-6">
              {SOCIAL_NAV.map((item) => (
                <a
                  aria-label={item.title}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  href={item.href}
                  key={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {item.icon === "twitter" && (
                    <Icons.twitter className="h-5 w-5" />
                  )}
                  {item.icon === "gitHub" && (
                    <Icons.gitHub className="h-5 w-5" />
                  )}
                  {item.icon === "discord" && (
                    <Icons.discord className="h-5 w-5" />
                  )}
                </a>
              ))}
            </div>
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
