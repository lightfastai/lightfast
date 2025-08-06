"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { BrowserViewer } from "./browser-viewer";

interface BrowserContainerProps {
	className?: string;
}

export enum BrowserContainerViewType {
	BROWSER = "browser",
}

export function BrowserContainer({ className }: BrowserContainerProps) {
	const [activeView, setActiveView] = useState<BrowserContainerViewType>(BrowserContainerViewType.BROWSER);

	return (
		<div className={`flex flex-col h-full ${className || ""}`}>
			{/* Header */}
			<div className="h-14 border-b border-border/50 flex items-center px-4">
				<Button 
					variant="ghost" 
					size="sm" 
					className={`gap-2 ${activeView === BrowserContainerViewType.BROWSER ? "bg-accent text-accent-foreground dark:bg-accent/50" : ""}`}
					onClick={() => setActiveView(BrowserContainerViewType.BROWSER)}
				>
					<Globe className="h-4 w-4" />
					Browser
				</Button>
			</div>

			{/* Content viewer */}
			<div className="flex-1 flex items-center justify-center p-8">
				<div className="w-full max-w-5xl">
					{activeView === BrowserContainerViewType.BROWSER && <BrowserViewer />}
				</div>
			</div>
		</div>
	);
}

