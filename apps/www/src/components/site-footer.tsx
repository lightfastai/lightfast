import Link from "next/link";
import { Dot } from "lucide-react";

import { siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full px-4 py-12 md:px-6">
      <div className="text-muted-foreground container mx-auto flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
        <div className="flex items-center gap-4">
          <Link
            target="_blank"
            href={siteConfig.links.github.href}
            aria-label="GitHub"
            className="transition-transform duration-200 hover:scale-110"
          >
            <Icons.gitHub className="hover:text-foreground size-4 transition-colors duration-200" />
          </Link>
          <Link
            target="_blank"
            href={siteConfig.links.discord.href}
            aria-label="Discord"
            className="transition-transform duration-200 hover:scale-110"
          >
            <Icons.discord className="hover:text-foreground size-4 transition-colors duration-200" />
          </Link>
          <Link
            target="_blank"
            href={siteConfig.links.twitter.href}
            aria-label="Twitter"
            className="transition-transform duration-200 hover:scale-110"
          >
            <Icons.twitter className="hover:text-foreground size-3 transition-colors duration-200" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-2">
          <nav className="flex items-center gap-2 md:gap-4">
            <Link
              prefetch={true}
              href="/"
              className="hover:text-foreground text-xs transition-all duration-200 hover:underline hover:underline-offset-4"
            >
              Home
            </Link>
            <Dot className="size-2" />
            <Link
              prefetch={true}
              href="/legal/privacy"
              className="hover:text-foreground text-xs transition-all duration-200 hover:underline hover:underline-offset-4"
            >
              Privacy
            </Link>
            <Dot className="size-2" />
            <Link
              prefetch={true}
              href="/legal/terms"
              className="hover:text-foreground text-xs transition-all duration-200 hover:underline hover:underline-offset-4"
            >
              Terms
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="group relative cursor-default text-xs">
            <span className="group-hover:text-foreground relative inline-block transition-all duration-300 group-hover:-translate-y-1">
              {siteConfig.name}
            </span>
            <span className="group-hover:text-primary relative mx-1 inline-block transition-all duration-300 group-hover:opacity-0">
              Inc.
            </span>
            <span className="group-hover:text-muted relative inline-block transition-all duration-300 group-hover:opacity-0">
              ©
            </span>
            <span className="group-hover:text-foreground relative ml-1 inline-block transition-all duration-300 group-hover:-translate-y-1">
              {new Date().getFullYear()}
            </span>
            <span className="from-primary/40 via-primary to-primary/40 absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r transition-all duration-500 group-hover:w-full" />
          </span>
        </div>
      </div>
    </footer>
  );
}
