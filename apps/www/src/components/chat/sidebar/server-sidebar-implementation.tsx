import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarTrigger,
} from "@lightfast/ui/components/ui/sidebar";
import type { Preloaded } from "convex/react";
import { MessageSquarePlus } from "lucide-react";
import { Suspense } from "react";
import type { api } from "../../../../convex/_generated/api";
import { ActiveMenuItem } from "./active-menu-item";
import { PreloadedThreadsList } from "./preloaded-threads-list";
import { SidebarUserMenu } from "./sidebar-user-menu";

interface ServerSidebarImplementationProps {
	preloadedThreads: Preloaded<typeof api.threads.list>;
	preloadedUser: Preloaded<typeof api.users.current>;
}

// Main server component - renders static parts with reactive threads list
export function ServerSidebarImplementation({
	preloadedThreads,
	preloadedUser,
}: ServerSidebarImplementationProps) {
	return (
		<Sidebar variant="inset" collapsible="icon" className="w-64 max-w-64">
			<SidebarHeader className="p-0">
				<SidebarGroup className="p-2">
					<SidebarTrigger className="h-8 w-8" />
				</SidebarGroup>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup className="p-2">
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<ActiveMenuItem threadId="new" href="/chat" size="default" tooltip="New Chat">
									<MessageSquarePlus className="w-4 h-4" />
									<span className="group-data-[collapsible=icon]:hidden">
										New Chat
									</span>
								</ActiveMenuItem>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{/* Only the threads list is a client component - everything else stays server-rendered */}
				<div className="w-full min-w-0 group-data-[collapsible=icon]:hidden">
					<Suspense
						fallback={
							<div className="px-3 py-8 text-center text-muted-foreground">
								<p className="text-sm">Loading conversations...</p>
							</div>
						}
					>
						<PreloadedThreadsList preloadedThreads={preloadedThreads} />
					</Suspense>
				</div>
			</SidebarContent>

			<SidebarFooter className="p-0">
				<SidebarGroup className="p-2">
					<SidebarGroupContent>
						<SidebarMenu>
							<SidebarMenuItem className="overflow-visible">
								<SidebarUserMenu preloadedUser={preloadedUser} />
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarFooter>
		</Sidebar>
	);
}
