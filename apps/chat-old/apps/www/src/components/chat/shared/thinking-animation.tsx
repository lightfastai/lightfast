"use client";

import { memo } from "react";

/**
 * Memoized thinking animation component
 * Displays an animated square with gradient and displacement effects
 */
export const ThinkingAnimation = memo(function ThinkingAnimation() {
	return (
		<>
			<div className="relative w-3 h-3">
				{/* Square shape with animated gradient inside */}
				<div
					className="absolute inset-0 rounded-sm overflow-hidden"
					style={{
						filter: "url(#shape-displacement)",
					}}
				>
					{/* Animated gradient background */}
					<div
						className="absolute inset-0 animate-gradient"
						style={{
							background:
								"linear-gradient(135deg, #9333ea 0%, #3b82f6 25%, #ec4899 50%, #9333ea 75%, #3b82f6 100%)",
							backgroundSize: "400% 400%",
						}}
					/>
				</div>

				{/* Glow effect */}
				<div className="absolute -inset-1 bg-gradient-to-r from-purple-600/40 via-blue-600/40 to-pink-600/40 blur-lg rounded-sm animate-pulse" />
			</div>

			{/* SVG Filters - Only render once per page */}
			<svg className="absolute w-0 h-0" aria-hidden="true">
				<defs>
					<filter id="shape-displacement">
						{/* Animated turbulence for displacement */}
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.03 0.04"
							numOctaves="2"
							seed="5"
							result="turbulence"
						>
							<animate
								attributeName="baseFrequency"
								dur="3s"
								values="0.03 0.04;0.05 0.07;0.03 0.04"
								repeatCount="indefinite"
							/>
						</feTurbulence>

						{/* Displacement map */}
						<feDisplacementMap
							in="SourceGraphic"
							in2="turbulence"
							scale="1.5"
							xChannelSelector="R"
							yChannelSelector="G"
						/>
					</filter>
				</defs>
			</svg>

			<style jsx>{`
				@keyframes pulse {
					0%, 100% {
						opacity: 0.4;
					}
					50% {
						opacity: 0.7;
					}
				}

				@keyframes gradient {
					0% {
						background-position: 0% 50%;
					}
					50% {
						background-position: 100% 50%;
					}
					100% {
						background-position: 0% 50%;
					}
				}

				.animate-pulse {
					animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
				}

				.animate-gradient {
					animation: gradient 3s ease infinite;
				}
			`}</style>
		</>
	);
});
