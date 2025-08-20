"use client";

import { useEffect, useState } from "react";
import ReactOriginal from "react-devicons/react/original";
import NextjsPlain from "react-devicons/nextjs/plain";
import VuejsPlain from "react-devicons/vuejs/plain";
import NuxtjsPlain from "react-devicons/nuxtjs/plain";
import SveltePlain from "react-devicons/svelte/plain";
import AngularPlain from "react-devicons/angular/plain";
import FlutterPlain from "react-devicons/flutter/plain";
import FastifyPlain from "react-devicons/fastify/plain";
import NodejsPlain from "react-devicons/nodejs/plain";
import SolidjsPlain from "react-devicons/solidjs/plain";
import QwikPlain from "react-devicons/qwik/plain";

const frameworks = [
	{ name: "React", Icon: ReactOriginal },
	{ name: "Next.js", Icon: NextjsPlain },
	{ name: "Vue", Icon: VuejsPlain },
	{ name: "Nuxt.js", Icon: NuxtjsPlain },
	{ name: "Svelte", Icon: SveltePlain },
	{ name: "SolidJS", Icon: SolidjsPlain },
	{ name: "Qwik", Icon: QwikPlain },
	{ name: "Angular", Icon: AngularPlain },
	{ name: "Node.js", Icon: NodejsPlain },
	{ name: "Hono", Icon: FastifyPlain }, // Using Fastify icon as placeholder for Hono
	{ name: "Fastify", Icon: FastifyPlain },
	{ name: "Flutter", Icon: FlutterPlain },
];

export function FrameworkShowcase() {
	const [currentFrameworkIndex, setCurrentFrameworkIndex] = useState(0);
	const [hoveredFramework, setHoveredFramework] = useState<string | null>(null);
	const [isHovering, setIsHovering] = useState(false);

	useEffect(() => {
		// Only cycle through frameworks when not hovering
		if (!isHovering && !hoveredFramework) {
			const interval = setInterval(() => {
				setCurrentFrameworkIndex((prev) => (prev + 1) % frameworks.length);
			}, 2000);

			return () => clearInterval(interval);
		}
	}, [isHovering, hoveredFramework]);

	// Duplicate frameworks multiple times to ensure seamless scrolling
	const scrollFrameworks = [...frameworks, ...frameworks, ...frameworks];

	return (
		<div className="w-full space-y-6">
			{/* Text */}
			<div className="text-left">
				<h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">
					<span className="text-muted-foreground">Use Lightfast with </span>
					<span className="text-foreground inline-block min-w-[120px]">
						{hoveredFramework || frameworks[currentFrameworkIndex].name}
					</span>
				</h2>
			</div>

			{/* Frameworks - Infinite Scroll */}
			<div 
				className="relative w-full overflow-hidden py-3"
				onMouseEnter={() => setIsHovering(true)}
				onMouseLeave={() => {
					setIsHovering(false);
					setHoveredFramework(null);
				}}
			>
				<div 
					className="flex animate-framework-scroll" 
					style={{ 
						width: 'max-content',
						animationPlayState: isHovering ? 'paused' : 'running'
					}}
				>
					{/* Triple the frameworks for seamless loop */}
					{scrollFrameworks.map((framework, index) => {
						const originalIndex = index % frameworks.length;
						return (
							<div
								key={index}
								className="flex-shrink-0 px-6 lg:px-8 py-1"
								onMouseEnter={() => setHoveredFramework(frameworks[originalIndex].name)}
								onMouseLeave={() => setHoveredFramework(null)}
							>
								<div
									className={`p-2 rounded-sm transition-all duration-200 cursor-pointer ${
										hoveredFramework === frameworks[originalIndex].name 
											? 'outline outline-2 outline-muted outline-offset-2' 
											: ''
									}`}
								>
									<framework.Icon
										size={40}
										color="currentColor"
										className={`w-10 h-10 lg:w-12 lg:h-12 transition-colors duration-200 ${
											hoveredFramework === frameworks[originalIndex].name
												? 'text-foreground'
												: 'text-muted-foreground'
										}`}
									/>
								</div>
							</div>
						);
					})}
				</div>
				{/* Gradient overlays for fade effect */}
				<div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none" />
				<div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none" />
			</div>
		</div>
	);
}

