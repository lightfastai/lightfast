"use client";

import { useSidebar } from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { ChevronRight } from "lucide-react";

export function SidebarHoverExpand() {
	const { state, setOpen } = useSidebar();

	if (state === "expanded") return null;

	return (
		<button
			type="button"
			className="absolute left-0 right-0 bottom-0 top-0 group/expand cursor-pointer z-10 bg-transparent border-none"
			onClick={() => setOpen(true)}
			aria-label="Expand sidebar"
		>
			{/* Visible expand icon on hover */}
			<div
				className={cn(
					"absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md",
					"flex items-center justify-center",
					"bg-sidebar-accent text-sidebar-accent-foreground",
					"transition-opacity duration-200",
					"opacity-0 group-hover/expand:opacity-100",
				)}
			>
				<ChevronRight className="w-4 h-4" />
			</div>
		</button>
	);
}