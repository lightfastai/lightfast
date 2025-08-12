"use client";

import { SidebarMenuButton } from "@repo/ui/components/ui/sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";
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

	return (
		<SidebarMenuButton
			asChild
			size={size}
			isActive={isActive}
			className={cn("justify-start", className)}
		>
			<Link href={href} {...linkProps}>
				{children}
			</Link>
		</SidebarMenuButton>
	);
}