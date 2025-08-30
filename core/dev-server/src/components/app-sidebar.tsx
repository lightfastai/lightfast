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

export function AppSidebar() {
	const location = useLocation();
	const currentPath = location.pathname;
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	return (
		<Sidebar
			variant="inset"
			collapsible="icon"
			className="w-64 max-w-64 p-0 border-r border-border/50 group/sidebar"
		>
			<SidebarHeader className="p-0">
				{/* Logo/brand group - matching chat app structure */}
				<SidebarGroup className="px-4 py-3">
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<div className="flex items-center gap-2 px-2 py-1.5">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
										<Bot className="h-4 w-4 text-white" />
									</div>
									<div className="group-data-[collapsible=icon]:hidden">
										<h2 className="text-lg font-semibold">Lightfast</h2>
										<p className="text-xs text-muted-foreground">CLI v0.2.1</p>
									</div>
								</div>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Main navigation group - matching chat app spacing */}
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
												<span className="group-data-[collapsible=icon]:hidden text-xs flex-1">
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
				{/* Empty for now - future content sections can go here */}
			</SidebarContent>
		</Sidebar>
	);
}

