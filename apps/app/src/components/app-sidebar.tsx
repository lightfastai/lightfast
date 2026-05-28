"use client";

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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";
import {
  BookOpen,
  CalendarClock,
  HelpCircle,
  Mail,
  Settings,
  Signal,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { TeamSwitcher, TeamSwitcherSkeleton } from "~/components/team-switcher";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}

function getOrgWorkspaceItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Signals",
      href: `/${orgSlug}/signals`,
      icon: Signal,
    },
    {
      title: "People",
      href: `/${orgSlug}/people`,
      icon: UsersRound,
    },
  ];
}

function getOrgManageItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Automations",
      href: `/${orgSlug}/automations`,
      icon: CalendarClock,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/settings`,
      icon: Settings,
    },
  ];
}

function isActiveNavItem(item: NavItem, pathname: string) {
  if (item.title === "Settings") {
    return pathname.startsWith(item.href);
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return items.map((item) => {
    const isActive = isActiveNavItem(item, pathname);

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          className={cn(
            "rounded-xl [&>svg]:size-3.5",
            isActive
              ? "text-foreground data-[active=true]:text-foreground"
              : "text-muted-foreground"
          )}
          isActive={isActive}
          size="sm"
        >
          <Link href={{ pathname: item.href }} prefetch={true}>
            <item.icon className="size-3.5" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

export function AppSidebar() {
  const pathname = usePathname();

  const pathParts = pathname.split("/").filter(Boolean);
  const orgSlug = pathParts[0] ?? "";

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 flex-row items-center px-4 py-0">
        <Suspense fallback={<TeamSwitcherSkeleton />}>
          <TeamSwitcher />
        </Suspense>
      </SidebarHeader>
      <SidebarContent>
        {orgSlug && (
          <>
            <SidebarGroup collapsible defaultOpen label="Workspace">
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems
                    items={getOrgWorkspaceItems(orgSlug)}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup collapsible defaultOpen label="Manage">
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
      <SidebarFooter>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-8 w-8 rounded-full bg-muted p-1"
              size="icon"
              title="Help"
              variant="outline"
            >
              <HelpCircle className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-48 p-0.5">
            <div className="flex flex-col gap-1">
              <Button
                asChild
                className="justify-start gap-2 rounded-xl text-sm"
                size="sm"
                variant="ghost"
              >
                <a href="mailto:support@lightfast.ai">
                  <Mail className="size-3.5" />
                  Contact Support
                </a>
              </Button>
              <Button
                asChild
                className="justify-start gap-2 rounded-xl text-sm"
                size="sm"
                variant="ghost"
              >
                <Link
                  href="https://lightfast.ai/docs/get-started/overview"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <BookOpen className="size-3.5" />
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
