import Link from "next/link";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Container } from "@repo/ui/components/ui/container";

export function SiteHeader() {
  return (
    <header className="h-16 w-full">
      <Container className="h-full">
        <div className="flex h-full items-center justify-between">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Icons.logo className="w-28" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">
            <span className="text-muted-foreground text-sm">Have access?</span>
            <Button variant="default" size="sm" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </Container>
    </header>
  );
}
