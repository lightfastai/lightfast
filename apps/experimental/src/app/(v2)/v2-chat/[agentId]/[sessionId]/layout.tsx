

interface SessionLayoutProps {
	children: React.ReactNode;
	params: Promise<{
		agentId: string;
		sessionId: string;
	}>;
}

export default async function SessionLayout({ children }: SessionLayoutProps) {
	// Session ownership validation is now handled in the page component
	// with the optimized getSessionDataWithOwnership function for better performance
	// This layout is kept minimal to avoid blocking operations

	return <>{children}</>;
}
