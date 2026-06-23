import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logo } from "@repo/ui-v2/components/brand/logo";
import { Button } from "@repo/ui-v2/components/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { Newsletter } from "./newsletter";

export function Footer() {
  return (
    <footer className="min-h-svh bg-background text-foreground">
      <div className="relative flex min-h-svh flex-col justify-between gap-32 pt-28 pb-8 sm:pt-32 lg:block lg:pt-24">
        <div className="px-6 sm:px-10 lg:absolute lg:inset-x-0 lg:top-24 lg:pr-8 lg:pl-80">
          <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            <FooterColumn label="Socials">
              <nav
                aria-label="Social links"
                className="flex flex-col items-start gap-2"
              >
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={
                    <a
                      href="https://x.com/lightfastai"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      X
                    </a>
                  }
                  variant="link"
                />
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={
                    <a
                      href="https://github.com/lightfastai"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      GitHub
                    </a>
                  }
                  variant="link"
                />
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={
                    <a
                      href="https://www.linkedin.com/company/lightfastai"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      LinkedIn
                    </a>
                  }
                  variant="link"
                />
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={
                    <a
                      href="https://discord.gg/YqPDfcar2C"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Discord
                    </a>
                  }
                  variant="link"
                />
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={<a href="mailto:hello@lightfast.ai">Contact</a>}
                  variant="link"
                />
              </nav>
            </FooterColumn>

            <FooterColumn
              className="sm:col-span-2 lg:col-start-3"
              label="Newsletter"
            >
              <p className="w-full text-base leading-tight">
                Subscribe to research notes and project updates
              </p>
              <Newsletter />
            </FooterColumn>
          </div>
        </div>

        <div className="flex justify-center px-6 sm:px-10 lg:absolute lg:inset-x-0 lg:top-1/2 lg:-translate-y-1/2 lg:px-8">
          <Logo className="text-foreground" size="md" />
        </div>

        <div className="px-6 sm:px-10 lg:absolute lg:inset-x-0 lg:bottom-8 lg:px-8">
          <nav
            aria-label="Legal links"
            className="grid grid-cols-1 gap-3 text-xs leading-tight sm:grid-cols-4 sm:items-center"
          >
            <p className="py-0.5 sm:justify-self-start">©2026 Lightfast</p>
            <div className="sm:justify-self-center">
              <Link className="block py-0.5 hover:underline" href="/brand">
                Brand Guidelines
              </Link>
            </div>
            <div className="sm:justify-self-center">
              <Link
                className="block py-0.5 hover:underline"
                href="/legal/terms"
              >
                Terms of Use
              </Link>
            </div>
            <div className="flex items-center sm:justify-self-end">
              <Link
                className="block py-0.5 hover:underline"
                href="/legal/privacy"
              >
                Privacy Policy
              </Link>
              <a
                className="ml-5 hidden items-center justify-end gap-1 border-background border-b py-0.5 no-underline hover:underline"
                href="#top"
              >
                <span>To top</span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4"
                  icon={ArrowUp01Icon}
                  strokeWidth={2}
                />
              </a>
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground text-xs leading-tight">{label}</p>
        {children}
      </div>
    </div>
  );
}
