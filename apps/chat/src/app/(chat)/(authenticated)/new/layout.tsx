import type React from "react";

interface NewChatLayoutProps {
	children: React.ReactNode;
}

export default function NewChatLayout({ children }: NewChatLayoutProps) {
	// Layout is preserved during navigation
	// All new chat rendering happens in page.tsx
	return <>{children}</>;
}
