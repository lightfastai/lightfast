import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { Icons } from "@repo/ui/components/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { Suspense } from "react";
import { InfiniteScrollSessions } from "./sessions/infinite-scroll-sessions";
import { PinnedSessionsList } from "./sessions/pinned-sessions-list";
import { SidebarHoverExpand } from "./sidebar-hover-expand";
import { ThreadsErrorBoundary } from "./threads-error-boundary";
import { SidebarTriggerButton } from "./sidebar-trigger-button";
import { ActiveMenuItem } from "./active-menu-item";
import { ScrollAreaWithBorder } from "./scroll-area-with-border";

// Main server component - renders static parts with reactive sessions list
export function AppSidebar() {
	return (
		<TooltipProvider>
			<Sidebar
				variant="inset"
				collapsible="icon"
				className="w-64 max-w-64 p-0 border-r border-border/50 group/sidebar"
			>
				<SidebarHeader className="p-0">
					{/* Trigger button group */}
					<SidebarGroup className="p-4 pb-2">
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarTriggerButton />
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					{/* New chat and actions group */}
					<SidebarGroup className="px-4 pb-8">
						<SidebarGroupContent>
							<SidebarMenu className="space-y-1">
								<SidebarMenuItem className="group-data-[collapsible=icon]:contents">
									{/* Only show tooltip when collapsed */}
									<Tooltip>
										<TooltipTrigger
											asChild
											className="group-data-[collapsible=expanded]:cursor-default"
										>
											<div className="group-data-[collapsible=expanded]:contents">
												<ActiveMenuItem
													sessionId="new"
													href="/new"
													className="group/newchat group-data-[collapsible=expanded]:pr-2"
												>
													<Icons.newChat className="size-4" />
													<span className="group-data-[collapsible=icon]:hidden text-xs flex-1 flex items-center justify-between">
														<span>New Chat</span>
														<span className="text-muted-foreground ml-2 opacity-0 group-hover/newchat:opacity-100 transition-opacity">
															⌘⇧O
														</span>
													</span>
												</ActiveMenuItem>
											</div>
										</TooltipTrigger>
										<TooltipContent
											side="right"
											className="group-data-[collapsible=icon]:block hidden"
										>
											<p className="text-xs">New chat (⌘⇧O)</p>
										</TooltipContent>
									</Tooltip>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarHeader>

				<ScrollAreaWithBorder className="flex-1 min-h-0 w-full group-data-[collapsible=icon]:hidden">
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
				</ScrollAreaWithBorder>

				{/* Hover expand zone - only for collapsed state */}
				<div className="flex-1 relative group-data-[collapsible=icon]:block hidden">
					<SidebarHoverExpand />
				</div>
			</Sidebar>
		</TooltipProvider>
	);
}
