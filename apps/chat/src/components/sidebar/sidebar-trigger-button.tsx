"use client";

import { SidebarMenuButton, useSidebar } from "@repo/ui/components/ui/sidebar";
import { PanelLeftIcon } from "lucide-react";

export function SidebarTriggerButton() {
	const { toggleSidebar } = useSidebar();
	
	return (
		<SidebarMenuButton 
			onClick={toggleSidebar}
			className="w-fit group-data-[collapsible=icon]:w-full"
		>
			<PanelLeftIcon className="size-4" />
		</SidebarMenuButton>
	);
}