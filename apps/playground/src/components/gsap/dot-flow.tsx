"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { DotLoader } from "./dot-loader";

export type DotFlowProps = {
	items: {
		title: string;
		frames: number[][];
		duration?: number;
		repeatCount?: number;
	}[];
	isPlaying?: boolean;
};

export const DotFlow = ({ items, isPlaying = true }: DotFlowProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const [index, setIndex] = useState(0);
	const [textIndex, setTextIndex] = useState(0);

	const { contextSafe } = useGSAP();

	// Removed width animation effect

	useEffect(() => {
		setIndex(0);
		setTextIndex(0);
	}, [items]);

	const next = contextSafe(() => {
		setTextIndex((prev) => (prev + 1) % items.length);
		setIndex((prev) => (prev + 1) % items.length);
	});

	return (
		<div className="flex flex-col items-center gap-6 rounded px-4 py-3">
			<DotLoader
				frames={items[index]?.frames ?? []}
				onComplete={next}
				className="gap-px"
				isPlaying={isPlaying}
				repeatCount={items[index]?.repeatCount ?? 1}
				duration={items[index]?.duration ?? 150}
				dotClassName="bg-muted-foreground/15 [&.active]:bg-foreground"
			/>
			<div ref={containerRef} className="relative">
				<div
					ref={textRef}
					className="inline-block text-sm font-medium whitespace-nowrap text-muted-foreground"
				>
					{items[textIndex]?.title}
				</div>
			</div>
		</div>
	);
};

