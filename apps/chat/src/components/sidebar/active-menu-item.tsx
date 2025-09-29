"use client";

import { SidebarMenuButton } from "@repo/ui/components/ui/sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { useScrollAwarePrefetch } from "~/hooks/use-scroll-aware-prefetch";
import { useEffect, useCallback } from "react";
import type { ComponentProps, ReactNode } from "react";
import { useSidebarNavigation } from "./sidebar-navigation-context";

interface ActiveMenuItemProps {
	sessionId: string;
	href: string;
	size?: "sm" | "default" | "lg";
	children: ReactNode;
	className?: string;
}

export function ActiveMenuItem({
	sessionId,
	href,
	size = "default",
	children,
	className,
	...linkProps
}: ActiveMenuItemProps & ComponentProps<typeof Link>) {
	const pathname = usePathname();
	const { pendingSessionId, setPendingSessionId } = useSidebarNavigation();

	// Determine if this item is active
	const actualActive =
		(sessionId === "new" && (pathname === "/new" || pathname === "/")) ||
		(sessionId !== "new" && pathname.includes(sessionId));

	const isPending = pendingSessionId != null && pendingSessionId === sessionId;
	const isActive = isPending || actualActive;

	// Set up scroll-aware prefetching for non-"new" sessions
	const { handleHover, handleHoverEnd, cleanup } = useScrollAwarePrefetch({
		sessionId,
		containerSelector: '[data-sidebar]', // Target the sidebar container for scroll detection
	});

	// Cleanup timer on unmount
	useEffect(() => {
		return cleanup;
	}, [cleanup]);

	// Only enable prefetching for actual sessions (not "new" session)
	const shouldPrefetch = sessionId !== "new";

	const handleClick = useCallback(() => {
		setPendingSessionId(sessionId === "new" ? "new" : sessionId);
	}, [sessionId, setPendingSessionId]);

	return (
		<SidebarMenuButton
			asChild
			size={size}
			isActive={isActive}
			className={cn("justify-start", className)}
		>
			<Link 
				href={href} 
				onMouseEnter={shouldPrefetch ? handleHover : undefined}
				onMouseLeave={shouldPrefetch ? handleHoverEnd : undefined}
				onClick={handleClick}
				{...linkProps}
			>
				{children}
			</Link>
		</SidebarMenuButton>
	);
}
