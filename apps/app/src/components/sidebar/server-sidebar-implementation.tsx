import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import {
  Sparkles,
} from "lucide-react";
import { ActiveMenuItem } from "./active-menu-item";
import { PlatformSidebarTrigger } from "./platform-sidebar-trigger";
import { SidebarHoverExpand } from "./sidebar-hover-expand";
import { SidebarUserMenu } from "./sidebar-user-menu";

// Menu items configuration
const navItems = [
  {
    title: "Chat",
    url: "/",
    icon: Sparkles,
  },
];

// Main server component - renders static parts
export function ServerSidebarImplementation() {
  return (
    <Sidebar variant="inset" collapsible="icon" className="w-64 max-w-64">
      <SidebarHeader className="p-0">
        <SidebarGroup className="p-2">
          <PlatformSidebarTrigger />
        </SidebarGroup>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <ActiveMenuItem href={item.url} size="default">
                    <item.icon className="w-4 h-4" />
                    <span className="group-data-[collapsible=icon]:hidden text-xs">
                      {item.title}
                    </span>
                  </ActiveMenuItem>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Hover expand zone - fills the space between items and user menu */}
        <div className="flex-1 relative group-data-[collapsible=icon]:block hidden">
          <SidebarHoverExpand />
        </div>
      </SidebarContent>

      <SidebarFooter className="p-0">
        <SidebarGroup className="p-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="overflow-visible">
                <SidebarUserMenu />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}