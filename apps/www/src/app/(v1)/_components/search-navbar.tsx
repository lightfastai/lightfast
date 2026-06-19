"use client";

import { Button } from "@repo/ui/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NavLink } from "~/components/nav-link";

export function SearchNavbar() {
  return (
    <nav className="page-gutter fixed top-0 right-0 left-0 z-20 flex items-center justify-between border-b py-4">
      <Button asChild className="rounded-full" size="icon" variant="outline">
        <NavLink href="/" prefetch>
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          <span className="sr-only">Back</span>
        </NavLink>
      </Button>

      <div className="flex items-center gap-4">
        <Button asChild className="rounded-full" size="lg" variant="secondary">
          <NavLink href="/sign-in" microfrontend prefetch>
            <span className="font-medium text-foreground text-sm">Log In</span>
          </NavLink>
        </Button>
      </div>
    </nav>
  );
}
