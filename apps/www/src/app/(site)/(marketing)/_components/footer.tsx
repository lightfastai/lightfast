import {
  ArrowRight01Icon,
  ArrowUp01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { About } from "./about";
import { FooterArcadeSlot } from "./footer-arcade-slot";

export function Footer() {
  return (
    <footer className="min-h-[calc(100svh-4rem)] bg-background px-6 text-foreground sm:px-10">
      <div className="mx-auto w-full max-w-[1960px]">
        <div className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-between gap-[12.5rem] py-7 max-[479px]:gap-16 max-[767px]:gap-[6.25rem] max-[991px]:gap-[8.75rem]">
          <div className="grid w-full grid-cols-4 gap-5 max-[991px]:grid-cols-2">
            <FooterColumn label="Menu">
              <nav
                aria-label="Footer menu"
                className="flex flex-col items-start gap-2"
              >
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={<Link href="/" />}
                  variant="link"
                >
                  Home
                </Button>
                <About className="h-auto justify-start py-0.5 font-normal text-base leading-tight">
                  About
                </About>
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={<Link href="/blog" />}
                  variant="link"
                >
                  Blog
                </Button>
                <Button
                  className="h-auto justify-start px-0 py-0.5 font-normal text-base leading-tight"
                  nativeButton={false}
                  render={<Link href="/brand" />}
                  variant="link"
                >
                  Brand
                </Button>
              </nav>
            </FooterColumn>

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

            <FooterColumn className="col-span-2" label="Newsletter">
              <p className="w-full text-base leading-tight max-[479px]:w-[13.13rem]">
                Subscribe to research notes and project updates
              </p>
              <div className="w-full">
                <form className="relative flex items-center" method="get">
                  <label className="sr-only" htmlFor="footer-newsletter-email">
                    Email address
                  </label>
                  <input
                    className="m-0 w-full cursor-pointer border border-border bg-muted p-3 pr-32 text-xs leading-tight outline-none transition-colors placeholder:text-foreground hover:border-muted-foreground/30 focus:border-ring"
                    id="footer-newsletter-email"
                    maxLength={256}
                    name="email"
                    placeholder="Email address"
                    type="email"
                  />
                  <button
                    className="absolute inset-y-0 right-0 flex h-full cursor-pointer items-center gap-2 bg-transparent p-3 text-xs leading-tight transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none"
                    type="submit"
                  >
                    <span>Subscribe</span>
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-4"
                      icon={ArrowRight01Icon}
                      strokeWidth={2}
                    />
                  </button>
                </form>
                <div className="hidden bg-muted p-3">
                  <p className="text-xs leading-tight">
                    Got it! Stay tuned for updates
                  </p>
                </div>
                <div className="mt-2 hidden bg-transparent pl-3">
                  <p className="text-destructive text-xs leading-tight">
                    Please enter your email
                  </p>
                </div>
                <p className="mt-2 text-muted-foreground text-xs leading-tight">
                  Separate from the waitlist. Unsubscribe anytime. See our{" "}
                  <Link className="underline" href="/legal/privacy">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </FooterColumn>
          </div>

          <FooterArcadeSlot />

          <div className="grid w-full grid-cols-4 place-items-center gap-5 text-xs leading-tight max-[991px]:grid-cols-2 max-[991px]:grid-rows-2 max-[479px]:gap-3">
            <div className="max-[991px]:order-[9999] max-[991px]:justify-self-end">
              <p className="py-0.5">©2026 Lightfast</p>
            </div>
            <div className="max-[991px]:justify-self-end">
              <Link className="block py-0.5 hover:underline" href="/brand">
                Brand Guidelines
              </Link>
            </div>
            <div className="max-[991px]:order-[-9999]">
              <Link
                className="block py-0.5 hover:underline"
                href="/legal/terms"
              >
                Terms of Use
              </Link>
            </div>
            <div className="flex items-center justify-between justify-self-end max-[991px]:justify-self-start">
              <Link
                className="block py-0.5 hover:underline"
                href="/legal/privacy"
              >
                Privacy Policy
              </Link>
              <a
                className="ml-5 hidden items-center justify-end gap-1 border-background border-b py-0.5 no-underline hover:underline max-[479px]:justify-start"
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
          </div>
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
