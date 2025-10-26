"use client";

import Link from "next/link";
import { useState } from "react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Menu, X } from "lucide-react";
import { BrandingMenuSheet } from "./branding-menu-sheet";

/**
 * BrandingNavbar - Navigation for branding pages
 *
 * Features:
 * - Full-screen sheet menu overlay
 * - Logo on left
 * - Menu button in center
 * - Contact button on right
 * - Minimal, clean design for brand pages
 */
export function BrandingNavbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <header className="absolute manifesto-page top-0 left-0 right-0 z-50">
        <div className="mx-auto px-8 sm:px-16">
          <div className="relative flex items-center justify-between py-8">
            {/* Logo - Left */}
            <div className="-ml-2 flex items-center">
              <Button variant="ghost" size="lg" className="group" asChild>
                <Link href="/">
                  <Icons.logo className="size-22 text-foreground transition-colors group-hover:text-white" />
                </Link>
              </Button>
            </div>

            {/* Menu Button - Absolute Center */}
            <div className="absolute left-1/2 -translate-x-1/2">
              <Button
                variant="outline"
                size="lg"
                className="w-96 justify-between group hover:bg-accent border border-border/20 bg-muted/50 backdrop-blur-xl shadow-lg"
                onClick={() => setIsOpen(!isOpen)}
              >
                <span className="text-sm text-foreground font-medium uppercase tracking-wider">
                  Menu
                </span>
                {isOpen ? (
                  <X className="h-4 w-4 text-foreground" />
                ) : (
                  <Menu className="h-4 w-4 text-foreground" />
                )}
              </Button>
            </div>

            {/* Contact Button - Right */}
            <div className="ml-auto">
              <Button variant="ghost" size="lg" asChild>
                <Link href="/contact">
                  <span className="text-sm text-foreground font-medium uppercase tracking-wider">
                    Contact
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Menu Sheet */}
      <BrandingMenuSheet open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
