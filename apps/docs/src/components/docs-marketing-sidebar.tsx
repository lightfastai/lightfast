"use client";

import { Link } from "@vercel/microfrontends/next/client";
import { usePathname } from "next/navigation";
import type { PageTree } from "fumadocs-core/server";
import { ChevronRight } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sidebar,
  SidebarContent,
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
      className="border-0 pl-16 ![border-right:0]"
    >
      {/* Header with Logo and Sidebar Trigger */}
      <SidebarHeader className="flex flex-row items-center gap-2 py-4 px-0">
        <div className="-ml-2 flex items-center">
          <Button
            variant="ghost"
            size="lg"
            className="hover:bg-black group"
            asChild
          >
            <Link href="/">
              <Icons.logo className="size-22 text-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </Button>
        </div>
        <SidebarTrigger />
      </SidebarHeader>

      {/* Navigation Content with Matrix at top */}
      <SidebarContent className="pt-[10vh] pb-8 px-0">
        <SidebarGroup className="px-0">
          <SidebarGroupContent className="px-0">
            {/* Matrix Animation */}
            <div className="mb-8">
              <LightfastSineWaveMatrix />
            </div>

            {/* Back to Main Site Link */}
            <SidebarMenu className="gap-2 mb-6 pb-6 border-b border-border">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-auto p-0 text-sm font-light bg-transparent hover:bg-transparent hover:opacity-60 justify-start"
                >
                  <Link href="/">← Back to Home</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            {/* Documentation Navigation */}
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
