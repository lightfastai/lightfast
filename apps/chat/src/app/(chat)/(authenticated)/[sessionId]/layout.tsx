import type React from "react";

interface SessionLayoutProps {
	children: React.ReactNode;
}

// Layout for session pages - only handles shared UI structure
export default function SessionLayout({ children }: SessionLayoutProps) {
	// Layout is preserved during navigation
	// All session-specific rendering happens in page.tsx
	return <>{children}</>;
}

