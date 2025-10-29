"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PageTree } from "fumadocs-core/server";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { X, ChevronRight } from "lucide-react";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { motion } from "framer-motion";
import { exposureTrial } from "../lib/fonts";
import { LightfastSineWaveMatrix } from "./shared/lightfast-sine-wave-matrix";

interface DocsMobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree?: PageTree.Root;
}

/**
 * DocsMobileMenuSheet - Mobile menu overlay for docs pages
 *
 * Features:
 * - Slides down from top
 * - Matrix animation
 * - Documentation navigation
 * - Staggered animations
 */
export function DocsMobileMenuSheet({
  open,
  onOpenChange,
  tree,
}: DocsMobileMenuSheetProps) {
  const pathname = usePathname();

  if (!tree) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="top"
        className="h-2/3 p-0 dark bg-background [&>button]:hidden border-border/30"
      >
        <SheetTitle className="sr-only">Documentation Menu</SheetTitle>

        {/* Header with Logo and Close Button */}
        <div className="absolute top-0 left-0 right-0 page-gutter-wide py-8 flex items-center justify-between">
          <div className="-ml-2 flex items-center">
            <Button variant="ghost" size="lg" className="group" asChild>
              <Link href="/" onClick={() => onOpenChange(false)}>
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

        {/* Menu Content */}
        <div className="h-full page-gutter-wide pb-8 pt-32">
          <div className="grid grid-cols-2 gap-x-16 h-full w-full">
            {/* First Column - Matrix */}
            <div className="col-span-1 flex flex-col justify-start">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <LightfastSineWaveMatrix />
              </motion.div>
            </div>

            {/* Second Column - Navigation */}
            <div className="col-span-1">
              <ScrollArea className="h-full">
                <div className="space-y-6">
                  {tree.children.map((item, sectionIndex) => (
                    <div key={item.$id ?? `section-${sectionIndex}`}>
                      {item.type === "folder" && (
                        <div className="space-y-3">
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: sectionIndex * 0.05 }}
                            className="text-xs text-muted-foreground"
                          >
                            {item.name}
                          </motion.div>
                          <div className="space-y-2">
                            {item.children.map((page, pageIndex) => {
                              if (page.type !== "page") return null;

                              const isActive = page.url === pathname;

                              return (
                                <motion.div
                                  key={page.url}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    delay: (sectionIndex * 0.05) + (pageIndex * 0.05),
                                  }}
                                  className="relative flex items-center"
                                >
                                  {isActive && (
                                    <ChevronRight className="absolute -left-6 w-5 h-5 text-foreground" />
                                  )}
                                  <Link
                                    href={page.url}
                                    onClick={() => onOpenChange(false)}
                                    className={`block font-light text-2xl text-foreground transition-opacity hover:opacity-60 ${exposureTrial.className}`}
                                  >
                                    {page.name}
                                  </Link>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
