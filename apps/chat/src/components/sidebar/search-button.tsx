"use client";

import { useState } from "react";
import { SidebarMenuButton, useSidebar } from "@repo/ui/components/ui/sidebar";
import { SearchIcon } from "lucide-react";
import { SessionSearchDialog } from "./session-search-dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

export function SearchButton() {
	const [open, setOpen] = useState(false);
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<SidebarMenuButton
						onClick={() => setOpen(true)}
						className="w-full justify-start group/search"
					>
						<SearchIcon className="h-4 w-4" />
						<span className="group-data-[collapsible=icon]:hidden text-xs flex-1 flex items-center justify-between">
							<span>Search</span>
							<span className="text-muted-foreground ml-2 opacity-0 group-hover/search:opacity-100 transition-opacity">
								⌘K
							</span>
						</span>
					</SidebarMenuButton>
				</TooltipTrigger>
				<TooltipContent side="right" hidden={!isCollapsed}>
					<p className="text-xs">Search (⌘K)</p>
				</TooltipContent>
			</Tooltip>
			
			<SessionSearchDialog 
				open={open} 
				onOpenChange={setOpen} 
			/>
		</>
	);
}