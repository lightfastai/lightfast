import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import Link from "next/link";
import type React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navbar aligned with marketing header structure */}
      <header className="page-gutter fixed top-0 right-0 left-0 z-50 shrink-0 bg-background py-4">
        <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
          {/* Left: Logo — routes to www via microfrontend */}
          <div className="-ml-2 flex items-center md:justify-self-start">
            <MicrofrontendLink
              className="flex items-center"
              href="/"
              prefetch={true}
            >
              <Icons.logoShort className="h-4 w-4 text-foreground" />
            </MicrofrontendLink>
          </div>
          {/* Center placeholder to mirror marketing layout */}
          <div aria-hidden className="hidden md:block" />
          {/* Right: Waitlist CTA — same app now, use next/link */}
          <div className="flex items-center gap-2 md:justify-self-end">
            <Button
              asChild
              className="rounded-full"
              size="lg"
              variant="secondary"
            >
              <Link href="/early-access" prefetch={true}>
                Join the Early Access
              </Link>
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
      {/* Footer — mirrors header height for perfect centering */}
      <footer className="page-gutter flex h-16 shrink-0 items-center justify-center md:h-20">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <MicrofrontendLink
            className="hover:text-foreground"
            href="/legal/terms"
            rel="noopener noreferrer"
            target="_blank"
          >
            Terms
          </MicrofrontendLink>
          <span
            aria-hidden
            className="size-0.5 rounded-full bg-muted-foreground/60"
          />
          <MicrofrontendLink
            className="hover:text-foreground"
            href="/legal/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Privacy
          </MicrofrontendLink>
        </div>
      </footer>
    </div>
  );
}
