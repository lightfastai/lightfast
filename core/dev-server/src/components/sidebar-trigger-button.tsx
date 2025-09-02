"use client";

import { SidebarMenuButton, useSidebar } from "@repo/ui/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { PanelLeftIcon } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";

export function SidebarTriggerButton() {
	const { toggleSidebar } = useSidebar();

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<SidebarMenuButton
					onClick={toggleSidebar}
					className="w-fit group-data-[state=collapsed]:w-full"
				>
					{/* Show logo only when collapsed on desktop and not hovering sidebar */}
					<Icons.logoShort className="!size-5 hidden lg:group-data-[state=collapsed]:block lg:group-data-[state=collapsed]:group-hover/sidebar:hidden" />
					{/* Show trigger icon: always on mobile/tablet, or when expanded on desktop, or when hovering in collapsed state on desktop */}
					<PanelLeftIcon className="size-4 block lg:group-data-[state=collapsed]:hidden lg:group-data-[state=collapsed]:group-hover/sidebar:block" />
				</SidebarMenuButton>
			</TooltipTrigger>
			<TooltipContent side="right">
				<p className="text-xs">Toggle sidebar (⌘B)</p>
			</TooltipContent>
		</Tooltip>
	);
}