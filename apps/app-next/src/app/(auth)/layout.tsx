import { Icons } from "@repo/ui/components/icons";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type React from "react";
import { AuthHeaderCta } from "./_components/auth-header-cta";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-rows-[4rem_1fr_4rem] bg-background md:grid-rows-[5rem_1fr_5rem]">
      {/* Top Navbar — sticky so it occupies its grid row (matching footer height) */}
      <header className="page-gutter sticky top-0 z-50 flex h-16 items-center bg-background md:h-20">
        <div className="flex w-full items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
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
          {/* Right: contextual auth CTA */}
          <div className="flex items-center gap-2 md:justify-self-end">
            <AuthHeaderCta />
          </div>
        </div>
      </header>

      {/* Main Content — row 2 (1fr). Extra bottom padding shifts the card up
          so the heavy primary CTA sits at the optical center (eye perceives
          geometric center as low when visual weight is bottom-loaded). */}
      <main className="grid place-items-center px-4 pb-8 md:pb-12">
        <div className="w-full max-w-xs">{children}</div>
      </main>
      {/* Footer — same height as header row for exact top/bottom symmetry */}
      <footer className="page-gutter flex h-16 items-center justify-center md:h-20">
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
