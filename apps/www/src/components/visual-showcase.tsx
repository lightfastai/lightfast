/**
 * Visual Showcase Component
 *
 * Provides a visual container with background image for showcasing features and demos.
 * Based on the Cursor marketing site design pattern.
 */

import { type ReactNode } from "react";
import Image from "next/image";

interface VisualShowcaseProps {
  children: ReactNode;
  backgroundImage?: string;
  minHeight?: string;
  maxHeight?: string;
}

export function VisualShowcase({
  children,
  backgroundImage = "/images/5_landscape.jpg",
  minHeight = "680px",
  maxHeight = "min(780px, 70vh)",
}: VisualShowcaseProps) {
  return (
    <div className="relative grid grid-cols-1 grid-rows-1 rounded-xs overflow-hidden bg-accent">
      {/* Background Image Layer */}
      <div className="relative z-[1] col-span-full row-span-full overflow-hidden rounded-xs">
        <Image
          className="h-full w-full select-none object-cover"
          alt="Demo background"
          src={backgroundImage}
          fill
          priority
          sizes="100vw"
          quality={70}
          draggable={false}
          unoptimized
        />
      </div>

      {/* Frosted Glass Blur Overlay */}
      <div className="absolute inset-0 z-10 col-span-full row-span-full backdrop-blur-md bg-white/5" />

      {/* Content Layer */}
      <div className="z-20 col-span-full row-span-full">
        <div
          className="relative w-full select-none overflow-hidden rounded-xs border border-border"
          style={{
            height: maxHeight,
            minHeight: minHeight,
          }}
        >
          <div className="absolute inset-0 z-10 h-full w-full transition-opacity duration-150">
            <div className="mx-auto flex h-full max-w-5xl items-center justify-center px-4 py-16">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
