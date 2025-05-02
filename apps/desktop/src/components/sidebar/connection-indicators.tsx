import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

import { ApiStatusIndicator } from "../connection-indicators/api-status-indicator";
import { BlenderStatusIndicator } from "../connection-indicators/blender-status-indicator";

export function ConnectionIndicators() {
  return (
    <>
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
    </>
  );
}
