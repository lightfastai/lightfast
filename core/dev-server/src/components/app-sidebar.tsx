import { Link, useLocation } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import {
	Sidebar,
	SidebarHeader,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	useSidebar,
} from "~/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";
import { SidebarTriggerButton } from "./sidebar-trigger-button";

export function AppSidebar() {
	const location = useLocation();
	const currentPath = location.pathname;
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	return (
		<Sidebar
			variant="inset"
			collapsible="icon"
			className="p-0 border-r border-border/50 group/sidebar"
		>
			<SidebarHeader className="p-0">
				{/* Trigger button group - aligned to top */}
				<SidebarGroup className="px-4 py-3">
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<SidebarTriggerButton />
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Main actions group - matching chat app structure */}
				<SidebarGroup className="px-4 pb-8">
					<SidebarGroupContent>
						<SidebarMenu className="space-y-1">
							<SidebarMenuItem>
								<Tooltip>
									<TooltipTrigger asChild>
										<SidebarMenuButton
											asChild
											size="default"
											isActive={currentPath === "/agents"}
											className="group-data-[collapsible=expanded]:pr-2"
										>
											<Link to="/agents">
												<Bot className="size-4" />
												<span className="group-data-[state=collapsed]:hidden text-xs flex-1">
													Agents
												</span>
											</Link>
										</SidebarMenuButton>
									</TooltipTrigger>
									<TooltipContent side="right" hidden={!isCollapsed}>
										<p className="text-xs">Agents</p>
									</TooltipContent>
								</Tooltip>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarHeader>

			<SidebarContent>
				{/* Empty for now - future scrollable content can go here */}
			</SidebarContent>
		</Sidebar>
	);
}
