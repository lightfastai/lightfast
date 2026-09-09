import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
} from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";

// ── Font loading ───────────────────────────────────────────────────────
let fontsLoaded = false;
const ensureFontsLoaded = async () => {
  if (fontsLoaded) {
    return;
  }
  await loadFont({
    family: "PP Neue Montreal",
    url: staticFile("fonts/pp-neue-montreal/PPNeueMontreal-Book.woff2"),
    weight: "400",
  });
  fontsLoaded = true;
};

// ── Component ──────────────────────────────────────────────────────────
export const GitHubBanner: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));

  useEffect(() => {
    void ensureFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  return (
    <AbsoluteFill className="flex items-center justify-center bg-background text-foreground">
      <div className="text-center font-normal font-title text-5xl">
        Superintelligence layer for founders
      </div>
    </AbsoluteFill>
  );
};
