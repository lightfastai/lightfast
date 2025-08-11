import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { MessageSquarePlus } from "lucide-react";
import { ActiveMenuItem } from "./active-menu-item";
import { PlatformSidebarTrigger } from "./platform-sidebar-trigger";
import { SidebarHoverExpand } from "./sidebar-hover-expand";
import { SessionsList } from "./sessions-list";

// Main server component - renders static parts with reactive sessions list
export function AppSidebar() {
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
							<SidebarMenuItem>
								<ActiveMenuItem sessionId="new" href="/new" size="default">
									<MessageSquarePlus className="w-4 h-4" />
									<span className="group-data-[collapsible=icon]:hidden text-xs">
										New Chat
									</span>
								</ActiveMenuItem>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Only the sessions list is a client component - everything else stays server-rendered */}
				<div className="w-full min-w-0 group-data-[collapsible=icon]:hidden">
					<SessionsList className="h-[calc(100vh-180px)] w-full" />
				</div>

				{/* Hover expand zone - fills the remaining space */}
				<div className="flex-1 relative group-data-[collapsible=icon]:block hidden">
					<SidebarHoverExpand />
				</div>
			</SidebarContent>
		</Sidebar>
	);
}