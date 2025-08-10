import type { ReactNode } from "react";
import { DocsHeader } from "@/src/components/docs-header";
import { CustomSidebar } from "@/src/components/custom-sidebar";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { pageTree } from "@/src/lib/source";
import "fumadocs-ui/style.css";

export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<div className="h-screen flex flex-col">
			<DocsHeader />
			<div className="flex flex-1 overflow-hidden">
				<CustomSidebar tree={pageTree} />
				<div className="flex-1 bg-muted/20 border border-border/30 rounded-md mx-2 mb-2 overflow-hidden">
					<ScrollArea className="h-full">
						<main className="min-h-full p-8">
							<div className="max-w-4xl mx-auto app-container">{children}</div>
						</main>
					</ScrollArea>
				</div>
			</div>
		</div>
	);
}
