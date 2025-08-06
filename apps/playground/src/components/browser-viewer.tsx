"use client";

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useBrowser } from "~/contexts/browser-context";

interface BrowserViewerProps {
	className?: string;
}

export function BrowserViewer({ className }: BrowserViewerProps) {
	const { browserState } = useBrowser();
	
	return (
		<div
			className={`flex flex-col aspect-[3/2] border border-border/50 rounded-sm overflow-hidden ${className || ""}`}
		>
			{/* Browser toolbar */}
			<div className="flex items-center gap-2 p-2 border-b border-border/50">
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
				
				{/* URL bar */}
				<div className="flex-1 bg-muted/50 rounded-md px-3 py-1.5 text-sm text-muted-foreground">
					{browserState.url || "No URL"}
				</div>
				
				{/* Refresh button */}
				<Button 
					variant="ghost" 
					size="icon" 
					className={`h-8 w-8 rounded-full ${browserState.isLoading ? 'animate-spin' : ''}`}
					disabled
				>
					<RefreshCw className="h-4 w-4" />
				</Button>
			</div>

			{/* Browser content */}
			<div className="flex-1 flex items-center justify-center bg-muted/20 relative">
				{browserState.screenshot ? (
					<img 
						src={browserState.screenshot} 
						alt="Browser view" 
						className="w-full h-full object-contain"
					/>
				) : (
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
						<p className="text-xs">Ask the agent to navigate to a website</p>
					</div>
				)}
				
				{/* Loading overlay */}
				{browserState.isLoading && (
					<div className="absolute inset-0 bg-background/50 flex items-center justify-center">
						<div className="flex items-center gap-2">
							<RefreshCw className="h-4 w-4 animate-spin" />
							<span className="text-sm">Loading...</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
