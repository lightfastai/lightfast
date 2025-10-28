"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Menu, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { wwwUrl, authUrl } from "~/lib/related-projects";
import { BrandingMenuSheet } from "~/components/landing/branding-menu-sheet";

export function SearchNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <nav className="flex-shrink-0 flex items-center justify-between px-12 py-4 bg-background/80 backdrop-blur-sm">
        <Button variant="outline" size="icon" className="rounded-full" asChild>
          <Link href={wwwUrl}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="lg" className="rounded-full" asChild>
            <Link href={`${authUrl}/sign-in`}>
              <span className="text-xs text-foreground font-medium uppercase tracking-widest">
                Sign In
              </span>
            </Link>
          </Button>

          {/* Menu Button */}
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-5 w-5 text-foreground" />
            ) : (
              <Menu className="h-5 w-5 text-foreground" />
            )}
            <span className="sr-only">Menu</span>
          </Button>
        </div>
      </nav>

      {/* Menu Sheet */}
      <BrandingMenuSheet open={isMenuOpen} onOpenChange={setIsMenuOpen} />
    </>
  );
}
