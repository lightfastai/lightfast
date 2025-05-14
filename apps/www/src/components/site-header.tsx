import Link from "next/link";

import { Container } from "@repo/ui/components/ui/container";

import { siteConfig } from "~/config/site";

export function SiteHeader() {
  return (
    <header className="w-full py-12">
      <Container>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-4">
              <h1 className="py-2 text-lg font-semibold tracking-widest uppercase">
                <span className="">{siteConfig.name}.</span>{" "}
              </h1>
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}
