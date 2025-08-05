import React from "react";
import Link from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { siteConfig } from "@repo/lightfast-config";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
	const gridLinePositions = {
		"--viewport-width": "100vw",
		"--viewport-height": "100vh",
		"--margin-vertical": "15vh",
		"--margin-horizontal": "15vw",
		"--container-top": "var(--margin-vertical)",
		"--container-bottom": "calc(100vh - var(--margin-vertical))",
		"--container-left": "var(--margin-horizontal)",
		"--container-right": "calc(100vw - var(--margin-horizontal))",
	} as React.CSSProperties;

	return (
		<div className="min-h-screen bg-background relative overflow-hidden" style={gridLinePositions}>
			{/* Grid lines */}
			<div className="pointer-events-none absolute inset-0 z-10">
				{/* Horizontal lines through corners */}
				<div
					className="bg-border/30 absolute h-px w-full"
					style={{ top: "var(--container-top)" }}
				/>
				<div
					className="bg-border/30 absolute h-px w-full"
					style={{ top: "var(--container-bottom)" }}
				/>
				
				{/* Vertical lines through corners */}
				<div
					className="bg-border/30 absolute top-0 h-full w-px"
					style={{ left: "var(--container-left)" }}
				/>
				<div
					className="bg-border/30 absolute top-0 h-full w-px"
					style={{ left: "var(--container-right)" }}
				/>
				
				{/* Inner grid lines - 3x3 grid */}
				<div
					className="bg-border/20 absolute h-px w-full"
					style={{ top: "calc(var(--container-top) + (var(--container-bottom) - var(--container-top)) * 0.33)" }}
				/>
				<div
					className="bg-border/20 absolute h-px w-full"
					style={{ top: "calc(var(--container-top) + (var(--container-bottom) - var(--container-top)) * 0.66)" }}
				/>
				<div
					className="bg-border/20 absolute top-0 h-full w-px"
					style={{ left: "calc(var(--container-left) + (var(--container-right) - var(--container-left)) * 0.33)" }}
				/>
				<div
					className="bg-border/20 absolute top-0 h-full w-px"
					style={{ left: "calc(var(--container-left) + (var(--container-right) - var(--container-left)) * 0.66)" }}
				/>
			</div>

			{/* Rectangle container spanning from 15vh/15vw to 85vh/85vw */}
			<div className="absolute inset-0 m-[15vh_15vw] border border-border/50 bg-background z-20">
				{/* Grid with 12 columns: 7/12 for left, 5/12 for right */}
				<div className="grid grid-cols-12 h-full">
					{/* Left section - 7/12 of space */}
					<div className="col-span-7 border-r border-border/50">
						<div className="relative h-full p-8">
							{/* Text at top left */}
							<div className="absolute top-8 left-8 right-8">
								<p className="text-foreground max-w-xl text-2xl font-bold sm:text-3xl lg:text-4xl">
									Experiment with unreleased Lightfast features in our sandbox.
								</p>
								<p className="text-muted-foreground text-sm mt-4">
									This platform is invite-only
								</p>
							</div>

							{/* Logo at bottom left */}
							<div className="absolute bottom-8 left-8">
								<Link href={siteConfig.url} target="_blank" rel="noopener noreferrer">
									<Icons.logoShort className="text-primary w-10 h-6 hover:opacity-80 transition-opacity cursor-pointer" />
								</Link>
							</div>
						</div>
					</div>

					{/* Right section - 5/12 of space for sign-in */}
					<div className="col-span-5 flex items-center justify-center p-8">
						<div className="w-full max-w-sm">
							<SignInForm />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
