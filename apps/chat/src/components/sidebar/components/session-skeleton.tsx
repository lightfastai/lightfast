import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

function SessionItemSkeleton() {
	return (
		<SidebarMenuItem className="w-full max-w-full min-w-0 overflow-hidden">
			<div className="h-6 w-full rounded-md bg-muted/50" />
		</SidebarMenuItem>
	);
}

export function SessionsLoadingSkeleton() {
	return (
		<SidebarGroup className="pl-4 pr-2 py-2">
			<SidebarGroupContent className="w-full max-w-full overflow-hidden">
				<SidebarMenu className="space-y-1">
					<SessionItemSkeleton />
					<SessionItemSkeleton />
					<SessionItemSkeleton />
					<SessionItemSkeleton />
					<SessionItemSkeleton />
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

