import React from "react";

interface LightfastCustomGridBackgroundProps {
	children: React.ReactNode;
	className?: string;
	marginVertical?: string;
	marginHorizontal?: string;
	marginVerticalMobile?: string;
	marginHorizontalMobile?: string;
}

function Root({ 
	children, 
	className = "",
	marginVertical = "15vh",
	marginHorizontal = "15vw",
	marginVerticalMobile = "5vh",
	marginHorizontalMobile = "5vw"
}: LightfastCustomGridBackgroundProps) {
	const gridLinePositions = {
		"--margin-vertical": marginVertical,
		"--margin-horizontal": marginHorizontal,
		"--margin-vertical-mobile": marginVerticalMobile,
		"--margin-horizontal-mobile": marginHorizontalMobile,
	} as React.CSSProperties;

	return (
		<div className={`min-h-screen bg-background relative overflow-hidden ${className}`} style={gridLinePositions}>
			{/* Grid lines - Desktop */}
			<div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
				{/* Horizontal lines through corners */}
				<div
					className="bg-border/30 absolute h-px w-full"
					style={{ top: "var(--margin-vertical)" }}
				/>
				<div
					className="bg-border/30 absolute h-px w-full"
					style={{ bottom: "var(--margin-vertical)" }}
				/>
				
				{/* Vertical lines through corners */}
				<div
					className="bg-border/30 absolute top-0 h-full w-px"
					style={{ left: "var(--margin-horizontal)" }}
				/>
				<div
					className="bg-border/30 absolute top-0 h-full w-px"
					style={{ right: "var(--margin-horizontal)" }}
				/>
				
				{/* Inner grid lines - 3x3 grid */}
				<div
					className="bg-border/20 absolute h-px w-full"
					style={{ top: "calc(var(--margin-vertical) + (100vh - 2 * var(--margin-vertical)) * 0.33)" }}
				/>
				<div
					className="bg-border/20 absolute h-px w-full"
					style={{ top: "calc(var(--margin-vertical) + (100vh - 2 * var(--margin-vertical)) * 0.66)" }}
				/>
				<div
					className="bg-border/20 absolute top-0 h-full w-px"
					style={{ left: "calc(var(--margin-horizontal) + (100vw - 2 * var(--margin-horizontal)) * 0.33)" }}
				/>
				<div
					className="bg-border/20 absolute top-0 h-full w-px"
					style={{ left: "calc(var(--margin-horizontal) + (100vw - 2 * var(--margin-horizontal)) * 0.66)" }}
				/>
			</div>

			{/* Grid lines - Mobile */}
			<div className="pointer-events-none absolute inset-0 z-10 lg:hidden">
				{/* Horizontal lines through corners */}
				<div
					className="bg-border/30 absolute h-px w-full"
					style={{ top: "var(--margin-vertical-mobile)" }}
				/>
				<div
					className="bg-border/30 absolute h-px w-full"
					style={{ bottom: "var(--margin-vertical-mobile)" }}
				/>
				
				{/* Vertical lines through corners */}
				<div
					className="bg-border/30 absolute top-0 h-full w-px"
					style={{ left: "var(--margin-horizontal-mobile)" }}
				/>
				<div
					className="bg-border/30 absolute top-0 h-full w-px"
					style={{ right: "var(--margin-horizontal-mobile)" }}
				/>
				
				{/* Inner grid lines - 3x3 grid */}
				<div
					className="bg-border/20 absolute h-px w-full"
					style={{ top: "calc(var(--margin-vertical-mobile) + (100vh - 2 * var(--margin-vertical-mobile)) * 0.33)" }}
				/>
				<div
					className="bg-border/20 absolute h-px w-full"
					style={{ top: "calc(var(--margin-vertical-mobile) + (100vh - 2 * var(--margin-vertical-mobile)) * 0.66)" }}
				/>
				<div
					className="bg-border/20 absolute top-0 h-full w-px"
					style={{ left: "calc(var(--margin-horizontal-mobile) + (100vw - 2 * var(--margin-horizontal-mobile)) * 0.33)" }}
				/>
				<div
					className="bg-border/20 absolute top-0 h-full w-px"
					style={{ left: "calc(var(--margin-horizontal-mobile) + (100vw - 2 * var(--margin-horizontal-mobile)) * 0.66)" }}
				/>
			</div>

			{/* Content */}
			{children}
		</div>
	);
}

interface ContainerProps {
	children: React.ReactNode;
	className?: string;
}

function Container({ children, className = "" }: ContainerProps) {
	return (
		<div className={`absolute inset-[var(--margin-vertical-mobile)_var(--margin-horizontal-mobile)] lg:inset-[var(--margin-vertical)_var(--margin-horizontal)] border border-border/50 bg-background z-20 ${className}`}>
			{children}
		</div>
	);
}

export const LightfastCustomGridBackground = {
	Root,
	Container,
};