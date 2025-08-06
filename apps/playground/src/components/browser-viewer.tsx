"use client";

import { useState } from "react";

interface BrowserViewerProps {
	className?: string;
}

export function BrowserViewer({ className }: BrowserViewerProps) {
	const [url, setUrl] = useState("");

	return (
		<div
			className={`flex flex-col aspect-[3/2] border border-border/50 rounded-sm overflow-hidden ${className || ""}`}
		>
			{/* Browser toolbar */}
			<div className="flex items-center gap-2 p-3 border-b border-border/50">
				<div className="flex items-center gap-1">
					<button className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xs">
						←
					</button>
					<button className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xs">
						→
					</button>
					<button className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center text-xs">
						↻
					</button>
				</div>

				{/* URL bar */}
				<div className="flex-1 flex items-center bg-muted rounded-lg px-3 py-1.5">
					<input
						type="text"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						placeholder="Enter URL..."
						className="flex-1 bg-transparent outline-none text-sm"
					/>
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

