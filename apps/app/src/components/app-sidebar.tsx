"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { TeamSwitcher } from "@repo/ui/components/app-header/team-switcher";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@repo/ui/components/ui/sidebar";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useOrganizationList } from "@vendor/clerk/client";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  HelpCircle,
  ListTodo,
  Mail,
  MessageSquare,
  PlugZap,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  icon: LucideIcon;
  title: string;
}

function getOrgPrimaryItems(orgSlug: string): NavItem[] {
  return [
    { title: "Ask", href: `/${orgSlug}`, icon: MessageSquare },
    { title: "Search", href: `/${orgSlug}/search`, icon: Search },
  ];
}

function getOrgManageItems(orgSlug: string): NavItem[] {
  return [
    { title: "Events", href: `/${orgSlug}/events`, icon: Activity },
    { title: "Sources", href: `/${orgSlug}/sources`, icon: PlugZap },
    { title: "Jobs", href: `/${orgSlug}/jobs`, icon: ListTodo },
    { title: "Settings", href: `/${orgSlug}/settings`, icon: Settings },
  ];
}

function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return items.map((item) => {
    const isActive =
      item.title === "Settings"
        ? pathname.startsWith(item.href)
        : pathname === item.href;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          className="group-data-[collapsible=icon]:mx-auto [&>svg]:size-3.5"
          isActive={isActive}
          size="sm"
          tooltip={item.title}
        >
          <Link href={{ pathname: item.href }} prefetch={true}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

export function AppSidebar() {
  const pathname = usePathname();
  const trpc = useTRPC();
  const { setActive } = useOrganizationList();
  const { state } = useSidebar();

  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId });
    }
  };

  const pathParts = pathname.split("/").filter(Boolean);
  const orgSlug = pathParts[0] ?? "";

  const mode =
    pathname.startsWith("/account") || pathname.startsWith("/new")
      ? "account"
      : "organization";

  return (
    <Sidebar
      className="border-border/50 group-data-[state=collapsed]:border-r"
      collapsible="icon"
      variant="inset"
    >
      {orgSlug && (
        <SidebarHeader className="h-14 flex-row items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {state === "expanded" && (
            <div className="flex min-w-0 flex-1">
              <TeamSwitcher
                createTeamHref="/account/teams/new"
                mode={mode}
                onOrgSelect={handleOrgSelect}
                organizations={organizations}
              />
            </div>
          )}
          <SidebarTrigger className="shrink-0" />
        </SidebarHeader>
      )}
      <SidebarContent>
        {orgSlug && (
          <>
            <SidebarGroup className="group-data-[collapsible=icon]:px-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems
                    items={getOrgPrimaryItems(orgSlug)}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup className="group-data-[collapsible=icon]:px-0">
              <SidebarGroupLabel className="group-data-[collapsible=icon]:mt-0">
                Manage
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems
                    items={getOrgManageItems(orgSlug)}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="rounded-full bg-muted p-1"
              size="icon"
              title="Help"
              variant="outline"
            >
              <HelpCircle className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-48 p-1">
            <div className="flex flex-col gap-1">
              <Button
                asChild
                className="justify-start gap-2 text-sm"
                size="sm"
                variant="ghost"
              >
                <a href="mailto:support@lightfast.ai">
                  <Mail className="size-3" />
                  Contact Support
                </a>
              </Button>
              <Button
                asChild
                className="justify-start gap-2 text-sm"
                size="sm"
                variant="ghost"
              >
                <Link
                  href="https://lightfast.ai/docs/get-started/overview"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <BookOpen className="size-3" />
                  Help Docs
                </Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
}
