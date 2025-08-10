import type { ReactNode } from "react";
import { DocsHeader } from "@/src/components/docs-header";
import { CustomSidebar } from "@/src/components/custom-sidebar";
import { pageTree } from "@/src/lib/source";
import "fumadocs-ui/style.css";

export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen flex flex-col">
			<DocsHeader />
			<div className="flex flex-1">
				<CustomSidebar tree={pageTree} />
				<main className="flex-1 py-8 border border-border/30 bg-muted/20 rounded-sm mx-2 mb-2">
					<div className="max-w-4xl mx-auto app-container">{children}</div>
				</main>
			</div>
		</div>
	);
}
