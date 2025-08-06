"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { BrowserViewer } from "./browser-viewer";
import { useScreenshotsQuery } from "~/hooks/use-screenshots-query";
import { DotFlow } from "./gsap/dot-flow";
import { dotFlowFrames } from "./gsap/dot-flow-frames";

interface BrowserContainerProps {
	className?: string;
	threadId: string;
}

export enum BrowserContainerViewType {
	BROWSER = "browser",
}

export function BrowserContainer({ className, threadId }: BrowserContainerProps) {
	const [activeView, setActiveView] = useState<BrowserContainerViewType>(BrowserContainerViewType.BROWSER);
	
	// Use the screenshots query to poll for new screenshots
	const { 
		screenshots,
		currentScreenshot,
		currentIndex,
		setCurrentIndex,
		hasScreenshots,
		screenshotCount,
		isLoading,
		error 
	} = useScreenshotsQuery(threadId);
	
	return (
		<div className={`flex flex-col h-full ${className || ""}`}>
			{/* Header */}
			<div className="h-14 border-b flex items-center px-4">
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
				{!hasScreenshots ? (
					<DotFlow
						items={[
							{
								title: "Preparing workspace",
								frames: dotFlowFrames.preparingWorkspace,
								duration: 100,
								repeatCount: 2,
							},
							{
								title: "Initializing browser",
								frames: dotFlowFrames.initializingBrowser,
								duration: 90,
								repeatCount: 2,
							},
							{
								title: "Loading page",
								frames: dotFlowFrames.loadingPage,
								duration: 120,
								repeatCount: 3,
							},
						]}
						isPlaying={true}
					/>
				) : (
					<div className="w-full max-w-5xl">
						{activeView === BrowserContainerViewType.BROWSER && (
							<BrowserViewer 
								screenshots={screenshots}
								currentIndex={currentIndex}
								setCurrentIndex={setCurrentIndex}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

