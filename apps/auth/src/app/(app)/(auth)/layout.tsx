import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { RedirectToTasks, Show } from "@vendor/clerk/client";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Show when="signed-out">
        <RedirectToTasks />
      </Show>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Top Navbar aligned with marketing header structure */}
        <header className="page-gutter fixed top-0 right-0 left-0 z-50 shrink-0 bg-background py-4">
          <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
            {/* Left: Logo */}
            <div className="-ml-2 flex items-center md:justify-self-start">
              <MicrofrontendLink className="flex items-center" href="/">
                <Icons.logoShort className="h-4 w-4 text-foreground" />
              </MicrofrontendLink>
            </div>
            {/* Center placeholder to mirror marketing layout */}
            <div aria-hidden className="hidden md:block" />
            {/* Right: Waitlist CTA */}
            <div className="flex items-center gap-2 md:justify-self-end">
              <Button
                asChild
                className="rounded-full"
                size="lg"
                variant="secondary"
              >
                <MicrofrontendLink href="/early-access">
                  Join the Early Access
                </MicrofrontendLink>
              </Button>
            </div>
          </div>
        </header>

        {/* Spacer to offset fixed navbar height */}
        <div aria-hidden className="h-16 shrink-0 md:h-20" />

        {/* Main Content */}
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="w-full max-w-xs">{children}</div>
        </main>
        {/* Bottom spacer to mirror header height for perfect centering */}
        <div aria-hidden className="h-16 shrink-0 md:h-20" />
      </div>
    </>
  );
}
