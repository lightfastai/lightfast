import { loadFont } from "@remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";

// ── Font loading ───────────────────────────────────────────────────────
let fontsLoaded = false;
const ensureFontsLoaded = async () => {
  if (fontsLoaded) {
    return;
  }
  await loadFont({
    family: "PP Neue Montreal",
    url: staticFile("fonts/PPNeueMontreal-Book.woff2"),
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
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily:
            '"PP Neue Montreal", ui-sans-serif, system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 48,
          color: "#ffffff",
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          textAlign: "center",
        }}
      >
        Superintelligence layer for founders
      </div>
    </AbsoluteFill>
  );
};
