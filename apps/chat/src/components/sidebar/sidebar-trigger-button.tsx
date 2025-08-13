"use client";

import { SidebarMenuButton, useSidebar } from "@repo/ui/components/ui/sidebar";
import { Icons } from "@repo/ui/components/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { PanelLeftIcon } from "lucide-react";

export function SidebarTriggerButton() {
	const { toggleSidebar } = useSidebar();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<SidebarMenuButton
					onClick={toggleSidebar}
					className="w-fit group-data-[collapsible=icon]:w-full"
				>
					{/* Show logo only when collapsed and not hovering sidebar */}
					<Icons.logoShort className="!size-5 group-data-[collapsible=icon]:block group-data-[collapsible=icon]:group-hover/sidebar:hidden hidden" />
					{/* Show trigger icon when expanded OR when hovering in collapsed state */}
					<PanelLeftIcon className="size-4 group-data-[collapsible=icon]:hidden group-data-[collapsible=icon]:group-hover/sidebar:block block" />
				</SidebarMenuButton>
			</TooltipTrigger>
			<TooltipContent side="right">
				<p className="text-xs">Toggle sidebar (⌘B)</p>
			</TooltipContent>
		</Tooltip>
	);
}
