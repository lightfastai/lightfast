import type { ReactNode } from "react";

interface ThreadLayoutProps {
	children: ReactNode;
	params: Promise<{
		agentId: string;
		threadId: string;
	}>;
}

export default async function ThreadLayout({ children }: ThreadLayoutProps) {
	// Thread ownership validation is now handled in the page component
	// with the optimized getThreadDataWithOwnership function for better performance
	// This layout is kept minimal to avoid blocking operations

	return <>{children}</>;
}
