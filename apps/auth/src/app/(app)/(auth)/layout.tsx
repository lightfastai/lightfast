import React from "react";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { SignedOut, RedirectToTasks } from "@clerk/nextjs";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SignedOut>
        <RedirectToTasks />
      </SignedOut>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Top Navbar aligned with marketing header structure */}
        <header className="shrink-0 fixed top-0 left-0 right-0 z-50 py-4 page-gutter bg-background">
          <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
            {/* Left: Logo */}
            <div className="-ml-2 flex items-center md:justify-self-start">
              <MicrofrontendLink href="/" className="flex items-center">
                <Icons.logoShort className="text-foreground h-4 w-4" />
              </MicrofrontendLink>
            </div>
            {/* Center placeholder to mirror marketing layout */}
            <div className="hidden md:block" aria-hidden />
            {/* Right: Waitlist CTA */}
            <div className="flex items-center gap-2 md:justify-self-end">
              <Button
                variant="secondary"
                size="lg"
                asChild
                className="rounded-full"
              >
                <MicrofrontendLink href="/early-access">
                  Join the Early Access
                </MicrofrontendLink>
              </Button>
            </div>
          </div>
        </header>

        {/* Spacer to offset fixed navbar height */}
        <div aria-hidden className="shrink-0 h-16 md:h-20" />

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-xs">{children}</div>
        </main>
        {/* Bottom spacer to mirror header height for perfect centering */}
        <div aria-hidden className="shrink-0 h-16 md:h-20" />
      </div>
    </>
  );
}
