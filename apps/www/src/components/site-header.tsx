import Link from "next/link";
import { ZapIcon } from "lucide-react";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";

export function SiteHeader() {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/">
            <Icons.logoShort className="text-foreground h-5 w-6" />
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-foreground/70 hover:text-foreground text-sm font-medium transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/download"
              className="text-foreground/70 hover:text-foreground text-sm font-medium transition-colors"
            >
              Download
            </Link>
          </nav>
        </div>
        <Button asChild variant="outline">
          <Link
            className="text-foreground flex items-center"
            href="https://chat.lightfast.ai"
          >
            <ZapIcon className="mr-1 h-4 w-4" />
            Go to Chat App
          </Link>
        </Button>
      </div>
    </header>
  );
}
