import Link from "next/link";

import { Icons } from "@repo/ui/components/icons";
import { Container } from "@repo/ui/components/ui/container";

export function SiteHeader() {
  return (
    <header className="w-full py-12">
      <Container>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-4">
              <Icons.logoShort className="w-24" />
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}
