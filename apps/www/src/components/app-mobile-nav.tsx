"use client";

import * as React from "react";
import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Menu, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetPrimitive,
} from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import {
  FEATURES_NAV,
  INTERNAL_NAV,
  RESOURCES_NAV,
  SOCIAL_NAV,
} from "~/config/nav";

export function AppMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="lg:hidden p-2 text-foreground/60 hover:text-foreground transition-colors"
          aria-label="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 h-full w-screen bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
          {/* Visually hidden title for accessibility */}
          <SheetPrimitive.Title className="sr-only">
            Navigation Menu
          </SheetPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <SheetPrimitive.Close className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
              <X className="h-5 w-5" />
              <span className="text-lg font-medium">Menu</span>
            </SheetPrimitive.Close>
          </div>

          {/* Content */}
          <div className="flex flex-col h-[calc(100vh-5rem)]">
            <ScrollArea className="flex-1 overflow-hidden">
              <div className="px-6 space-y-6">
                {/* Features section */}
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    Features
                  </div>
                  <div className="space-y-1">
                    {FEATURES_NAV.map((item) => (
                      <NextLink
                        key={item.href}
                        href={item.href}
                        prefetch
                        onClick={() => setOpen(false)}
                        className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                      >
                        {item.title}
                      </NextLink>
                    ))}
                  </div>
                </div>

                {/* Resources section */}
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    Resources
                  </div>
                  <div className="space-y-1">
                    {RESOURCES_NAV.map((item) => (
                      <NextLink
                        key={item.href}
                        href={item.href}
                        prefetch
                        onClick={() => setOpen(false)}
                        className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                      >
                        {item.title}
                      </NextLink>
                    ))}
                  </div>
                </div>

                {/* Top-level nav items */}
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    More
                  </div>
                  <div className="space-y-1">
                    {INTERNAL_NAV.filter((i) => i.href !== "/features").map(
                      (item) =>
                        item.microfrontend ? (
                          <MicrofrontendLink
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                          >
                            {item.title}
                          </MicrofrontendLink>
                        ) : (
                          <NextLink
                            key={item.href}
                            href={item.href}
                            prefetch
                            onClick={() => setOpen(false)}
                            className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                          >
                            {item.title}
                          </NextLink>
                        )
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* CTA buttons */}
            <div className="border-t p-6 space-y-3">
              <Button asChild size="lg" className="w-full">
                <NextLink
                  href="/early-access"
                  prefetch
                  onClick={() => setOpen(false)}
                >
                  Join Early Access
                </NextLink>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <MicrofrontendLink
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </MicrofrontendLink>
              </Button>
            </div>

            {/* Footer with social links */}
            <div className="border-t p-6 flex items-center justify-center gap-6">
              {SOCIAL_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={item.title}
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
