"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

interface TestDirectLinkProps {
	sessionId: string;
	href: string;
	children: React.ReactNode;
}

/**
 * Test component that uses Next.js Link directly without Radix UI's asChild pattern
 * to see if this resolves the blocking navigation issue
 */
export function TestDirectLink({ sessionId, href, children }: TestDirectLinkProps) {
	const pathname = usePathname();
	const isActive = pathname.includes(sessionId);
	
	return (
		<Link 
			href={href}
			prefetch={true}
			className={cn(
				"flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors",
				isActive && "bg-muted font-medium"
			)}
		>
			{children}
		</Link>
	);
}