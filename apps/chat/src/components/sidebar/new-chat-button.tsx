"use client";

import { Icons } from "@repo/ui/components/icons";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { useSidebar } from "@repo/ui/components/ui/sidebar";
import { ActiveMenuItem } from "./active-menu-item";

export function NewChatButton() {
	const { state } = useSidebar();
	const isCollapsed = state === "collapsed";

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<ActiveMenuItem
					sessionId="new"
					href="/new"
					className="group/newchat group-data-[collapsible=expanded]:pr-2"
					prefetch={true}
				>
					<Icons.newChat className="size-4" />
					<span className="group-data-[collapsible=icon]:hidden text-xs flex-1 flex items-center justify-between">
						<span>New Chat</span>
						<span className="text-muted-foreground ml-2 opacity-0 group-hover/newchat:opacity-100 transition-opacity">
							⌘⇧O
						</span>
					</span>
				</ActiveMenuItem>
			</TooltipTrigger>
			<TooltipContent side="right" hidden={!isCollapsed}>
				<p className="text-xs">New chat (⌘⇧O)</p>
			</TooltipContent>
		</Tooltip>
	);
}