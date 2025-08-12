import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import { Suspense } from "react";
import { InfiniteScrollSessions } from "./sessions/infinite-scroll-sessions";
import { PinnedSessionsList } from "./sessions/pinned-sessions-list";
import { SidebarHoverExpand } from "./sidebar-hover-expand";
import { ThreadsErrorBoundary } from "./threads-error-boundary";
import { SidebarTriggerButton } from "./sidebar-trigger-button";
import { ActiveMenuItem } from "./active-menu-item";

// Main server component - renders static parts with reactive sessions list
export function AppSidebar() {
	return (
		<Sidebar
			variant="inset"
			collapsible="icon"
			className="w-64 max-w-64 p-0 border-r border-border/50"
		>
			<SidebarHeader className="p-0">
				<SidebarGroup className="pl-4 pt-4 pr-4 pb-2">
					<SidebarGroupContent>
						<SidebarMenu className="space-y-1">
							<SidebarMenuItem>
								<SidebarTriggerButton />
							</SidebarMenuItem>
							<SidebarMenuItem>
								<ActiveMenuItem sessionId="new" href="/new">
									<Icons.newChat className="size-4" />
									<span className="group-data-[collapsible=icon]:hidden text-xs">
										New Chat
									</span>
								</ActiveMenuItem>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarHeader>

			<SidebarContent className="flex flex-col">
				{/* Sessions list with constrained height for scrolling */}
				<ScrollArea className="flex-1 min-h-0 w-full group-data-[collapsible=icon]:hidden">
					<div className="w-full max-w-full min-w-0 overflow-hidden pr-2">
						{/* Pinned sessions with Suspense (uses useSuspenseQuery) */}
						<ThreadsErrorBoundary>
							<Suspense fallback={null}>
								<PinnedSessionsList />
							</Suspense>
						</ThreadsErrorBoundary>
						
						{/* Regular sessions without Suspense (uses regular useInfiniteQuery) */}
						<ThreadsErrorBoundary>
							<InfiniteScrollSessions />
						</ThreadsErrorBoundary>
					</div>
				</ScrollArea>

				{/* Hover expand zone - only for collapsed state */}
				<div className="flex-1 relative group-data-[collapsible=icon]:block hidden">
					<SidebarHoverExpand />
				</div>
			</SidebarContent>
		</Sidebar>
	);
}
