"use client";

import { Icons } from "@repo/ui/components/icons";
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import type * as PageTree from "fumadocs-core/page-tree";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { wwwUrl } from "../../lib/docs/related-projects";
import { DocsSidebarScrollArea } from "./docs-sidebar-scroll-area";

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
      className="![border-right:0] border-0"
      side="left"
      variant="sidebar"
    >
      {/* Static Header - Logo, Trigger, Matrix, Back to Home */}
      <SidebarHeader className="!p-0 gap-0">
        {/* Logo - aligned with main header */}
        <div className="page-gutter -ml-2 flex h-[4.25rem] flex-row items-center gap-2">
          <Link href={wwwUrl}>
            <Icons.logoShort className="h-4 w-4 text-foreground transition-colors group-hover:text-foreground" />
          </Link>
        </div>
      </SidebarHeader>

      {/* Scrollable Documentation Navigation */}
      <DocsSidebarScrollArea className="min-h-0 w-full flex-1">
        <div className="w-full min-w-0 max-w-full overflow-hidden px-12 py-4">
          {tree?.children.map((item, index) => {
            if (item.type === "separator") {
              return (
                <SidebarGroup
                  className="mb-6"
                  key={item.$id ?? `item-${index}`}
                >
                  <SidebarGroupLabel className="px-0 text-muted-foreground text-xs">
                    {item.name}
                  </SidebarGroupLabel>
                </SidebarGroup>
              );
            }

            if (item.type === "folder") {
              return (
                <SidebarGroup
                  className="mb-6"
                  key={item.$id ?? `item-${index}`}
                >
                  <SidebarGroupLabel className="px-0 font-normal text-muted-foreground text-xs">
                    {item.name}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-1">
                      {item.children.map((child, childIndex) => {
                        // Handle nested folders (e.g., Endpoints -> Search -> pages)
                        if (child.type === "folder") {
                          return (
                            <div
                              className="mb-4"
                              key={child.$id ?? `child-${childIndex}`}
                            >
                              <div className="mb-1 px-3 font-medium text-muted-foreground/70 text-xs">
                                {child.name}
                              </div>
                              <div className="ml-2">
                                {child.children.map((page) => {
                                  if (page.type !== "page") {
                                    return null;
                                  }

                                  const isActive = page.url === pathname;

                                  return (
                                    <SidebarMenuItem
                                      className="-mx-3"
                                      key={page.url}
                                    >
                                      <SidebarMenuButton
                                        asChild
                                        className="h-auto w-fit justify-start truncate whitespace-nowrap rounded-lg px-3 py-1.5 text-sm hover:bg-accent/70 hover:text-accent-foreground data-[active=true]:bg-accent/70 data-[active=true]:text-accent-foreground"
                                        isActive={isActive}
                                      >
                                        <Link href={page.url} prefetch>
                                          {page.name}
                                        </Link>
                                      </SidebarMenuButton>
                                    </SidebarMenuItem>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }

                        // Handle direct pages
                        if (child.type === "page") {
                          const isActive = child.url === pathname;

                          return (
                            <SidebarMenuItem className="-mx-3" key={child.url}>
                              <SidebarMenuButton
                                asChild
                                className="h-auto w-fit justify-start truncate whitespace-nowrap rounded-lg px-3 py-1.5 text-sm hover:bg-accent/70 hover:text-accent-foreground data-[active=true]:bg-accent/70 data-[active=true]:text-accent-foreground"
                                isActive={isActive}
                              >
                                <Link href={child.url} prefetch>
                                  {child.name}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        }

                        return null;
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
