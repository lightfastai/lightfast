"use client";

import {
	SidebarMenuAction,
	SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { Pin } from "lucide-react";
import { useCallback } from "react";
import { ActiveMenuItem } from "../active-menu-item";
import type { Session } from "../types";

interface SessionItemProps {
	session: Session;
	onPinToggle: (sessionId: string) => void;
}

export function SessionItem({ session, onPinToggle }: SessionItemProps) {
	const handlePinClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			onPinToggle(session.id);
		},
		[onPinToggle, session.id],
	);

	const shouldShowSkeleton = !session.title || session.title === "New Session";

	return (
		<SidebarMenuItem>
			<ActiveMenuItem
				sessionId={session.id}
				href={`/${session.id}`}
				prefetch={true}
			>
				{shouldShowSkeleton ? (
					<div className="relative h-4 w-full min-w-0 flex-1 overflow-hidden rounded">
						<div className="absolute inset-0 bg-gradient-to-r from-muted/50 via-muted to-muted/50 animate-shimmer" />
						<div className="absolute inset-0 bg-muted/20 backdrop-blur-[2px]" />
					</div>
				) : (
					<span
						className="font-medium text-xs block truncate"
						title={session.title}
					>
						{session.title}
					</span>
				)}
				</ActiveMenuItem>
			<SidebarMenuAction
				showOnHover
				onClick={handlePinClick}
				className={cn(
					session.pinned && "text-primary",
					// Prevent focus ring overflow
					"focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-[-1px] focus-visible:outline-ring",
					// Slide in animation from right on hover
					"transition-transform duration-200 ease-out",
					"group-hover/menu-item:translate-x-0",
					"translate-x-1",
				)}
			>
				<Pin className={cn("h-3 w-3", session.pinned && "fill-current")} />
			</SidebarMenuAction>
		</SidebarMenuItem>
	);
}
