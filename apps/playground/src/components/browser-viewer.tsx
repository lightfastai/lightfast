"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

interface BrowserViewerProps {
	className?: string;
}

export function BrowserViewer({ className }: BrowserViewerProps) {
	return (
		<div
			className={`flex flex-col aspect-[3/2] border border-border/50 rounded-sm overflow-hidden ${className || ""}`}
		>
			{/* Browser toolbar */}
			<div className="flex items-center gap-2 p-2 border-b border-border/50">
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Browser content */}
			<div className="flex-1 flex items-center justify-center bg-muted/20">
				<div className="text-center text-muted-foreground">
					<svg
						className="w-16 h-16 mx-auto mb-4 opacity-50"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
						/>
					</svg>
					<p className="text-sm font-medium mb-1">Browser View</p>
					<p className="text-xs">Enter a URL to preview the page</p>
				</div>
			</div>
		</div>
	);
}
