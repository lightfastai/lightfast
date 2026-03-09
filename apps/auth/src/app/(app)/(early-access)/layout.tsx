import { ArrowLeft } from "lucide-react";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import type React from "react";

export default function EarlyAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="page-gutter fixed top-0 right-0 left-0 z-50 shrink-0 bg-background py-4">
        <MicrofrontendLink
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </MicrofrontendLink>
      </header>

      <div aria-hidden className="h-16 shrink-0 md:h-20" />

      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
      <div aria-hidden className="h-16 shrink-0 md:h-20" />
    </div>
  );
}
