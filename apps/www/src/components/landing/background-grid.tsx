import React from "react";

export function BackgroundGrid() {
	return (
		<div className="fixed inset-0 pointer-events-none">
			<div className="mx-auto max-w-7xl h-full relative">
				{/* 5 vertical lines evenly spaced */}
				<div
					className="absolute top-0 bottom-0 w-px bg-black/10 dark:bg-white/10"
					style={{ left: "0%" }}
				/>
				<div
					className="absolute top-0 bottom-0 w-px bg-black/10 dark:bg-white/10"
					style={{ left: "25%" }}
				/>
				<div
					className="absolute top-0 bottom-0 w-px bg-black/10 dark:bg-white/10"
					style={{ left: "50%" }}
				/>
				<div
					className="absolute top-0 bottom-0 w-px bg-black/10 dark:bg-white/10"
					style={{ left: "75%" }}
				/>
				<div
					className="absolute top-0 bottom-0 w-px bg-black/10 dark:bg-white/10"
					style={{ left: "100%" }}
				/>
			</div>
		</div>
	);
}
