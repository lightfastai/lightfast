import type React from "react";
import { LayoutBackButton } from "~/components/layout-back-button";

interface AuthenticatedExtrasLayoutProps {
	children: React.ReactNode;
}

// Layout for authenticated pages that don't need the chat interface
// This provides minimal layout with back button header
export default function AuthenticatedExtrasLayout({
	children,
}: AuthenticatedExtrasLayoutProps) {
	return (
		<div className="h-screen flex flex-col">
			{/* Header with back button */}
			<div className="absolute top-6 left-6 z-10">
				<LayoutBackButton />
			</div>
			
			{/* Main content */}
			<div className="flex-1">
				{children}
			</div>
		</div>
	);
}
