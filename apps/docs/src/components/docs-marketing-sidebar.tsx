"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PageTree } from "fumadocs-core/server";
import { ChevronRight } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@repo/ui/components/ui/sidebar";
import { LightfastSineWaveMatrix } from "./shared/lightfast-sine-wave-matrix";
import { exposureTrial } from "../lib/fonts";
import { DocsSidebarScrollArea } from "./docs-sidebar-scroll-area";
import { wwwUrl } from "../lib/related-projects";

interface DocsMarketingSidebarProps {
  tree?: PageTree.Root;
}

/**
 * DocsMarketingSidebar - Sidebar navigation for the docs site
 *
 * Features:
 * - Logo in header with matrix animation
 * - Vertical navigation based on fumadocs pageTree
 * - Active state with ChevronRight indicator
 * - Consistent styling with www marketing sidebar
 *
 * @example
 * ```tsx
 * <SidebarProvider>
 *   <DocsMarketingSidebar tree={pageTree} />
 *   <SidebarInset>
 *     <main>{children}</main>
 *   </SidebarInset>
 * </SidebarProvider>
 * ```
 */
export function DocsMarketingSidebar({ tree }: DocsMarketingSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="header-only"
      className="border-0 ![border-right:0]"
    >
      {/* Static Header - Logo, Trigger, Matrix, Back to Home */}
      <SidebarHeader className="!p-0 gap-0">
        {/* Logo and Trigger - aligned with main header */}
        <div className="h-[4.5rem] page-gutter -ml-2 flex flex-row items-center gap-2">
          <Link href={wwwUrl}>
            <Icons.logo className="size-22 text-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      {/* Scrollable Documentation Navigation */}
      <DocsSidebarScrollArea className="flex-1 min-h-0 w-full">
        <div className="w-full max-w-full min-w-0 overflow-hidden px-8 md:px-16 py-4">
          {tree?.children.map((item, index) => (
            <div key={item.$id ?? `item-${index}`} className="mb-6">
              {item.type === "separator" && (
                <SidebarGroupLabel className="text-xs text-muted-foreground px-0 mb-2">
                  {item.name}
                </SidebarGroupLabel>
              )}
              {item.type === "folder" && (
                <>
                  <SidebarGroupLabel className="text-xs text-muted-foreground px-0 mb-2">
                    {item.name}
                  </SidebarGroupLabel>
                  <SidebarMenu className="gap-2">
                    {item.children.map((page) => {
                      if (page.type !== "page") return null;

                      const isActive = page.url === pathname;

                      return (
                        <SidebarMenuItem key={page.url} className="relative">
                          {isActive && (
                            <ChevronRight className="absolute -left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground" />
                          )}
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className={`h-auto p-0 text-lg font-light bg-transparent hover:bg-transparent hover:opacity-60 data-[active=true]:bg-transparent data-[active=true]:font-light justify-start ${exposureTrial.className}`}
                          >
                            <Link href={page.url}>{page.name}</Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </>
              )}
            </div>
          ))}
        </div>
      </DocsSidebarScrollArea>
    </Sidebar>
  );
}
