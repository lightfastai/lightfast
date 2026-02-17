"use client";

import { lazy, Suspense } from "react";

const ImageDithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({
    default: mod.ImageDithering,
  })),
);

function Fallback() {
  return <div className="w-full h-full bg-blue-800" />;
}

export function DitheredBackground() {
  return (
    <Suspense fallback={<Fallback />}>
      <ImageDithering
        width="100%"
        height="100%"
        image="/images/lightfast-gradient.webp"
        colorBack="#1e40af"
        colorFront="#ffffff"
        colorHighlight="#ffffff"
        originalColors={false}
        inverted={false}
        type="2x2"
        size={2}
        colorSteps={4}
        fit="cover"
        style={{ width: "100%", height: "100%" }}
      />
    </Suspense>
  );
}
