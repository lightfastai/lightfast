import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

export function SidebarSkeleton() {
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
							{/* Sidebar trigger skeleton */}
							<SidebarMenuItem>
								<div className="h-8 w-8 rounded-md bg-muted/50" />
							</SidebarMenuItem>
							{/* New chat button skeleton */}
							<SidebarMenuItem>
								<div className="h-8 w-full rounded-md bg-muted/50" />
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarHeader>

			<SidebarContent className="flex flex-col">
				<div className="flex-1 min-h-0 w-full">
					<SidebarGroup className="pl-4 pr-2 py-2">
						<SidebarGroupContent className="w-full max-w-full overflow-hidden">
							<SidebarMenu className="space-y-1">
								{/* Session items skeleton */}
								{Array.from({ length: 8 }).map((_, i) => (
									<SidebarMenuItem key={i} className="w-full max-w-full min-w-0 overflow-hidden">
										<div className="h-6 w-full rounded-md bg-muted/50" />
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</div>
			</SidebarContent>
		</Sidebar>
	);
}