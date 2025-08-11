"use client";

import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";

export function PlatformSidebarTrigger() {
	return (
		<div className="flex items-center gap-2 w-full">
			{/* Just the sidebar trigger */}
			<SidebarTrigger />
		</div>
	);
}