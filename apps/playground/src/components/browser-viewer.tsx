"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useScreenshotStore } from "~/stores/screenshot-store";
import Image from "next/image";

interface BrowserViewerProps {
	className?: string;
}

export function BrowserViewer({ className }: BrowserViewerProps) {
	const { screenshots, currentIndex, setCurrentIndex } = useScreenshotStore();
	
	// Get the current screenshot from the store
	const currentScreenshot = currentIndex >= 0 && currentIndex < screenshots.length 
		? screenshots[currentIndex] 
		: null;
	
	// Use screenshot from store
	const displayScreenshot = currentScreenshot?.url;
	
	const handlePrevious = () => {
		if (currentIndex > 0) {
			setCurrentIndex(currentIndex - 1);
		}
	};
	
	const handleNext = () => {
		if (currentIndex < screenshots.length - 1) {
			setCurrentIndex(currentIndex + 1);
		}
	};
	
	return (
		<div
			className={`flex flex-col aspect-[3/2] border rounded-sm overflow-hidden ${className || ""}`}
		>
			{/* Browser toolbar */}
			<div className="flex items-center justify-between p-2 border-b">
				<div className="flex items-center gap-1">
					<Button 
						variant="ghost" 
						size="icon" 
						className="h-8 w-8 rounded-full" 
						disabled={currentIndex <= 0}
						onClick={handlePrevious}
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<Button 
						variant="ghost" 
						size="icon" 
						className="h-8 w-8 rounded-full" 
						disabled={currentIndex >= screenshots.length - 1}
						onClick={handleNext}
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
				{screenshots.length > 0 && (
					<div className="text-xs text-muted-foreground pr-2">
						{currentIndex + 1} / {screenshots.length}
					</div>
				)}
			</div>

			{/* Browser content */}
			<div className="flex-1 bg-muted/20 overflow-auto relative">
				{displayScreenshot ? (
					<div className="relative w-full">
						<Image 
							src={displayScreenshot} 
							alt="Browser view" 
							width={1200}
							height={800}
							className="w-full h-auto"
							sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
							priority
						/>
					</div>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<div className="text-muted-foreground text-sm">
							No screenshot available
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
