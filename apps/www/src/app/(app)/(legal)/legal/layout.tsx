import type { ReactNode } from "react";

interface LegalLayoutProps {
	children: ReactNode;
}

export default function LegalLayout({ children }: LegalLayoutProps) {
	return (
		<div className="min-h-[calc(100vh-12rem)] py-8 sm:py-16">
			<div className="mx-auto max-w-6xl px-4">{children}</div>
		</div>
	);
}
