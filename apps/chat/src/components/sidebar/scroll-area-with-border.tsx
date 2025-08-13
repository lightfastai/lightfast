"use client";

import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { useState, useRef, useEffect } from "react";
import { cn } from "@repo/ui/lib/utils";

interface ScrollAreaWithBorderProps {
	children: React.ReactNode;
	className?: string;
}

export function ScrollAreaWithBorder({ children, className }: ScrollAreaWithBorderProps) {
	const [isScrolled, setIsScrolled] = useState(false);
	const scrollAreaRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
		if (!scrollElement) return;

		const handleScroll = () => {
			setIsScrolled(scrollElement.scrollTop > 0);
		};

		scrollElement.addEventListener('scroll', handleScroll);
		return () => scrollElement.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<>
			{/* Dynamic border that appears on scroll */}
			<div className={cn(
				"border-t transition-opacity duration-200",
				isScrolled ? "border-border/50 opacity-100" : "border-transparent opacity-0"
			)} />
			
			<ScrollArea ref={scrollAreaRef} className={className}>
				{children}
			</ScrollArea>
		</>
	);
}