import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@repo/ui/components/ui/sidebar";
import { SessionItem } from "./session-item";
import type { SessionGroupProps } from "../types";

export function SessionGroup({
  categoryName,
  sessions,
  onPinToggle,
}: SessionGroupProps) {
  return (
    <SidebarGroup className="pl-4 pr-2 py-2">
      <SidebarGroupLabel className="text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
        {categoryName}
      </SidebarGroupLabel>
      <SidebarGroupContent className="w-full max-w-full overflow-hidden">
        <SidebarMenu className="space-y-1">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onPinToggle={onPinToggle}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}