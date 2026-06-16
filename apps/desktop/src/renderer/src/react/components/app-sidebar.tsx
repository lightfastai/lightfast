import {
  AddIcon,
  HistoryIcon,
  MessageSquarePlus,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@repo/ui-v2/components/ui/sidebar";
import { cn } from "@repo/ui-v2/lib/utils";
import type { ReactNode } from "react";
import { TeamMenu } from "./team-menu";
import { UserMenu } from "./user-menu";

const appRegionNoDrag = "[-webkit-app-region:no-drag]";
const objectiveIndicators = [
  {
    gradientClassName: "from-chart-3 via-chart-4 to-chart-5",
    label: "Objective 1",
    selected: true,
  },
  {
    gradientClassName: "from-chart-1 via-chart-2 to-chart-4",
    label: "Objective 2",
    selected: false,
  },
  {
    gradientClassName: "from-chart-5 via-chart-3 to-destructive",
    label: "Objective 3",
    selected: false,
  },
] as const;

export function AppSidebarProvider({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider className="h-full min-h-0" open={false}>
      {children}
    </SidebarProvider>
  );
}

function ObjectiveIndicator({
  gradientClassName,
}: {
  gradientClassName: string;
}) {
  return (
    <span className="relative flex size-2.5 overflow-hidden rounded-[2px]">
      <span
        className={cn(
          "absolute inset-0 animate-objective-gradient bg-[length:400%_400%] bg-gradient-to-br",
          gradientClassName
        )}
      />
    </span>
  );
}

export function AppSidebar() {
  return (
    <Sidebar className="border-none" collapsible="icon" data-kind-primary>
      <SidebarHeader className="pt-10">
        <SidebarMenu>
          <SidebarMenuItem>
            <TeamMenu />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-label="New chat"
              className={appRegionNoDrag}
              tooltip={{ children: "New Chat", hidden: false }}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={MessageSquarePlus} />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              aria-label="Recent chats"
              className={appRegionNoDrag}
              tooltip={{ children: "Recent Chats", hidden: false }}
              type="button"
            >
              <HugeiconsIcon aria-hidden="true" icon={HistoryIcon} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-visible group-data-[collapsible=icon]:overflow-visible">
        <SidebarGroup className="absolute inset-x-0 top-1/2 -translate-y-1/2">
          <SidebarMenu>
            {objectiveIndicators.map((objective) => (
              <SidebarMenuItem key={objective.label}>
                <SidebarMenuButton
                  aria-label={objective.label}
                  className={cn("justify-center", appRegionNoDrag)}
                  isActive={objective.selected}
                  tooltip={objective.label}
                  type="button"
                >
                  <ObjectiveIndicator
                    gradientClassName={objective.gradientClassName}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                aria-label="Add objective"
                className={appRegionNoDrag}
                tooltip="Add objective"
                type="button"
              >
                <HugeiconsIcon aria-hidden="true" icon={AddIcon} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
