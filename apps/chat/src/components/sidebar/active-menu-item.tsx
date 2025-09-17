"use client";

import { SidebarMenuButton } from "@repo/ui/components/ui/sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
import { useSessionPrefetch } from "~/hooks/use-session-prefetch";
import { useEffect } from "react";
import type { ComponentProps, ReactNode } from "react";

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

	// Determine if this item is active
	const isActive =
		(sessionId === "new" && (pathname === "/new" || pathname === "/")) ||
		(sessionId !== "new" && pathname.includes(sessionId));

	// Set up prefetching for non-"new" sessions
	const { handleHover, handleHoverEnd, cleanup } = useSessionPrefetch({
		sessionId,
		debounceMs: 300, // 300ms debounce to avoid excessive prefetching
	});

	// Cleanup timer on unmount
	useEffect(() => {
		return cleanup;
	}, [cleanup]);

	// Only enable prefetching for actual sessions (not "new" session)
	const shouldPrefetch = sessionId !== "new";

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
				{...linkProps}
			>
				{children}
			</Link>
		</SidebarMenuButton>
	);
}

