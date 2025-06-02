import type { ReactNode } from "react";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";

interface LegalLayoutProps {
  children: ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <div className="relative flex-1">
        <main className="h-full">
          <div className="container mx-auto flex min-h-[calc(100vh-12rem)] items-center justify-center px-4 py-8 sm:py-16">
            <div className="mx-auto max-w-2xl">{children}</div>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
