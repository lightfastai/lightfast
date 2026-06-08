import { Icons } from "@repo/ui/components/icons";
import type { ReactNode } from "react";
import { AuthHeaderCta } from "./auth-header-cta";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-rows-[4rem_1fr_4rem] bg-background md:grid-rows-[5rem_1fr_5rem]">
      <header className="page-gutter sticky top-0 z-50 flex h-16 items-center bg-background md:h-20">
        <div className="flex w-full items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="-ml-2 flex items-center md:justify-self-start">
            <a className="flex items-center" href="/">
              <Icons.logoShort className="h-4 w-4 text-foreground" />
            </a>
          </div>
          <div aria-hidden className="hidden md:block" />
          <div className="flex items-center gap-2 md:justify-self-end">
            <AuthHeaderCta />
          </div>
        </div>
      </header>

      <main className="grid place-items-center px-4 pb-8 md:pb-12">
        <div className="w-full max-w-xs">{children}</div>
      </main>

      <footer className="page-gutter flex h-16 items-center justify-center md:h-20">
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <a
            className="hover:text-foreground"
            href="/legal/terms"
            rel="noopener noreferrer"
            target="_blank"
          >
            Terms
          </a>
          <span
            aria-hidden
            className="size-0.5 rounded-full bg-muted-foreground/60"
          />
          <a
            className="hover:text-foreground"
            href="/legal/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Privacy
          </a>
        </div>
      </footer>
    </div>
  );
}
