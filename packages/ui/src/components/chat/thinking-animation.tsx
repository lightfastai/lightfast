"use client";

import { memo } from "react";

/**
 * Memoized thinking animation component
 * Displays an animated square with gradient and displacement effects
 */
export const ThinkingAnimation = memo(function ThinkingAnimation() {
  return (
    <>
      <div className="relative h-2.5 w-2.5">
        {/* Square shape with animated gradient inside */}
        <div
          className="absolute inset-0 overflow-hidden rounded-sm"
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
        <div className="absolute -inset-1 animate-pulse rounded-sm bg-gradient-to-r from-purple-600/40 via-blue-600/40 to-pink-600/40 blur-lg" />
      </div>

      {/* SVG Filters - Only render once per page */}
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <defs>
          <filter id="shape-displacement">
            {/* Animated turbulence for displacement */}
            <feTurbulence
              baseFrequency="0.03 0.04"
              numOctaves="2"
              result="turbulence"
              seed="5"
              type="fractalNoise"
            >
              <animate
                attributeName="baseFrequency"
                dur="3s"
                repeatCount="indefinite"
                values="0.03 0.04;0.05 0.07;0.03 0.04"
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

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS keyframe injection for animation
        dangerouslySetInnerHTML={{
          __html: `
				@keyframes gradient {
					0% { background-position: 0% 50%; }
					50% { background-position: 100% 50%; }
					100% { background-position: 0% 50%; }
				}
				.animate-gradient {
					animation: gradient 3s ease infinite;
				}
			`,
        }}
      />
    </>
  );
});
