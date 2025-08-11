import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
} from "@repo/ui/components/ui/sidebar";
import { Icons } from "@repo/ui/components/icons";
import Link from "next/link";
import { InfiniteScrollSessions } from "./sessions/infinite-scroll-sessions";
import { SidebarHoverExpand } from "./sidebar-hover-expand";
import { ThreadsErrorBoundary } from "./threads-error-boundary";
import { SidebarTriggerButton } from "./sidebar-trigger-button";

// Main server component - renders static parts with reactive sessions list
export function AppSidebar() {
	return (
		<Sidebar
			variant="inset"
			collapsible="icon"
			className="w-64 pl-2 py-2 max-w-64"
		>
			<SidebarHeader className="p-0">
				<SidebarGroup className="p-2">
					<SidebarGroupContent>
						<SidebarMenu className="space-y-2">
							<SidebarMenuItem>
								<SidebarTriggerButton />
							</SidebarMenuItem>
							<SidebarMenuItem>
								<SidebarMenuButton asChild>
									<Link href="/new">
										<Icons.newChat className="size-4" />
										<span className="group-data-[collapsible=icon]:hidden">
											New Chat
										</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarHeader>

			<SidebarContent className="flex flex-col">
				{/* Sessions list with constrained height for scrolling */}
				<div className="flex-1 min-h-0 w-full group-data-[collapsible=icon]:hidden">
					<ThreadsErrorBoundary>
						<InfiniteScrollSessions className="h-full w-full" />
					</ThreadsErrorBoundary>
				</div>

				{/* Hover expand zone - only for collapsed state */}
				<div className="flex-1 relative group-data-[collapsible=icon]:block hidden">
					<SidebarHoverExpand />
				</div>
			</SidebarContent>
		</Sidebar>
	);
}
