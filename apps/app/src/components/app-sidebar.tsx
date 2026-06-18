import {
  ApertureIcon,
  BlocksIcon,
  Cancel01Icon,
  CheckListIcon,
  Key01Icon,
  Message01Icon,
  MessageCirclePlus,
  Scroll01Icon,
  SettingsIcon,
  UserGroupIcon,
  WorkflowSquare07Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Button } from "@repo/ui-v2/components/ui/button";
import { DropdownMenuTrigger } from "@repo/ui-v2/components/ui/dropdown-menu";
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
  useSidebar,
} from "@repo/ui-v2/components/ui/sidebar";
import { Link, useLocation } from "@tanstack/react-router";
import { Suspense } from "react";
import { RecentChatsMenu } from "./recent-chats-menu";
import { TeamSwitcher, TeamSwitcherSkeleton } from "./team-switcher";
import { UserMenu } from "./user-menu";

type WorkspaceRouteTo =
  | "/$slug/automations"
  | "/$slug/connectors"
  | "/$slug/decisions"
  | "/$slug/developer-connections"
  | "/$slug/people"
  | "/$slug/settings"
  | "/$slug/signals"
  | "/$slug/skills";

type WorkspaceNavTitle =
  | "Automations"
  | "Connectors"
  | "Decisions"
  | "Developer Connections"
  | "People"
  | "Settings"
  | "Signals"
  | "Skills";

interface WorkspaceNavItem {
  href: string;
  title: WorkspaceNavTitle;
  to: WorkspaceRouteTo;
}

interface WorkspaceNavSection {
  items: WorkspaceNavItem[];
  label: string;
}

const navIcons: Record<WorkspaceNavTitle, IconSvgElement> = {
  Automations: WorkflowSquare07Icon,
  Connectors: BlocksIcon,
  Decisions: CheckListIcon,
  "Developer Connections": Key01Icon,
  People: UserGroupIcon,
  Settings: SettingsIcon,
  Signals: ApertureIcon,
  Skills: Scroll01Icon,
};

export function AppSidebar({ orgSlug }: { orgSlug: string }) {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const navSections: WorkspaceNavSection[] = [
    {
      label: "Workspace",
      items: [
        {
          href: `/${orgSlug}/automations`,
          title: "Automations",
          to: "/$slug/automations",
        },
        {
          href: `/${orgSlug}/decisions`,
          title: "Decisions",
          to: "/$slug/decisions",
        },
        {
          href: `/${orgSlug}/skills`,
          title: "Skills",
          to: "/$slug/skills",
        },
        {
          href: `/${orgSlug}/signals`,
          title: "Signals",
          to: "/$slug/signals",
        },
        {
          href: `/${orgSlug}/people`,
          title: "People",
          to: "/$slug/people",
        },
      ],
    },
    {
      label: "Manage",
      items: [
        {
          href: `/${orgSlug}/connectors`,
          title: "Connectors",
          to: "/$slug/connectors",
        },
        {
          href: `/${orgSlug}/developer-connections`,
          title: "Developer Connections",
          to: "/$slug/developer-connections",
        },
        {
          href: `/${orgSlug}/settings`,
          title: "Settings",
          to: "/$slug/settings",
        },
      ],
    },
  ];
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 flex-row items-center px-4 py-0">
        <Suspense fallback={<TeamSwitcherSkeleton />}>
          <TeamSwitcher />
        </Suspense>
        <div className="ml-auto flex items-center gap-1">
          <Button
            aria-label="New chat"
            className="ml-auto"
            render={
              <Link
                onClick={() => {
                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
                params={{ slug: orgSlug }}
                preload={false}
                to="/$slug/chat"
              />
            }
            size="icon-sm"
            title="New chat"
            variant="ghost"
          >
            <HugeiconsIcon aria-hidden="true" icon={MessageCirclePlus} />
          </Button>
          {isMobile ? (
            <Button
              aria-label="Close sidebar"
              className="size-11 rounded-xl text-muted-foreground"
              onClick={() => setOpenMobile(false)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={Cancel01Icon}
              />
            </Button>
          ) : null}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <RecentChatsMenu
          onConversationSelect={() => {
            if (isMobile) {
              setOpenMobile(false);
            }
          }}
          orgSlug={orgSlug}
          pathname={pathname}
          trigger={<RecentChatsMenuTrigger />}
        />
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={section.label}>
                <SidebarMenu>
                  <NavItems
                    items={section.items}
                    orgSlug={orgSlug}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}

function RecentChatsMenuTrigger() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenuTrigger
              render={<SidebarMenuButton aria-label="Open recents" />}
            >
              <HugeiconsIcon aria-hidden="true" icon={Message01Icon} />
              <span>Recents</span>
            </DropdownMenuTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function NavItems({
  items,
  orgSlug,
  pathname,
}: {
  items: WorkspaceNavItem[];
  orgSlug: string;
  pathname: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  return items.map((item) => {
    const icon = navIcons[item.title];
    const isActive =
      pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          isActive={isActive}
          render={
            <Link
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false);
                }
              }}
              params={{ slug: orgSlug }}
              preload="intent"
              to={item.to}
            />
          }
        >
          <HugeiconsIcon aria-hidden="true" icon={icon} />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}
