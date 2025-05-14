import Link from "next/link";

import { Container } from "@repo/ui/components/ui/container";

import { Icons } from "~/components/icons";
import { siteConfig } from "~/config/site";

export function SiteHeader() {
  return (
    <header className="w-full py-6">
      <Container>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center space-x-2">
              <Icons.logo className="size-4" />
              <h1 className="text-md py-2 font-semibold">
                <span className="">{siteConfig.name}</span>{" "}
                <span className="relative inline-block bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text font-mono text-transparent">
                  Computer
                </span>
              </h1>
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}
