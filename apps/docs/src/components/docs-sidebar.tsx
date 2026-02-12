"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PageTree } from "fumadocs-core/server";
import { Icons } from "@repo/ui/components/icons";
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@repo/ui/components/ui/sidebar";
import { DocsSidebarScrollArea } from "./docs-sidebar-scroll-area";
import { wwwUrl } from "../lib/related-projects";

interface DocsSidebarProps {
  tree?: PageTree.Root;
}

/**
 * DocsSidebar - Sidebar navigation for the docs site
 *
 * Features:
 * - Logo in header
 * - Vertical navigation based on fumadocs pageTree
 * - Active state with background highlighting
 * - Proper shadcn/ui sidebar structure
 *
 * @example
 * ```tsx
 * <SidebarProvider>
 *   <DocsSidebar tree={pageTree} />
 *   <SidebarInset>
 *     <main>{children}</main>
 *   </SidebarInset>
 * </SidebarProvider>
 * ```
 */
export function DocsSidebar({ tree }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      className="border-0 ![border-right:0]"
    >
      {/* Static Header - Logo, Trigger, Matrix, Back to Home */}
      <SidebarHeader className="!p-0 gap-0">
        {/* Logo - aligned with main header */}
        <div className="h-[4.5rem] page-gutter -ml-2 flex flex-row items-center gap-2">
          <Link href={wwwUrl}>
            <Icons.logoShort className="h-4 w-4 text-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>
      </SidebarHeader>

      {/* Scrollable Documentation Navigation */}
      <DocsSidebarScrollArea className="flex-1 min-h-0 w-full">
        <div className="w-full max-w-full min-w-0 overflow-hidden px-12 py-4">
          {tree?.children.map((item, index) => {
            if (item.type === "separator") {
              return (
                <SidebarGroup
                  key={item.$id ?? `item-${index}`}
                  className="mb-6"
                >
                  <SidebarGroupLabel className="text-xs text-muted-foreground px-0">
                    {item.name}
                  </SidebarGroupLabel>
                </SidebarGroup>
              );
            }

            if (item.type === "folder") {
              return (
                <SidebarGroup
                  key={item.$id ?? `item-${index}`}
                  className="mb-6"
                >
                  <SidebarGroupLabel className="text-xs text-muted-foreground font-normal px-0">
                    {item.name}
                  </SidebarGroupLabel>
                  <SidebarGroupContent className="mt-1">
                    <SidebarMenu className="gap-1">
                      {item.children.map((page) => {
                        if (page.type !== "page") return null;

                        const isActive = page.url === pathname;

                        return (
                          <SidebarMenuItem key={page.url} className="-mx-4">
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className="h-auto px-4 py-1.5 w-fit text-sm hover:bg-accent/70 hover:text-accent-foreground data-[active=true]:bg-accent/70 data-[active=true]:text-accent-foreground justify-start"
                            >
                              <Link prefetch href={page.url}>
                                {page.name}
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            }

            return null;
          })}
        </div>
      </DocsSidebarScrollArea>
    </Sidebar>
  );
}
