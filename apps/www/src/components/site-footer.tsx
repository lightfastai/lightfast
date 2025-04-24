import Link from "next/link";
import { Dot } from "lucide-react";

import { Icons } from "~/components/icons";
import { siteConfig } from "~/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full px-4 py-12 md:px-6">
      <div className="container mx-auto flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <div className="flex items-center gap-4">
          <Link
            target="_blank"
            href={siteConfig.links.github.href}
            aria-label="GitHub"
            className="transition-transform duration-200 hover:scale-110"
          >
            <Icons.gitHub className="size-4 transition-colors duration-200 hover:text-foreground" />
          </Link>
          <Link
            target="_blank"
            href={siteConfig.links.discord.href}
            aria-label="Discord"
            className="transition-transform duration-200 hover:scale-110"
          >
            <Icons.discord className="size-4 transition-colors duration-200 hover:text-foreground" />
          </Link>
          <Link
            target="_blank"
            href={siteConfig.links.twitter.href}
            aria-label="Twitter"
            className="transition-transform duration-200 hover:scale-110"
          >
            <Icons.twitter className="size-3 transition-colors duration-200 hover:text-foreground" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-2">
          <nav className="flex items-center gap-2 md:gap-4">
            <Link
              prefetch={true}
              href="/"
              className="text-xs transition-all duration-200 hover:text-foreground hover:underline hover:underline-offset-4"
            >
              Home
            </Link>
            <Dot className="size-2" />
            <Link
              prefetch={true}
              href="/legal/privacy"
              className="text-xs transition-all duration-200 hover:text-foreground hover:underline hover:underline-offset-4"
            >
              Privacy
            </Link>
            <Dot className="size-2" />
            <Link
              prefetch={true}
              href="/legal/terms"
              className="text-xs transition-all duration-200 hover:text-foreground hover:underline hover:underline-offset-4"
            >
              Terms
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="group relative text-xs">
            <span className="relative inline-block transition-all duration-300 group-hover:-translate-y-1 group-hover:text-foreground">
              {siteConfig.name}
            </span>
            <span className="relative mx-1 inline-block transition-all duration-300 group-hover:text-primary group-hover:opacity-0">
              Inc.
            </span>
            <span className="relative inline-block transition-all duration-300 group-hover:text-muted group-hover:opacity-0">
              ©
            </span>
            <span className="relative ml-1 inline-block transition-all duration-300 group-hover:-translate-y-1 group-hover:text-foreground">
              {new Date().getFullYear()}
            </span>
            <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-gradient-to-r from-primary/40 via-primary to-primary/40 transition-all duration-500 group-hover:w-full" />
          </span>
        </div>
      </div>
    </footer>
  );
}
