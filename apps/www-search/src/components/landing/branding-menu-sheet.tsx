"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { X, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { LIGHT_TRANSLATIONS } from "~/config/translations";
import { useTextCycle } from "~/hooks/use-text-cycle";
import { exposureTrial } from "~/lib/fonts";
import { LightfastSineWaveMatrix } from "./lightfast-sine-wave-matrix";
import { wwwUrl } from "~/lib/related-projects";

const NAV_ITEMS = [
  { label: "Home", href: wwwUrl },
  { label: "Search", href: "/search" },
  { label: "Pricing", href: `${wwwUrl}/pricing` },
  { label: "Updates", href: `${wwwUrl}/updates` },
  { label: "Docs", href: `${wwwUrl}/docs/get-started/overview` },
] as const;

const THIRD_COLUMN_ITEMS = [
  { label: "Manifesto", href: `${wwwUrl}/manifesto` },
  { label: "Contact", href: `${wwwUrl}/contact` },
  { label: "Terms", href: `${wwwUrl}/legal/terms` },
  { label: "Privacy", href: `${wwwUrl}/legal/privacy` },
] as const;

const SOCIAL_LINKS = [
  { label: "X", href: "https://x.com/lightfastai", icon: "twitter" },
  { label: "GitHub", href: "https://github.com/lightfastai", icon: "gitHub" },
  { label: "Discord", href: "#discord", icon: "discord" },
] as const;

// Get Japanese translation
const JAPANESE_LIGHT = LIGHT_TRANSLATIONS.find(
  (t) => t.language === "Japanese",
);

interface BrandingMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * BrandingMenuSheet - Full-screen menu overlay for branding pages
 *
 * Features:
 * - Slides down from top (2/3 viewport height)
 * - 3-column layout: Japanese "Light" | Navigation + Social | Legal
 * - Staggered animations
 * - Simplified for search app (no manifesto navigation overlay)
 */
export function BrandingMenuSheet({
  open,
  onOpenChange,
}: BrandingMenuSheetProps) {
  const pathname = usePathname();

  // Text cycling for Japanese "Light" on hover
  const { currentItem, start, reset, isActive } = useTextCycle(
    LIGHT_TRANSLATIONS,
    {
      interval: 500,
      loop: false,
    },
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="top"
        className="h-2/3 p-0 dark bg-background [&>button]:hidden border-border/30"
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>

        {/* Header with Logo and Close Button */}
        <div className="absolute top-0 left-0 right-0 px-8 sm:px-16 py-4 flex items-center justify-between">
          <div className="-ml-2 flex items-center">
            <Button variant="ghost" size="lg" className="group" asChild>
              <Link href={wwwUrl} onClick={() => onOpenChange(false)}>
                <Icons.logo className="size-22 text-foreground transition-colors group-hover:text-white" />
              </Link>
            </Button>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" className="rounded-full">
              <X className="h-6 w-6 text-foreground" />
            </Button>
          </SheetClose>
        </div>

        {/* Menu Content - 3 Column Grid */}
        <div className="h-full px-8 sm:px-16 pb-8 pt-32">
          <div className="grid grid-cols-3 gap-x-16 h-full w-full">
            {/* First Column - Japanese "Light" with cycling on hover + Matrix */}
            <div className="col-span-1 flex flex-col justify-between h-full">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div
                  onMouseEnter={start}
                  onMouseLeave={reset}
                  className="cursor-default inline-block min-w-[20ch] pr-8"
                >
                  <h2 className={`text-6xl font-light text-foreground`}>
                    {isActive && currentItem
                      ? currentItem.word
                      : JAPANESE_LIGHT?.word}
                  </h2>
                  <p className="mt-2 text-xs font-mono text-muted-foreground">
                    {isActive && currentItem
                      ? currentItem.language
                      : JAPANESE_LIGHT?.language}
                  </p>
                </div>
              </motion.div>

              {/* Matrix Animation at Bottom */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-auto"
              >
                <LightfastSineWaveMatrix />
              </motion.div>
            </div>

            {/* Second Column - Nav Items + Social Links */}
            <div className="col-span-1 flex flex-col h-full relative">
              {/* Nav Items */}
              <div className="flex flex-col gap-y-6">
                {NAV_ITEMS.map((item, index) => {
                  const isActive = pathname === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                      className="relative"
                    >
                      {isActive && (
                        <ChevronRight className="absolute -left-12 top-1/2 -translate-y-1/2 w-8 h-8 text-foreground" />
                      )}
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={`block font-light text-6xl text-foreground transition-opacity hover:opacity-60 ${exposureTrial.className}`}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Social Links - Bottom of Second Column */}
              <div className="flex gap-4 absolute bottom-0 left-0">
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

            {/* Third Column - Manifesto, Contact, Legal Items */}
            <div className="col-span-1 flex flex-col gap-y-6">
              {THIRD_COLUMN_ITEMS.map((item, index) => {
                const isActive = pathname === item.href;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-8 h-8 flex items-center justify-center shrink-0">
                      {isActive && (
                        <ChevronRight className="w-8 h-8 text-foreground" />
                      )}
                    </div>
                    <Link
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={`block font-light text-6xl text-foreground transition-opacity hover:opacity-60 ${exposureTrial.className}`}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
