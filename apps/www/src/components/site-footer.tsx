import Link from "next/link";
import { Dot } from "lucide-react";

import { Icons } from "~/app/icons";
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
          >
            <Icons.gitHub className="size-4 hover:text-foreground" />
          </Link>
          <Link
            target="_blank"
            href={siteConfig.links.discord.href}
            aria-label="Discord"
          >
            <Icons.discord className="size-4 hover:text-foreground" />
          </Link>
          <Link
            target="_blank"
            href={siteConfig.links.twitter.href}
            aria-label="Twitter"
          >
            <Icons.twitter className="size-3 hover:text-foreground" />
          </Link>
        </div>

        <div className="flex flex-col items-center gap-2">
          <nav className="flex items-center gap-2 md:gap-4">
            <Link
              prefetch={true}
              href="/"
              className="text-xs hover:text-foreground"
            >
              Home
            </Link>
            <Dot className="size-2" />
            <Link
              prefetch={true}
              href="/legal/privacy"
              className="text-xs hover:text-foreground"
            >
              Privacy
            </Link>
            <Dot className="size-2" />
            <Link
              prefetch={true}
              href="/legal/terms"
              className="text-xs hover:text-foreground"
            >
              Terms
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs">
            {siteConfig.name} Inc. © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
