"use client";

import { useState } from "react";
import ReactOriginal from "react-devicons/react/original";
import NextjsPlain from "react-devicons/nextjs/plain";
import VuejsPlain from "react-devicons/vuejs/plain";
import NuxtjsPlain from "react-devicons/nuxtjs/plain";
import SveltePlain from "react-devicons/svelte/plain";
import AstroPlain from "react-devicons/astro/plain";
import AngularPlain from "react-devicons/angular/plain";
import FlutterPlain from "react-devicons/flutter/plain";
import VitejsPlain from "react-devicons/vitejs/plain";

const frameworks = [
	{ name: "React", Icon: ReactOriginal },
	{ name: "Next.js", Icon: NextjsPlain },
	{ name: "Vue", Icon: VuejsPlain },
	{ name: "Nuxt", Icon: NuxtjsPlain },
	{ name: "Svelte", Icon: SveltePlain },
	{ name: "Astro", Icon: AstroPlain },
	{ name: "Angular", Icon: AngularPlain },
	{ name: "Flutter", Icon: FlutterPlain },
	{ name: "Vite", Icon: VitejsPlain },
];

export function FrameworkSection() {
	const [hoveredFramework, setHoveredFramework] = useState<string | null>(null);

	return (
		<div className="w-fit mx-auto grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 items-center">
			{/* Left side - Text (1/4) */}
			<div className="lg:col-span-1 text-center lg:text-left">
				<h2 className="text-lg sm:text-xl lg:text-2xl font-semibold">
					<span className="text-muted-foreground">Use Lightfast with </span>
					<span className="text-foreground lg:block">
						{hoveredFramework ?? "any framework"}
					</span>
				</h2>
			</div>

			{/* Right side - Frameworks (3/4) */}
			<div
				className="lg:col-span-3 flex justify-center lg:justify-start"
				onMouseLeave={() => setHoveredFramework(null)}
			>
				<div className="flex flex-wrap justify-center lg:justify-start gap-1 lg:gap-6 max-w-[200px] sm:max-w-[250px] md:max-w-[300px] lg:max-w-none">
					{frameworks.map((framework, index) => (
						<div
							key={index}
							className="p-1 lg:p-3 hover:outline hover:outline-2 hover:outline-muted hover:outline-offset-2 rounded-sm transition-all duration-200 cursor-pointer"
							onMouseEnter={() => setHoveredFramework(framework.name)}
						>
							<framework.Icon
								size="1.25rem"
								color="currentColor"
								className="text-muted-foreground hover:text-foreground transition-colors duration-200 [&>*]:!w-5 [&>*]:!h-5 lg:[&>*]:!w-10 lg:[&>*]:!h-10"
							/>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

