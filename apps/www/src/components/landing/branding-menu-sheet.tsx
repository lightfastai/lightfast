"use client";

import Link from "next/link";
import localFont from "next/font/local";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { X } from "lucide-react";
import { motion } from "framer-motion";

const exposureTrial = localFont({
  src: "../../../public/fonts/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
});

const MENU_ITEMS = [
  { label: "Manifesto", href: "/manifesto" },
  { label: "Contact", href: "#contact" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
] as const;

const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/lightfastai", icon: "twitter" },
  { label: "GitHub", href: "https://github.com/lightfastai", icon: "gitHub" },
  { label: "Discord", href: "#discord", icon: "discord" },
] as const;

interface BrandingMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * BrandingMenuSheet - Full-screen menu overlay for branding pages
 *
 * Features:
 * - Slides down from top (2/3 viewport height)
 * - Large menu items in 2-column grid
 * - Social links in bottom right
 * - Staggered animations
 */
export function BrandingMenuSheet({
  open,
  onOpenChange,
}: BrandingMenuSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="h-2/3 p-0 [&>button]:hidden">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        {/* Header with Logo and Close Button */}
        <div className="absolute top-0 left-0 right-0 px-8 sm:px-16 py-8 flex items-center justify-between">
          <div className="-ml-2">
            <Link href="/" onClick={() => onOpenChange(false)}>
              <Icons.logo className="size-22 text-foreground" />
            </Link>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" className="rounded-full">
              <X className="h-6 w-6 text-foreground" />
            </Button>
          </SheetClose>
        </div>

        {/* Menu Content - 3 Column Grid */}
        <div className="h-full px-8 sm:px-16 pb-8">
          <div className="grid grid-cols-3 gap-x-16 h-full w-full mx-auto max-w-7xl">
            {/* First Column - Empty */}
            <div className="col-span-1" />

            {/* Second Column - Nav Items + Social Links */}
            <div className="col-span-1 flex flex-col justify-between h-full">
              {/* Nav Items */}
              <div className="flex flex-col justify-center gap-y-12 flex-1">
                {MENU_ITEMS.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={`block font-light text-4xl md:text-5xl text-foreground transition-opacity hover:opacity-60 ${exposureTrial.className}`}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Social Links - Bottom of Second Column */}
              <div className="flex gap-4 mt-auto">
                {SOCIAL_LINKS.map((social, index) => {
                  const Icon = Icons[social.icon];
                  return (
                    <motion.div
                      key={social.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 + 0.4 }}
                    >
                      <Link
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full border border-border/20 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label={social.label}
                      >
                        <Icon className="w-5 h-5" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Third Column - Empty */}
            <div className="col-span-1" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
