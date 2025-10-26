"use client";

import Image from "next/image";
import type { ReactNode } from "react";

interface LightfastImageViewerProps {
  src: string;
  alt?: string;
  children?: ReactNode;
}

export function LightfastImageViewer({
  src,
  alt = "Lightfast showcase",
  children,
}: LightfastImageViewerProps) {
  return (
    <div className="relative w-full h-full min-h-[700px]">
      {/* Background Image */}
      <div className="absolute inset-0 overflow-hidden rounded-sm">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          priority
          unoptimized
        />
      </div>

      {/* Overlay Content */}
      {children}
    </div>
  );
}
