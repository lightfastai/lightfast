import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

import { ApiStatusIndicator } from "../connection-indicators/api-status-indicator";
import { BlenderStatusIndicator } from "../status-indicator";

export function ConnectionIndicators() {
  return (
    <div className="flex flex-col justify-between">
      <SidebarGroupLabel>
        <span>Connections</span>
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <BlenderStatusIndicator />
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <ApiStatusIndicator />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}
