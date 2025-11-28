"use client";

import Link from "~/components/ui/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export function SearchNavbar() {
  return (
    <nav className="fixed top-0 left-0 border-b right-0 z-20 page-gutter py-4 flex items-center justify-between">
      <Button variant="outline" size="icon" className="rounded-full" asChild>
        <Link href="/">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Back</span>
        </Link>
      </Button>

      <div className="flex items-center gap-4">
        <Button variant="secondary" size="lg" className="rounded-full" asChild>
          <Link href="/sign-in" microfrontend>
            <span className="text-sm text-foreground font-medium">Log In</span>
          </Link>
        </Button>
      </div>
    </nav>
  );
}
